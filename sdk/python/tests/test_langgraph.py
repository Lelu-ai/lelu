"""Tests for the LangGraph secure_node decorator."""
import pytest
from unittest.mock import AsyncMock, MagicMock

from auth_pe.langgraph import (
    secure_node,
    PermissionDeniedError,
    was_denied,
    pending_review,
    denial_reason,
    review_id,
)
from auth_pe.models import AgentAuthDecision


def _make_decision(
    *,
    decision: str,
    reason: str = "ok",
    downgraded_scope: str | None = None,
    safe_tool: str | None = None,
    review_id: str | None = None,
) -> AgentAuthDecision:
    """Build an AgentAuthDecision with the new required fields."""
    return AgentAuthDecision(
        request_id="req-test",
        tool="test_action",
        decision=decision,
        reason=reason,
        rule="default",
        latency_ms=1.0,
        mode="live",
        timestamp="2024-01-01T00:00:00Z",
        confidence_used=0.85,
        trace_id="trace-test",
        downgraded_scope=downgraded_scope,
        safe_tool=safe_tool,
        review_id=review_id,
    )


def _mock_client(
    *,
    decision: str,
    reason: str = "ok",
    downgraded_scope: str | None = None,
    safe_tool: str | None = None,
    review_id: str | None = None,
) -> MagicMock:
    """Return a mock LeluClient whose agent_authorize returns the given decision."""
    dec = _make_decision(
        decision=decision,
        reason=reason,
        downgraded_scope=downgraded_scope,
        safe_tool=safe_tool,
        review_id=review_id,
    )
    client = MagicMock()
    client.agent_authorize = AsyncMock(return_value=dec)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    return client


@pytest.mark.asyncio
async def test_secure_node_allowed():
    client = _mock_client(decision="allow")

    @secure_node(client=client, actor="invoice_bot", action="invoice:approve")
    async def my_node(state: dict) -> dict:
        return {**state, "result": "done"}

    result = await my_node({"confidence": 0.95})
    assert result["result"] == "done"
    assert result.get("lelu_denied") is False


@pytest.mark.asyncio
async def test_secure_node_denied_silent():
    client = _mock_client(decision="deny", reason="low confidence")

    @secure_node(client=client, actor="invoice_bot", action="invoice:approve")
    async def my_node(state: dict) -> dict:
        pytest.fail("should not execute when denied")

    result = await my_node({"confidence": 0.4})
    assert was_denied(result) is True
    assert pending_review(result) is False
    assert denial_reason(result) == "low confidence"


@pytest.mark.asyncio
async def test_secure_node_denied_throw():
    client = _mock_client(decision="deny", reason="policy violation")

    @secure_node(client=client, actor="invoice_bot", action="invoice:approve", throw_on_deny=True)
    async def my_node(state: dict) -> dict:
        pytest.fail("should not execute")

    with pytest.raises(PermissionDeniedError) as exc_info:
        await my_node({"confidence": 0.4})
    assert exc_info.value.reason == "policy violation"


@pytest.mark.asyncio
async def test_secure_node_requires_human_review():
    client = _mock_client(
        decision="human_review", reason="needs approval", review_id="rev-99"
    )

    @secure_node(client=client, actor="invoice_bot", action="invoice:approve")
    async def my_node(state: dict) -> dict:
        pytest.fail("should not execute when queued for review")

    result = await my_node({"confidence": 0.75})
    assert was_denied(result) is True
    assert pending_review(result) is True
    assert denial_reason(result) == "needs approval"
    assert review_id(result) == "rev-99"


# `decision.allowed` is also true for a scope downgrade or a compute redirect
# — neither means "run the node as requested." A secure_node that branched
# only on `allowed` would run the node unrestricted in both cases. This is
# the invariant that matters most: for every outcome other than a clean
# allow, the wrapped function must never run.


@pytest.mark.asyncio
async def test_secure_node_does_not_run_on_scope_downgrade():
    client = _mock_client(
        decision="allow",
        reason="confidence below full-permission threshold",
        downgraded_scope="read_only",
    )

    @secure_node(client=client, actor="invoice_bot", action="invoice:approve")
    async def my_node(state: dict) -> dict:
        pytest.fail("should not execute on a scope downgrade")

    result = await my_node({"confidence": 0.75})
    assert was_denied(result) is True


@pytest.mark.asyncio
async def test_secure_node_does_not_run_on_compute_redirect():
    client = _mock_client(
        decision="compute",
        reason="redirected to sandbox",
        safe_tool="invoice_approve_sandbox",
    )

    @secure_node(client=client, actor="invoice_bot", action="invoice:approve")
    async def my_node(state: dict) -> dict:
        pytest.fail("should not execute on a compute redirect")

    result = await my_node({"confidence": 0.6})
    assert was_denied(result) is True


@pytest.mark.asyncio
async def test_secure_node_throws_on_downgrade_when_throw_on_deny():
    client = _mock_client(decision="allow", downgraded_scope="read_only")

    @secure_node(
        client=client,
        actor="invoice_bot",
        action="invoice:approve",
        throw_on_deny=True,
    )
    async def my_node(state: dict) -> dict:
        pytest.fail("should not execute on a scope downgrade")

    with pytest.raises(PermissionDeniedError):
        await my_node({"confidence": 0.75})


@pytest.mark.asyncio
async def test_secure_node_default_confidence():
    """When confidence_key is missing, default_confidence is used."""
    client = _mock_client(decision="allow")

    @secure_node(
        client=client,
        actor="bot",
        action="do:thing",
        default_confidence=0.99,
    )
    async def my_node(state: dict) -> dict:
        return state

    result = await my_node({})  # no "confidence" key
    assert not was_denied(result)
    call_args = client.agent_authorize.call_args[0][0]
    assert call_args.context.confidence == 0.99
