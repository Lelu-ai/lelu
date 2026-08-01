"""Tests for AgentMiddleware.authorize_action()."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from auth_pe.middleware import AgentMiddleware
from auth_pe.models import AgentAuthDecision


class _ConcreteMiddleware(AgentMiddleware):
    """Minimal concrete subclass — the abstract methods aren't exercised here."""

    def extract_confidence_score(self, llm_response: Any) -> float:
        return 0.9

    def intercept_tool_call(self, tool: Any, context: dict[str, Any]) -> Any:
        raise NotImplementedError


def _decision(
    *,
    decision: str,
    downgraded_scope: str | None = None,
    safe_tool: str | None = None,
) -> AgentAuthDecision:
    return AgentAuthDecision(
        request_id="req-test",
        tool="db:delete",
        decision=decision,
        reason="ok",
        rule="default",
        latency_ms=1.0,
        mode="live",
        timestamp="2024-01-01T00:00:00Z",
        confidence_used=0.85,
        trace_id="trace-test",
        downgraded_scope=downgraded_scope,
        safe_tool=safe_tool,
    )


def _middleware(**decision_kwargs: object) -> _ConcreteMiddleware:
    client = MagicMock()
    client.agent_authorize = AsyncMock(return_value=_decision(**decision_kwargs))
    return _ConcreteMiddleware(client=client, agent_id="invoice_bot")


@pytest.mark.asyncio
async def test_authorize_action_true_on_clean_allow() -> None:
    mw = _middleware(decision="allow")
    assert await mw.authorize_action("db:delete", {}, 0.9) is True


@pytest.mark.asyncio
async def test_authorize_action_false_on_deny() -> None:
    mw = _middleware(decision="deny")
    assert await mw.authorize_action("db:delete", {}, 0.2) is False


# `decision.allowed` is also true for a scope downgrade or a compute redirect
# — neither means the caller should proceed as requested. A middleware that
# only checked `not decision.allowed` would return True (proceed) in both
# cases. This is the invariant that matters most: for every outcome other
# than a clean allow, this must return False.


@pytest.mark.asyncio
async def test_authorize_action_false_on_scope_downgrade() -> None:
    mw = _middleware(decision="allow", downgraded_scope="read_only")
    assert await mw.authorize_action("db:delete", {}, 0.75) is False


@pytest.mark.asyncio
async def test_authorize_action_false_on_compute_redirect() -> None:
    mw = _middleware(decision="compute", safe_tool="db_delete_sandbox")
    assert await mw.authorize_action("db:delete", {}, 0.6) is False
