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

import inspect
import json
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Union, cast

from .client import LeluClient
from .models import AuthDecision, AuthEngineError, AuthorizeRequest, RedeemResult

__all__ = ["HandlerCaller", "LeluInstance", "lelu"]

Scope = dict[str, Any]
Receive = Callable[[], Awaitable[dict[str, Any]]]
Send = Callable[[dict[str, Any]], Awaitable[None]]


@dataclass(frozen=True)
class HandlerCaller:
    """The caller of ``auth.handler``, as your app's own authentication sees it.

    ``reviewer`` is the human this caller is, when they may review queued
    actions. It is required to list, approve or deny, and it is recorded as the
    resolver: the request body cannot choose it. Leave it unset for callers who
    may only authorize.
    """

    reviewer: str | None = None


# ``authenticate(scope)`` returns the caller, or ``None`` to refuse with 401. It
# may be sync or async and receives the ASGI scope (headers, session, user, ...).
Authenticate = Callable[
    [Scope], Union[HandlerCaller, None, Awaitable[Union[HandlerCaller, None]]]
]


class LeluInstance:
    """App-wide Lelu instance: ``api`` is the full client, ``authorize()``
    applies the instance's default actor."""

    def __init__(
        self,
        api: LeluClient,
        actor: str | None = None,
        authenticate: Authenticate | None = None,
        reviewer_key: str | None = None,
    ) -> None:
        self.api = api
        self.actor = actor
        self.authenticate = authenticate
        self.reviewer_key = reviewer_key

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

    async def wait_and_redeem(
        self,
        review: str | AuthDecision,
        req: AuthorizeRequest | None = None,
        /,
        timeout_ms: int = 30_000,
        **kwargs: Any,
    ) -> RedeemResult:
        """Waits for a human decision, then re-checks this request against
        what was actually approved.

        Use this after a ``human_review`` decision instead of just waiting.
        Waiting alone tells you a reviewer approved *something*; it doesn't
        bind that approval to what you execute next. Pass the decision you
        got back, plus the same request you passed to :meth:`authorize`::

            result = await auth.authorize(tool="refund:process", args={"amount": 100})
            if result.decision == "human_review":
                outcome = await auth.wait_and_redeem(
                    result, tool="refund:process", args={"amount": 100}
                )
                if not outcome.allowed:
                    raise PermissionError(outcome.reason)

        Passing the decision itself is preferred over passing an ID: a
        decision carries both ``request_id`` (trace) and ``review_id``
        (queue key), and picking the wrong one fails in a way that only
        shows up at redemption.
        """
        if req is None:
            req = AuthorizeRequest(**kwargs)
        elif kwargs:
            raise TypeError("pass either an AuthorizeRequest or keyword fields, not both")
        if req.actor is None and self.actor is not None:
            req = req.model_copy(update={"actor": self.actor})
        return await self.api.wait_and_redeem(review, req, timeout_ms=timeout_ms)

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

        Every route except ``GET /ok`` acts with this instance's engine
        credentials, so it is only served to a caller your app has
        authenticated. Pass ``authenticate=`` to :func:`lelu`::

            async def authenticate(scope):
                user = scope.get("user")          # your session / JWT check
                if user is None:
                    return None                   # -> 401
                return HandlerCaller(reviewer=user.name if user.is_reviewer else None)

            auth = lelu(authenticate=authenticate, reviewer_key=os.environ["LELU_REVIEWER_KEY"])

        Without ``authenticate`` the handler answers 403 for everything but
        ``/ok``: mounting it publicly would otherwise let anyone authorize as
        your agents or approve their actions.

        Routes:
            POST /authorize           body: AuthorizeRequest -> AuthDecision      (authenticated)
            GET  /queue               -> {"items": [...], "count": N}             (reviewer)
            POST /queue/{id}/approve  body: {"note"?}                             (reviewer)
            POST /queue/{id}/deny     body: {"note"?}                             (reviewer)
            GET  /ok                  -> {"ok": true}                             (anyone)

        The resolver of an approval or denial is the authenticated reviewer. A
        ``resolved_by`` in the request body is ignored.
        """
        if scope["type"] != "http":
            raise RuntimeError("LeluInstance.handler only supports the ASGI 'http' protocol")

        method = cast(str, scope["method"]).upper()
        segments = [s for s in cast(str, scope["path"]).split("/") if s]

        try:
            if method == "GET" and segments == ["ok"]:
                healthy = await self.api.is_healthy()
                await _send_json(send, 200, {"ok": healthy})
                return

            # Everything else acts with the engine credentials, so it is only
            # served to a caller the app has authenticated.
            if self.authenticate is None:
                await _send_json(
                    send,
                    403,
                    {
                        "error": "handler_not_configured",
                        "message": "auth.handler needs an `authenticate` option before it serves anything but /ok",
                    },
                )
                return
            caller = self.authenticate(scope)
            if inspect.isawaitable(caller):
                caller = await caller
            if caller is None:
                await _send_json(send, 401, {"error": "unauthenticated"})
                return
            reviewer = (caller.reviewer or "").strip()

            is_queue = bool(segments) and segments[0] == "queue"
            if is_queue and not reviewer:
                await _send_json(
                    send, 403, {"error": "forbidden", "message": "only a reviewer may use the review queue"}
                )
                return

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
                # The resolver is the authenticated reviewer; a resolved_by in
                # the body is ignored (taking it from there let any caller name
                # any reviewer).
                note = body.get("note") or ""
                if segments[2] == "approve":
                    ok = await self.api.approve_review(
                        review_id, reviewer, note, reviewer_key=self.reviewer_key
                    )
                else:
                    ok = await self.api.deny_review(
                        review_id, reviewer, note, reviewer_key=self.reviewer_key
                    )
                await _send_json(send, 200, {"success": ok})
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
    authenticate: Authenticate | None = None,
    reviewer_key: str | None = None,
) -> LeluInstance:
    """Creates the app-wide Lelu instance. Call it once and import the result
    everywhere.

    With no arguments, connects zero-config to the engine ``lelu-mcp`` runs
    locally; pass ``base_url``/``api_key`` (or set ``LELU_BASE_URL`` /
    ``LELU_API_KEY``) to target a self-hosted or cloud engine.

    ``authenticate`` guards ``auth.handler`` (see :meth:`LeluInstance.handler`);
    ``reviewer_key`` is one of the engine's ``LELU_REVIEWER_KEYS`` secrets, sent
    when the handler approves or denies.
    """
    api = LeluClient(base_url=base_url, timeout=timeout, api_key=api_key)
    return LeluInstance(api, actor=actor, authenticate=authenticate, reviewer_key=reviewer_key)


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
