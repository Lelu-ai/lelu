"""Tests for the Python SDK — LeluClient."""

from __future__ import annotations

import pytest
import httpx
from pytest_httpx import HTTPXMock

from lelu import (
    AgentAuthRequest,
    AgentContext,
    AuthEngineError,
    AuthorizeRequest,
    DelegateScopeRequest,
    LeluClient,
    MintTokenRequest,
)


# ─── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def client() -> LeluClient:
    return LeluClient(base_url="http://localhost:8080")


def _authorize_response(decision: str = "allow", reason: str = "ok", req_id: str = "req-1") -> dict:
    return {
        "requestId": req_id,
        "tool": "test_tool",
        "decision": decision,
        "reason": reason,
        "rule": "default",
        "latencyMs": 1.5,
        "mode": "live",
        "timestamp": "2024-01-01T00:00:00Z",
    }


# ─── POST /api/v1/authorize ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_authorize_allowed(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/api/v1/authorize",
        json=_authorize_response(decision="allow", req_id="t1"),
    )
    dec = await client.authorize(AuthorizeRequest(tool="approve_refunds"))
    assert dec.allowed is True
    assert dec.request_id == "t1"


@pytest.mark.asyncio
async def test_authorize_denied(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/api/v1/authorize",
        json=_authorize_response(decision="deny", reason="denied", req_id="t2"),
    )
    dec = await client.authorize(AuthorizeRequest(tool="delete_invoices"))
    assert dec.allowed is False
    assert dec.requires_human_review is False


@pytest.mark.asyncio
async def test_authorize_human_review(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/api/v1/authorize",
        json=_authorize_response(decision="human_review", reason="needs approval", req_id="t3"),
    )
    dec = await client.authorize(AuthorizeRequest(tool="wire_transfer"))
    assert dec.allowed is False
    assert dec.requires_human_review is True


@pytest.mark.asyncio
async def test_authorize_http_error(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(status_code=500, json={"error": "internal server error"})
    with pytest.raises(AuthEngineError) as exc_info:
        await client.authorize(AuthorizeRequest(tool="some_tool"))
    assert exc_info.value.status == 500


# ─── agent_authorize (wrapper around /api/v1/authorize) ───────────────────────


@pytest.mark.asyncio
async def test_agent_authorize_full_confidence(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/api/v1/authorize",
        json=_authorize_response(decision="allow", req_id="t4"),
    )
    dec = await client.agent_authorize(
        AgentAuthRequest(
            actor="invoice_bot",
            action="approve_refunds",
            context=AgentContext(confidence=0.95, acting_for="user_123"),
        )
    )
    assert dec.allowed is True
    assert dec.requires_human_review is False
    assert dec.confidence_used == pytest.approx(0.95)


@pytest.mark.asyncio
async def test_agent_authorize_human_review(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/api/v1/authorize",
        json=_authorize_response(decision="human_review", reason="requires human approval", req_id="t5"),
    )
    dec = await client.agent_authorize(
        AgentAuthRequest(
            actor="invoice_bot",
            action="approve_refunds",
            context=AgentContext(confidence=0.80),
        )
    )
    assert dec.requires_human_review is True
    assert dec.allowed is False


@pytest.mark.asyncio
async def test_agent_authorize_denied(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/api/v1/authorize",
        json=_authorize_response(decision="deny", reason="denied by policy", req_id="t6"),
    )
    dec = await client.agent_authorize(
        AgentAuthRequest(
            actor="invoice_bot",
            action="approve_refunds",
            context=AgentContext(confidence=0.65),
        )
    )
    assert dec.allowed is False
    assert dec.requires_human_review is False


def test_agent_context_validates_confidence_range() -> None:
    with pytest.raises(Exception):
        AgentContext(confidence=1.5)


# ─── POST /v1/tokens/mint ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_mint_token(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    import time
    expires_at = int(time.time()) + 60
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/tokens/mint",
        json={"token": "jwt.token.here", "token_id": "tid1", "expires_at": expires_at},
    )
    result = await client.mint_token(MintTokenRequest(scope="invoice_bot", acting_for="user_123"))
    assert result.token == "jwt.token.here"
    assert result.token_id == "tid1"


# ─── DELETE /v1/tokens/{id} ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_revoke_token(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="DELETE",
        url="http://localhost:8080/v1/tokens/tid1",
        json={"success": True},
    )
    result = await client.revoke_token("tid1")
    assert result.success is True


# ─── GET /api/config-check ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_is_healthy_true(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url="http://localhost:8080/api/config-check",
        json={"status": "ok"},
    )
    assert await client.is_healthy() is True


@pytest.mark.asyncio
async def test_is_healthy_false_on_error(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_exception(httpx.ConnectError("refused"))
    assert await client.is_healthy() is False


# ─── Context manager ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_context_manager(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url="http://localhost:8080/api/config-check",
        json={"status": "ok"},
    )
    async with LeluClient() as lelu:
        assert await lelu.is_healthy() is True


# ─── POST /v1/agent/delegate ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delegate_scope(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    import time

    expires_at = int(time.time()) + 120
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/agent/delegate",
        json={
            "token": "child.jwt.token",
            "token_id": "dtid1",
            "expires_at": expires_at,
            "delegator": "orchestrator_agent",
            "delegatee": "research_agent",
            "granted_scopes": ["research"],
            "trace_id": "td1",
        },
    )
    result = await client.delegate_scope(
        DelegateScopeRequest(
            delegator="orchestrator_agent",
            delegatee="research_agent",
            scoped_to=["research"],
            confidence=0.92,
        )
    )
    assert result.token == "child.jwt.token"
    assert result.token_id == "dtid1"
    assert result.delegator == "orchestrator_agent"
    assert result.delegatee == "research_agent"
    assert result.granted_scopes == ["research"]
    assert result.trace_id == "td1"


@pytest.mark.asyncio
async def test_delegate_scope_http_error(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/agent/delegate",
        status_code=403,
        json={"error": "delegation denied by policy"},
    )
    with pytest.raises(AuthEngineError) as exc_info:
        await client.delegate_scope(
            DelegateScopeRequest(
                delegator="orchestrator_agent",
                delegatee="research_agent",
            )
        )
    assert exc_info.value.status == 403


def test_delegate_scope_validates_confidence_range() -> None:
    with pytest.raises(Exception):
        DelegateScopeRequest(
            delegator="orch",
            delegatee="bot",
            confidence=1.5,
        )
