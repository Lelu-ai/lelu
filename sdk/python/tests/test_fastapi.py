"""Tests for the FastAPI Authorize() dependency."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from auth_pe.fastapi import Authorize
from auth_pe.models import AgentAuthDecision


def _decision(
    *,
    decision: str,
    reason: str = "ok",
    downgraded_scope: str | None = None,
    safe_tool: str | None = None,
) -> AgentAuthDecision:
    return AgentAuthDecision(
        request_id="req-test",
        tool="invoice:refund",
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
    )


def _client(**kwargs: object) -> MagicMock:
    client = MagicMock()
    client.agent_authorize = AsyncMock(return_value=_decision(**kwargs))
    return client


def _fake_request() -> MagicMock:
    req = MagicMock()
    req.headers = {}
    return req


async def _call_dependency(client: MagicMock) -> AgentAuthDecision:
    dependency = Authorize("invoice:refund", client=client)
    # Depends(_dependency) — the actual async function is the callable's dependency.
    return await dependency.dependency(_fake_request())


@pytest.mark.asyncio
async def test_authorize_passes_through_on_clean_allow() -> None:
    client = _client(decision="allow")
    result = await _call_dependency(client)
    assert result.allowed is True


@pytest.mark.asyncio
async def test_authorize_raises_403_on_deny() -> None:
    client = _client(decision="deny", reason="policy blocked")
    with pytest.raises(HTTPException) as exc_info:
        await _call_dependency(client)
    assert exc_info.value.status_code == 403


# `decision.allowed` is also true for a scope downgrade or a compute redirect
# — neither means "let the endpoint run unrestricted." A dependency that
# only checked `not decision.allowed` would let the endpoint run in both
# cases. This is the invariant that matters most: for every outcome other
# than a clean allow, the endpoint must never run — i.e. this dependency
# must raise.


@pytest.mark.asyncio
async def test_authorize_raises_403_on_scope_downgrade() -> None:
    client = _client(
        decision="allow",
        reason="confidence below full-permission threshold",
        downgraded_scope="read_only",
    )
    with pytest.raises(HTTPException) as exc_info:
        await _call_dependency(client)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["downgraded_scope"] == "read_only"


@pytest.mark.asyncio
async def test_authorize_raises_403_on_compute_redirect() -> None:
    client = _client(
        decision="compute",
        reason="redirected to sandbox",
        safe_tool="invoice_refund_sandbox",
    )
    with pytest.raises(HTTPException) as exc_info:
        await _call_dependency(client)
    assert exc_info.value.status_code == 403
