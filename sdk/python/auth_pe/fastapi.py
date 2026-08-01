"""
FastAPI integration for Lelu Auth Permission Engine.

Usage::

    from fastapi import FastAPI, Depends
    from lelu.fastapi import Authorize
    from lelu import LeluClient

    app = FastAPI()
    client = LeluClient(base_url="http://localhost:8080")

    @app.get("/sensitive")
    async def sensitive(
        _: None = Depends(Authorize("data.read", confidence=0.9, client=client))
    ):
        return {"ok": True}
"""

from __future__ import annotations

import os
from typing import Any, Callable, Optional, cast

from fastapi import Depends, HTTPException, Request, status

from .client import LeluClient
from .models import AgentAuthDecision, AgentAuthRequest, AgentContext, AuthEngineError

_DEFAULT_CLIENT: Optional[LeluClient] = None


def _get_default_client() -> LeluClient:
    global _DEFAULT_CLIENT
    if _DEFAULT_CLIENT is None:
        base_url = os.environ.get("LELU_BASE_URL", "http://localhost:8080")
        api_key = os.environ.get("LELU_API_KEY")
        _DEFAULT_CLIENT = LeluClient(base_url=base_url, api_key=api_key)
    return _DEFAULT_CLIENT


def Authorize(
    action: str,
    *,
    confidence: float | None = None,
    actor_header: str = "X-Actor",
    client: Optional[LeluClient] = None,
) -> Callable[..., Any]:
    """
    FastAPI dependency factory that calls the Lelu engine's ``/v1/agent/authorize``
    endpoint and raises ``HTTP 403`` when the decision is not *allowed*.

    Parameters
    ----------
    action:
        The action string to check (e.g. ``"files.read"``).
    confidence:
        Confidence score supplied with the request. Defaults to ``None`` —
        omitted from the request so the engine's ``MissingSignalMode`` decides
        rather than assuming a fabricated perfect score.
    actor_header:
        HTTP header that carries the actor identifier (default: ``X-Actor``).
    client:
        Explicit ``LeluClient`` instance. Falls back to one built from
        ``LELU_BASE_URL`` / ``LELU_API_KEY`` environment variables.

    Returns
    -------
    A FastAPI-compatible async dependency that returns ``AgentAuthDecision``
    when the request is allowed, and raises ``HTTPException(403)`` otherwise.
    """

    async def _dependency(request: Request) -> AgentAuthDecision:
        lelu = client or _get_default_client()
        actor = request.headers.get(actor_header, "anonymous")
        try:
            decision = await lelu.agent_authorize(
                AgentAuthRequest(
                    actor=actor,
                    action=action,
                    context=AgentContext(confidence=confidence),
                )
            )
        except AuthEngineError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Lelu engine error: {exc}",
            ) from exc

        # `allowed` is also true for a scope downgrade or a compute redirect —
        # neither means "let the endpoint run unrestricted." This dependency
        # has no way to run the endpoint under a restricted scope or a
        # different safe tool, so both must block the request, same as a deny.
        if not decision.allowed or decision.downgraded_scope or decision.computed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "allowed": decision.allowed,
                    "reason": decision.reason,
                    "downgraded_scope": decision.downgraded_scope,
                    "computed": decision.computed,
                    "safe_tool": decision.safe_tool,
                    "actor": actor,
                    "action": action,
                },
            )

        return decision

    return cast(Callable[..., Any], Depends(_dependency))
