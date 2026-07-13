"""Shared-instance entry point.

One ``lelu(...)`` call in a shared module produces the instance the rest of
the app imports — full engine access via ``auth.api``, and ``auth.authorize()``
with a default actor filled in. With no arguments it is zero-config: it
connects to the engine ``npx lelu-mcp start`` is already running (see
:mod:`auth_pe.local`).

Usage::

    # app/deps.py
    from lelu import lelu

    auth = lelu(actor="billing-agent")

    # anywhere on the server
    result = await auth.authorize(tool="refund:process")
    if result.decision != "allow":
        raise PermissionError(result.reason)
"""

from __future__ import annotations

from typing import Any

from .client import LeluClient
from .models import AuthDecision, AuthorizeRequest

__all__ = ["LeluInstance", "lelu"]


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
