"""
LangGraph node wrappers for the Auth Permission Engine.

Provides ``secure_node`` — a decorator that gates any LangGraph node through
Lelu's Confidence-Aware Auth before execution.

Usage
-----
.. code-block:: python

    from lelu.langgraph import secure_node, AuthState
    from lelu import LeluClient

    client = LeluClient(base_url="http://localhost:8080")

    @secure_node(
        client=client,
        actor="invoice_bot",
        action="invoice:approve",
        confidence_key="confidence",   # state key that holds the LLM score
        acting_for_key="user_id",      # optional: user the agent acts for
    )
    async def approve_invoice(state: dict) -> dict:
        # Only runs when Lelu returns allowed=True
        return {**state, "approved": True}

Integration with LangGraph
--------------------------
.. code-block:: python

    from langgraph.graph import StateGraph, END

    graph = StateGraph(dict)
    graph.add_node("approve", approve_invoice)
    graph.set_entry_point("approve")
    graph.add_edge("approve", END)
    app = graph.compile()
"""

from __future__ import annotations

import functools
import logging
from typing import Any, Callable, TypeVar

from .client import LeluClient
from .models import AgentAuthRequest, AgentContext

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])

# ─── Constants ────────────────────────────────────────────────────────────────

_DENIED_KEY = "lelu_denied"
_REVIEW_KEY = "lelu_pending_review"
_REASON_KEY = "lelu_reason"
_REVIEW_ID_KEY = "lelu_review_id"


# ─── Decorator ────────────────────────────────────────────────────────────────


def secure_node(
    *,
    client: LeluClient,
    actor: str,
    action: str,
    confidence_key: str = "confidence",
    acting_for_key: str | None = None,
    default_confidence: float = 1.0,
    throw_on_deny: bool = False,
) -> Callable[[F], F]:
    """Wrap a LangGraph node with Lelu Confidence-Aware Auth.

    Parameters
    ----------
    client:
        Configured :class:`~lelu.LeluClient`.
    actor:
        Agent scope / actor name registered in Lelu policy.
    action:
        The permission string being checked (e.g. ``"invoice:approve"``).
    confidence_key:
        Key in the graph *state* dict that holds the LLM confidence score
        (float 0–1).  Defaults to ``"confidence"``.
    acting_for_key:
        Optional key in state that holds the user ID the agent is acting for.
    default_confidence:
        Confidence value used when ``confidence_key`` is absent from state.
        Defaults to ``1.0`` (full confidence assumed).
    throw_on_deny:
        If ``True``, raise :class:`PermissionDeniedError` on denial.
        If ``False`` (default) the node returns augmented state with
        ``lelu_denied=True`` and ``lelu_reason=<reason>`` for the graph to
        route on.

    Returns
    -------
    decorator:
        A decorator that wraps the target node function.
    """

    def decorator(fn: F) -> F:
        @functools.wraps(fn)
        async def wrapper(state: dict[str, Any], *args: Any, **kwargs: Any) -> dict[str, Any]:
            confidence: float = state.get(confidence_key, default_confidence)
            acting_for: str = state.get(acting_for_key, "") if acting_for_key else ""

            # Do NOT use `async with client:` here — that would close the
            # shared httpx client after the first call, breaking subsequent nodes.
            decision = await client.agent_authorize(
                AgentAuthRequest(
                    actor=actor,
                    action=action,
                    context=AgentContext(
                        confidence=confidence,
                        acting_for=acting_for or None,
                    ),
                )
            )

            # ── Human review required ──────────────────────────────────────────
            if decision.requires_human_review:
                logger.info(
                    "lelu: node=%s queued for human review reason=%r",
                    fn.__name__,
                    decision.reason,
                )
                augmented = {
                    **state,
                    _DENIED_KEY: True,
                    _REVIEW_KEY: True,
                    _REASON_KEY: decision.reason,
                }
                return augmented

            # ── Hard deny ─────────────────────────────────────────────────────
            if not decision.allowed:
                msg = (
                    f"Lelu denied action '{action}' for actor '{actor}': "
                    f"{decision.reason}"
                )
                logger.warning("lelu: %s", msg)
                if throw_on_deny:
                    raise PermissionDeniedError(msg, decision.reason)
                return {
                    **state,
                    _DENIED_KEY: True,
                    _REVIEW_KEY: False,
                    _REASON_KEY: decision.reason,
                }

            # ── Authorized ────────────────────────────────────────────────────
            result = await fn(state, *args, **kwargs)
            # Ensure result is a dict (LangGraph nodes must return state updates)
            if not isinstance(result, dict):
                result = {"output": result}
            return {**state, **result, _DENIED_KEY: False}

        return wrapper  # type: ignore[return-value]

    return decorator


# ─── Exceptions ───────────────────────────────────────────────────────────────


class PermissionDeniedError(Exception):
    """Raised by a ``secure_node`` when ``throw_on_deny=True`` and Lelu denies."""

    def __init__(self, message: str, reason: str) -> None:
        super().__init__(message)
        self.reason = reason


# ─── State helpers ────────────────────────────────────────────────────────────


def was_denied(state: dict[str, Any]) -> bool:
    """Return True if the last secure_node was denied."""
    return bool(state.get(_DENIED_KEY, False))


def pending_review(state: dict[str, Any]) -> bool:
    """Return True if the last secure_node was queued for human review."""
    return bool(state.get(_REVIEW_KEY, False))


def denial_reason(state: dict[str, Any]) -> str:
    """Return the denial reason from state, or empty string."""
    return str(state.get(_REASON_KEY, ""))
