"""Tests for the Python SDK — LeluClient."""

from __future__ import annotations

import pytest
import httpx
from pytest_httpx import HTTPXMock

from lelu import (
    AuthDecision,
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
    """Build the engine's /v1/agent/authorize response shape from a decision string."""
    return {
        "allowed": decision == "allow",
        "requires_human_review": decision == "human_review",
        "compute": decision == "compute",
        "reason": reason,
        "trace_id": req_id,
        "confidence_used": 0,
    }


# ─── POST /v1/agent/authorize ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_authorize_allowed(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
        json=_authorize_response(decision="allow", req_id="t1"),
    )
    dec = await client.authorize(AuthorizeRequest(tool="approve_refunds"))
    assert dec.allowed is True
    assert dec.request_id == "t1"


@pytest.mark.asyncio
async def test_authorize_denied(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
        json=_authorize_response(decision="deny", reason="denied", req_id="t2"),
    )
    dec = await client.authorize(AuthorizeRequest(tool="delete_invoices"))
    assert dec.allowed is False
    assert dec.requires_human_review is False


@pytest.mark.asyncio
async def test_authorize_human_review(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
        json=_authorize_response(decision="human_review", reason="needs approval", req_id="t3"),
    )
    dec = await client.authorize(AuthorizeRequest(tool="wire_transfer"))
    assert dec.allowed is False
    assert dec.requires_human_review is True


@pytest.mark.asyncio
async def test_authorize_compute(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    response = _authorize_response(decision="compute", reason="Redirected to sandbox", req_id="t-compute")
    response["safe_tool"] = "write_file"
    response["safe_args"] = {"path": "/tmp/sandbox/config.yaml", "sandboxed": True}
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
        json=response,
    )
    dec = await client.authorize(AuthorizeRequest(tool="write_file", args={"path": "/prod/config.yaml"}))
    assert dec.decision == "compute"
    assert dec.computed is True
    assert dec.allowed is False
    assert dec.requires_human_review is False
    assert dec.safe_tool == "write_file"
    assert dec.safe_args == {"path": "/tmp/sandbox/config.yaml", "sandboxed": True}


@pytest.mark.asyncio
async def test_authorize_http_error(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(status_code=500, json={"error": "internal server error"})
    with pytest.raises(AuthEngineError) as exc_info:
        await client.authorize(AuthorizeRequest(tool="some_tool"))
    assert exc_info.value.status == 500


# ─── agent_authorize (wrapper around /v1/agent/authorize) ─────────────────────


@pytest.mark.asyncio
async def test_agent_authorize_full_confidence(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
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
async def test_agent_authorize_forwards_actor(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    import json

    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
        json=_authorize_response(decision="allow", req_id="t-actor"),
    )
    await client.agent_authorize(
        AgentAuthRequest(
            actor="invoice_bot",
            action="approve_refunds",
            context=AgentContext(confidence=0.95),
        )
    )
    body = json.loads(httpx_mock.get_requests()[0].content)
    assert body["actor"] == "invoice_bot"
    assert body["action"] == "approve_refunds"


@pytest.mark.asyncio
async def test_agent_authorize_human_review(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
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
        url="http://localhost:8080/v1/agent/authorize",
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


# ─── GET /healthz ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_is_healthy_true(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url="http://localhost:8080/healthz",
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
        url="http://localhost:8080/healthz",
        json={"status": "ok"},
    )
    # Explicit base_url so zero-config discovery of a real local engine
    # can never redirect this test away from the mock.
    async with LeluClient(base_url="http://localhost:8080") as lelu:
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


# ─── Approval redemption (POST /v1/queue/{id}/redeem) ─────────────────────────
#
# Waiting for "approved" only tells you a reviewer said yes to something.
# Redemption is what binds that yes to the request you then execute.


@pytest.mark.asyncio
async def test_redeem_review_allowed(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/queue/rev-1/redeem",
        json={"allowed": True, "reason": "payload matches the approved request",
              "review_id": "rev-1", "trace_id": "tr-1"},
    )
    res = await client.redeem_review("rev-1", AuthorizeRequest(tool="approve_refunds"))
    assert res.allowed is True
    assert res.review_id == "rev-1"


@pytest.mark.asyncio
async def test_redeem_review_refusal_is_a_result_not_an_exception(
    client: LeluClient, httpx_mock: HTTPXMock
) -> None:
    # The engine answers a mismatched payload with 403 and a reason. That's an
    # answer, not a transport failure — the caller shouldn't have to catch an
    # exception to learn their payload changed.
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/queue/rev-1/redeem",
        status_code=403,
        json={"allowed": False, "reason": "payload does not match what was approved",
              "review_id": "rev-1", "trace_id": "tr-2"},
    )
    res = await client.redeem_review("rev-1", AuthorizeRequest(tool="approve_refunds"))
    assert res.allowed is False
    assert "does not match" in res.reason


@pytest.mark.asyncio
async def test_redeem_sends_the_same_body_as_authorize(
    client: LeluClient, httpx_mock: HTTPXMock
) -> None:
    # The engine fingerprints this body to bind the approval. If authorize and
    # redeem serialised it differently, an untouched request would fail
    # redemption for reasons invisible to the caller — so they must match.
    req = AuthorizeRequest(
        tool="approve_refunds",
        actor="invoice_bot",
        args={"amount_usd": 100},
        resource={"invoice": "INV-1"},
    )
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
        json=_authorize_response(decision="human_review", req_id="rev-9"),
    )
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/queue/rev-9/redeem",
        json={"allowed": True, "reason": "ok", "review_id": "rev-9", "trace_id": "t"},
    )

    await client.authorize(req)
    await client.redeem_review("rev-9", req)

    requests = httpx_mock.get_requests()
    authorize_body = requests[0].read()
    redeem_body = requests[1].read()
    assert authorize_body == redeem_body


@pytest.mark.asyncio
async def test_wait_and_redeem_approved(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="GET",
        url="http://localhost:8080/v1/queue/rev-2/wait?timeout_ms=30000",
        json={"id": "rev-2", "status": "approved", "actor": "invoice_bot"},
    )
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/queue/rev-2/redeem",
        json={"allowed": True, "reason": "ok", "review_id": "rev-2", "trace_id": "t"},
    )
    res = await client.wait_and_redeem("rev-2", AuthorizeRequest(tool="approve_refunds"))
    assert res.allowed is True


@pytest.mark.asyncio
async def test_wait_and_redeem_still_pending_does_not_redeem(
    client: LeluClient, httpx_mock: HTTPXMock
) -> None:
    # Only the wait is mocked. If wait_and_redeem tried to redeem an
    # unresolved review, the missing mock would surface it.
    httpx_mock.add_response(
        method="GET",
        url="http://localhost:8080/v1/queue/rev-3/wait?timeout_ms=30000",
        status_code=408,
        json={"id": "rev-3", "status": "pending", "actor": "invoice_bot"},
    )
    res = await client.wait_and_redeem("rev-3", AuthorizeRequest(tool="approve_refunds"))
    assert res.allowed is False
    assert "pending" in res.reason


@pytest.mark.asyncio
async def test_wait_and_redeem_denied_does_not_redeem(
    client: LeluClient, httpx_mock: HTTPXMock
) -> None:
    httpx_mock.add_response(
        method="GET",
        url="http://localhost:8080/v1/queue/rev-4/wait?timeout_ms=30000",
        json={"id": "rev-4", "status": "denied", "actor": "invoice_bot"},
    )
    res = await client.wait_and_redeem("rev-4", AuthorizeRequest(tool="approve_refunds"))
    assert res.allowed is False
    assert "denied" in res.reason


# ─── Review handle resolution ─────────────────────────────────────────────────
#
# A decision carries request_id (trace) and review_id (queue key). Reaching for
# "the request's ID" gets the wrong one, and the only symptom is a redemption
# that mysteriously fails. Accepting the decision object removes the choice.


def _human_review_decision(review_id: str | None = "rev-1") -> AuthDecision:
    return AuthDecision(
        request_id="trace-not-a-review-handle",
        tool="approve_refunds",
        decision="human_review",
        reason="queued",
        rule="r",
        latency_ms=1.0,
        mode="live",
        timestamp="2026-01-01T00:00:00Z",
        review_id=review_id,
    )


@pytest.mark.asyncio
async def test_redeem_accepts_the_decision_object(
    client: LeluClient, httpx_mock: HTTPXMock
) -> None:
    # The URL asserts it used review_id, not request_id: a mock registered for
    # /rev-1/redeem simply won't match if the trace ID leaked through.
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/queue/rev-1/redeem",
        json={"allowed": True, "reason": "ok", "review_id": "rev-1", "trace_id": "t"},
    )
    res = await client.redeem_review(
        _human_review_decision(), AuthorizeRequest(tool="approve_refunds")
    )
    assert res.allowed is True


@pytest.mark.asyncio
async def test_redeem_still_accepts_a_raw_review_id(
    client: LeluClient, httpx_mock: HTTPXMock
) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/queue/rev-7/redeem",
        json={"allowed": True, "reason": "ok", "review_id": "rev-7", "trace_id": "t"},
    )
    res = await client.redeem_review("rev-7", AuthorizeRequest(tool="approve_refunds"))
    assert res.allowed is True


@pytest.mark.asyncio
async def test_redeem_rejects_a_decision_with_no_review_id() -> None:
    # An "allow" decision was never queued, so there's nothing to redeem.
    # Failing here beats sending an empty path segment to the engine.
    client = LeluClient(base_url="http://localhost:8080")
    with pytest.raises(ValueError, match="no review_id"):
        await client.redeem_review(
            _human_review_decision(review_id=None), AuthorizeRequest(tool="x")
        )
    await client.aclose()
