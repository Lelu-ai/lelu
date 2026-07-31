"""Shared-instance entry point.

One ``lelu(...)`` call in a shared module produces the instance the rest of
the app imports — full engine access via ``auth.api``, ``auth.authorize()``
with a default actor filled in, and ``auth.handler`` — an ASGI 3 application
exposing the engine's authorize / review-queue / health endpoints, so a
browser-facing approval UI never sees the engine URL or API key. With no
arguments it is zero-config: it connects to the engine ``npx lelu-mcp start``
is already running (see :mod:`auth_pe.local`).

Usage::

    # app/deps.py
    from lelu import lelu

    auth = lelu(actor="billing-agent")

    # anywhere on the server
    result = await auth.authorize(tool="refund:process")
    if result.decision != "allow":
        raise PermissionError(result.reason)

    # app/main.py (FastAPI / Starlette)
    app.mount("/api/lelu", auth.handler)
"""

from __future__ import annotations

import json
from typing import Any, Awaitable, Callable, cast

from .client import LeluClient
from .models import AuthDecision, AuthEngineError, AuthorizeRequest

__all__ = ["LeluInstance", "lelu"]

Scope = dict[str, Any]
Receive = Callable[[], Awaitable[dict[str, Any]]]
Send = Callable[[dict[str, Any]], Awaitable[None]]


class LeluInstance:
    """App-wide Lelu instance: ``api`` is the full client, ``authorize()``
    applies the instance's default actor."""

    def __init__(self, api: LeluClient, actor: str | None = None) -> None:
        self.api = api
        self.actor = actor

    async def authorize(
        self, req: AuthorizeRequest | None = None, /, **kwargs: Any
    ) -> AuthDecision:
        """Authorizes a tool call, filling in the default ``actor`` when the
        request doesn't name one.

        Accepts either a prebuilt request or keyword fields::

            await auth.authorize(tool="refund:process")
            await auth.authorize(AuthorizeRequest(tool="refund:process"))
        """
        if req is None:
            req = AuthorizeRequest(**kwargs)
        elif kwargs:
            raise TypeError("pass either an AuthorizeRequest or keyword fields, not both")
        if req.actor is None and self.actor is not None:
            req = req.model_copy(update={"actor": self.actor})
        return await self.api.authorize(req)

    async def aclose(self) -> None:
        await self.api.aclose()

    async def __aenter__(self) -> "LeluInstance":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.aclose()

    async def handler(self, scope: Scope, receive: Receive, send: Send) -> None:
        """ASGI 3 application exposing the engine's authorize / review-queue /
        health endpoints, so browser code (e.g. an approval UI) never sees the
        engine URL or API key.

        Mount it under any prefix with Starlette/FastAPI — routes below are
        relative to the mount point, matching ASGI mounting conventions::

            app.mount("/api/lelu", auth.handler)

        Routes:
            POST /authorize           body: AuthorizeRequest -> AuthDecision
            GET  /queue               -> {"items": [...], "count": N}
            POST /queue/{id}/approve  body: {"resolved_by"?, "note"?}
            POST /queue/{id}/deny     body: {"resolved_by"?, "note"?}
            GET  /ok                  -> {"ok": true}
        """
        if scope["type"] != "http":
            raise RuntimeError("LeluInstance.handler only supports the ASGI 'http' protocol")

        method = cast(str, scope["method"]).upper()
        segments = [s for s in cast(str, scope["path"]).split("/") if s]

        try:
            if method == "POST" and segments == ["authorize"]:
                body = await _read_json(receive)
                decision = await self.authorize(AuthorizeRequest(**body))
                payload = decision.model_dump(mode="json")
                payload["allowed"] = decision.allowed
                payload["requires_human_review"] = decision.requires_human_review
                payload["computed"] = decision.computed
                await _send_json(send, 200, payload)
                return

            if method == "GET" and segments == ["queue"]:
                result = await self.api.list_pending_reviews()
                await _send_json(send, 200, result.model_dump(mode="json"))
                return

            if (
                method == "POST"
                and len(segments) == 3
                and segments[0] == "queue"
                and segments[2] in ("approve", "deny")
            ):
                review_id = segments[1]
                body = await _read_json(receive)
                resolved_by = body.get("resolved_by") or "handler"
                note = body.get("note") or ""
                if segments[2] == "approve":
                    ok = await self.api.approve_review(review_id, resolved_by, note)
                else:
                    ok = await self.api.deny_review(review_id, resolved_by, note)
                await _send_json(send, 200, {"success": ok})
                return

            if method == "GET" and segments == ["ok"]:
                healthy = await self.api.is_healthy()
                await _send_json(send, 200, {"ok": healthy})
                return

            await _send_json(send, 404, {"error": "not_found"})
        except AuthEngineError as exc:
            await _send_json(send, exc.status or 502, {"error": str(exc), "details": exc.details})
        except Exception as exc:  # defensive: never let a bad request crash the ASGI server
            await _send_json(send, 500, {"error": str(exc)})


def lelu(
    *,
    base_url: str | None = None,
    api_key: str | None = None,
    actor: str | None = None,
    timeout: float = 5.0,
) -> LeluInstance:
    """Creates the app-wide Lelu instance. Call it once and import the result
    everywhere.

    With no arguments, connects zero-config to the engine ``lelu-mcp`` runs
    locally; pass ``base_url``/``api_key`` (or set ``LELU_BASE_URL`` /
    ``LELU_API_KEY``) to target a self-hosted or cloud engine.
    """
    api = LeluClient(base_url=base_url, timeout=timeout, api_key=api_key)
    return LeluInstance(api, actor=actor)


async def _read_json(receive: Receive) -> dict[str, Any]:
    body = b""
    more_body = True
    while more_body:
        message = await receive()
        body += message.get("body", b"")
        more_body = message.get("more_body", False)
    if not body:
        return {}
    return cast(dict[str, Any], json.loads(body))


async def _send_json(send: Send, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [(b"content-type", b"application/json")],
        }
    )
    await send({"type": "http.response.body", "body": body})
