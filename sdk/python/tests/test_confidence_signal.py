"""Tests for ``ConfidenceSignal``, ``LeluClient.signal_from``, and strict-engine gating (#121)."""

from __future__ import annotations

import json
import math
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
from pydantic import ValidationError
from pytest_httpx import HTTPXMock

from lelu import (
    AgentAuthRequest,
    AgentContext,
    AuthorizeRequest,
    ConfidenceProvider,
    ConfidenceSignal,
    LeluClient,
    SignalFrom,
    SimulatorReplayRequest,
    SimulatorTraceItem,
)


@pytest.fixture
def client() -> LeluClient:
    return LeluClient(base_url="http://localhost:8080")


def _strict_engine_callback(request: httpx.Request) -> httpx.Response:
    """Simulates a Lelu engine in its default strict mode (`CONFIDENCE_ALLOW_UNVERIFIED=false`,
    `CONFIDENCE_MISSING_MODE=deny`), mirroring `server.go#resolveConfidence` and
    `confidence/extract.go#ExtractScore`.
    """
    body = json.loads(request.content.decode("utf-8"))
    sig = body.get("confidence_signal")

    # Without `confidence_signal`, strict mode ignores self-reported `confidence`
    # and falls back to `MissingSignalMode=deny`.
    if sig is None:
        return httpx.Response(
            status_code=200,
            json={
                "allowed": False,
                "requires_human_review": False,
                "reason": (
                    "no confidence signal detected; request denied — pass a "
                    "confidence_signal derived from your LLM provider's response"
                ),
                "trace_id": "trace-missing-signal",
                "confidence_used": 0.0,
                "provider_signal_present": False,
            },
        )

    provider = sig.get("provider")
    if provider == "openai":
        lps = sig["token_logprobs"]
        score = sum(max(0.0, min(1.0, math.exp(lp))) for lp in lps) / len(lps)
    elif provider == "bedrock":
        if "token_logprobs" in sig:
            lps = sig["token_logprobs"]
            score = sum(max(0.0, min(1.0, math.exp(lp))) for lp in lps) / len(lps)
        else:
            probs = sig["token_probabilities"]
            score = sum(probs) / len(probs)
    elif provider == "local":
        if "token_probabilities" in sig:
            probs = sig["token_probabilities"]
            score = sum(probs) / len(probs)
        else:
            max_ent = sig.get("entropy_max") or 1.0
            score = max(0.0, min(1.0, 1.0 - (sig["entropy"] / max_ent)))
    else:
        return httpx.Response(
            status_code=400,
            json={"error": f"confidence: unsupported confidence provider {provider!r}"},
        )

    if score >= 0.90:
        return httpx.Response(
            status_code=200,
            json={
                "allowed": True,
                "requires_human_review": False,
                "reason": "confidence meets full-permission threshold",
                "trace_id": "trace-allow",
                "confidence_used": score,
                "provider_signal_present": True,
            },
        )
    if score >= 0.70:
        return httpx.Response(
            status_code=200,
            json={
                "allowed": False,
                "requires_human_review": True,
                "review_id": "rev-strict-1",
                "reason": "confidence requires human approval",
                "trace_id": "trace-review",
                "confidence_used": score,
                "provider_signal_present": True,
            },
        )
    return httpx.Response(
        status_code=200,
        json={
            "allowed": False,
            "requires_human_review": False,
            "reason": "confidence below threshold",
            "trace_id": "trace-deny",
            "confidence_used": score,
            "provider_signal_present": True,
        },
    )


# ─── Strict engine gating (POST /v1/agent/authorize) ──────────────────────────


@pytest.mark.asyncio
async def test_strict_engine_rejects_request_without_signal(
    client: LeluClient, httpx_mock: HTTPXMock
) -> None:
    httpx_mock.add_callback(
        _strict_engine_callback,
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
    )
    decision = await client.authorize(
        AuthorizeRequest(tool="invoice:create", actor="invoice_bot")
    )
    assert decision.allowed is False
    assert decision.decision == "deny"
    assert "no confidence signal detected" in decision.reason

    sent = json.loads(httpx_mock.get_requests()[0].content)
    assert "confidence_signal" not in sent
    assert "confidence" not in sent


@pytest.mark.asyncio
async def test_strict_engine_rejects_request_with_only_unverified_confidence(
    client: LeluClient, httpx_mock: HTTPXMock
) -> None:
    # Self-reported confidence=0.99 is ignored when CONFIDENCE_ALLOW_UNVERIFIED=false.
    httpx_mock.add_callback(
        _strict_engine_callback,
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
    )
    decision = await client.authorize(
        AuthorizeRequest(
            tool="invoice:create",
            actor="invoice_bot",
            context=AgentContext(confidence=0.99),
        )
    )
    assert decision.allowed is False
    assert decision.decision == "deny"
    assert "no confidence signal detected" in decision.reason

    sent = json.loads(httpx_mock.get_requests()[0].content)
    assert sent["confidence"] == 0.99
    assert "confidence_signal" not in sent


@pytest.mark.asyncio
async def test_strict_engine_allows_request_with_openai_signal(
    client: LeluClient, httpx_mock: HTTPXMock
) -> None:
    httpx_mock.add_callback(
        _strict_engine_callback,
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
    )
    openai_resp = SimpleNamespace(
        choices=[
            SimpleNamespace(
                logprobs=SimpleNamespace(
                    content=[SimpleNamespace(logprob=-0.02), SimpleNamespace(logprob=-0.04)]
                )
            )
        ]
    )
    sig = client.signal_from.openai(openai_resp)
    assert sig is not None

    decision = await client.authorize(
        AuthorizeRequest(
            tool="invoice:create",
            actor="invoice_bot",
            context=AgentContext(confidence_signal=sig),
        )
    )
    assert decision.allowed is True
    assert decision.decision == "allow"
    assert decision.confidence_used > 0.90

    sent = json.loads(httpx_mock.get_requests()[0].content)
    assert sent["confidence_signal"] == {
        "provider": "openai",
        "token_logprobs": [-0.02, -0.04],
    }


@pytest.mark.asyncio
async def test_strict_engine_accepts_bedrock_and_local_signals(
    client: LeluClient, httpx_mock: HTTPXMock
) -> None:
    httpx_mock.add_callback(
        _strict_engine_callback,
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
        is_reusable=True,
    )
    bedrock_sig = LeluClient.signal_from.bedrock(
        {"generations": [{"token_likelihoods": [{"likelihood": -0.20}, {"likelihood": -0.24}]}]}
    )
    assert bedrock_sig is not None
    review_dec = await client.authorize(
        AuthorizeRequest(
            tool="refund:process",
            actor="invoice_bot",
            context=AgentContext(confidence_signal=bedrock_sig),
        )
    )
    assert review_dec.decision == "human_review"
    assert review_dec.review_id == "rev-strict-1"

    local_sig = LeluClient.signal_from.local(entropy=0.05, entropy_max=2.0)
    assert local_sig is not None
    allow_dec = await client.authorize(
        AuthorizeRequest(
            tool="refund:process",
            actor="invoice_bot",
            context=AgentContext(signal=local_sig),
        )
    )
    assert allow_dec.allowed is True

    requests = httpx_mock.get_requests()
    assert json.loads(requests[0].content)["confidence_signal"] == {
        "provider": "bedrock",
        "token_logprobs": [-0.20, -0.24],
    }
    assert json.loads(requests[1].content)["confidence_signal"] == {
        "provider": "local",
        "entropy": 0.05,
        "entropy_max": 2.0,
    }


# ─── Redemption body parity (/v1/queue/{id}/redeem) & legacy wrapper ──────────


@pytest.mark.asyncio
async def test_redeem_review_sends_identical_confidence_signal_body_as_authorize(
    client: LeluClient, httpx_mock: HTTPXMock
) -> None:
    sig = ConfidenceSignal(provider="openai", token_logprobs=[-0.20, -0.22])
    req = AuthorizeRequest(
        tool="approve_refunds",
        actor="invoice_bot",
        args={"amount_usd": 100},
        resource={"invoice": "INV-1"},
        context=AgentContext(confidence_signal=sig, acting_for="user_1"),
    )
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
        json={
            "allowed": False,
            "requires_human_review": True,
            "review_id": "rev-9",
            "reason": "queued",
            "trace_id": "t-9",
        },
    )
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/queue/rev-9/redeem",
        json={"allowed": True, "reason": "ok", "review_id": "rev-9", "trace_id": "t-10"},
    )

    dec = await client.authorize(req)
    res = await client.redeem_review(dec, req)
    assert res.allowed is True

    sent_authorize, sent_redeem = httpx_mock.get_requests()
    assert sent_authorize.read() == sent_redeem.read()


@pytest.mark.asyncio
async def test_agent_authorize_forwards_confidence_signal(
    client: LeluClient, httpx_mock: HTTPXMock
) -> None:
    httpx_mock.add_callback(
        _strict_engine_callback,
        method="POST",
        url="http://localhost:8080/v1/agent/authorize",
    )
    sig = ConfidenceSignal(provider="local", token_probabilities=[0.95, 0.96])
    dec = await client.agent_authorize(
        AgentAuthRequest(
            actor="invoice_bot",
            action="approve_refunds",
            context=AgentContext(confidence_signal=sig),
        )
    )
    assert dec.allowed is True
    sent = json.loads(httpx_mock.get_requests()[0].content)
    assert sent["confidence_signal"] == {
        "provider": "local",
        "token_probabilities": [0.95, 0.96],
    }


# ─── SimulatorTraceItem.confidence_signal ─────────────────────────────────────


@pytest.mark.asyncio
async def test_simulator_replay_serializes_confidence_signal(
    client: LeluClient, httpx_mock: HTTPXMock
) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/simulator/replay",
        json={
            "summary": {
                "total": 1,
                "changed": 0,
                "allow_to_deny": 0,
                "allow_to_review": 0,
                "review_to_deny": 0,
                "deny_to_allow": 0,
                "review_to_allow": 0,
                "deny_to_review": 0,
                "other_changes": 0,
            },
            "items": [],
        },
    )
    sig = ConfidenceSignal(provider="openai", token_logprobs=[-0.02, -0.05])
    await client.simulator_replay(
        SimulatorReplayRequest(
            proposed_policy_yaml="rules: []",
            traces=[
                SimulatorTraceItem(
                    kind="agent",
                    tenant_id="default",
                    actor="invoice_bot",
                    action="refund:process",
                    confidence_signal=sig,
                )
            ],
        )
    )
    sent = json.loads(httpx_mock.get_requests()[0].content)
    assert sent["traces"][0]["confidence_signal"] == {
        "provider": "openai",
        "token_logprobs": [-0.02, -0.05],
    }
    assert "confidence" not in sent["traces"][0]


# ─── SignalFrom builders (openai, anthropic, bedrock, local) ──────────────────


def test_signal_from_openai_dict_and_missing_logprobs() -> None:
    sig = LeluClient.signal_from.openai(
        {"choices": [{"logprobs": {"content": [{"logprob": -0.01}, {"logprob": -0.03}]}}]}
    )
    assert sig is not None
    assert sig.provider == "openai"
    assert sig.token_logprobs == [-0.01, -0.03]
    assert sig.extract_score() == pytest.approx((math.exp(-0.01) + math.exp(-0.03)) / 2)

    assert LeluClient.signal_from.openai({"choices": [{"logprobs": None}]}) is None
    assert LeluClient.signal_from.openai({"choices": [{}]}) is None
    assert LeluClient.signal_from.openai({}) is None
    assert LeluClient.signal_from.openai(None) is None


def test_signal_from_anthropic_returns_none_and_provider_rejected() -> None:
    assert LeluClient.signal_from.anthropic({"anything": True}) is None
    with pytest.raises(ValidationError):
        ConfidenceSignal(provider="anthropic", token_logprobs=[-0.1])  # type: ignore[arg-type]


def test_signal_from_bedrock_shapes_and_claude_none() -> None:
    s_raw = SignalFrom.bedrock({"logprobs": [-0.05, -0.10]})
    assert s_raw == ConfidenceSignal(provider="bedrock", token_logprobs=[-0.05, -0.10])

    cohere_obj = SimpleNamespace(
        generations=[
            SimpleNamespace(
                token_likelihoods=[
                    SimpleNamespace(likelihood=-0.02),
                    SimpleNamespace(likelihood=-0.06),
                ]
            )
        ]
    )
    s_cohere = SignalFrom.bedrock(cohere_obj)
    assert s_cohere == ConfidenceSignal(provider="bedrock", token_logprobs=[-0.02, -0.06])

    s_probs = SignalFrom.bedrock({"token_probabilities": [0.92, 0.96]})
    assert s_probs == ConfidenceSignal(provider="bedrock", token_probabilities=[0.92, 0.96])
    assert s_probs.extract_score() == pytest.approx(0.94)

    # Claude on Bedrock exposes no token logprobs
    assert SignalFrom.bedrock({"generations": [{"token_likelihoods": None}]}) is None
    assert SignalFrom.bedrock({}) is None


def test_signal_from_local_kwargs_and_typescript_dict() -> None:
    s_probs = SignalFrom.local({"tokenProbabilities": [0.91, 0.95]})
    assert s_probs is not None
    assert s_probs.to_wire_dict() == {
        "provider": "local",
        "token_probabilities": [0.91, 0.95],
    }

    s_ent = SignalFrom.local({"entropy": 0.2, "entropyMax": 2.0})
    assert s_ent is not None
    assert s_ent.to_wire_dict() == {
        "provider": "local",
        "entropy": 0.2,
        "entropy_max": 2.0,
    }
    assert s_ent.extract_score() == pytest.approx(0.90)

    assert SignalFrom.local({}) is None
    assert SignalFrom.local() is None


# ─── Model naming, aliases, validation & deprecation ──────────────────────────


def test_agent_context_canonical_name_and_signal_input_alias() -> None:
    sig = ConfidenceSignal(provider="openai", token_logprobs=[-0.02])
    ctx_canonical = AgentContext(confidence_signal=sig)
    ctx_alias = AgentContext.model_validate({"signal": sig})

    assert ctx_canonical.confidence_signal == sig
    assert ctx_alias.confidence_signal == sig
    # Canonical attribute only — no duplicate `.signal` property on the model.
    assert not hasattr(ctx_canonical, "signal")


@pytest.mark.parametrize(
    "bad_kwargs",
    [
        {"provider": "openai"},
        {"provider": "openai", "token_logprobs": []},
        {"provider": "openai", "token_logprobs": [float("nan")]},
        {"provider": "openai", "token_logprobs": [float("inf")]},
        {"provider": "bedrock"},
        {"provider": "bedrock", "token_probabilities": [1.1]},
        {"provider": "bedrock", "token_probabilities": [-0.1]},
        {"provider": "local"},
        {"provider": "local", "entropy": -0.01},
        {"provider": "local", "entropy": 0.1, "entropy_max": 0.0},
    ],
)
def test_confidence_signal_rejects_invalid_or_non_finite_values(
    bad_kwargs: dict[str, Any],
) -> None:
    with pytest.raises(ValidationError):
        ConfidenceSignal(**bad_kwargs)


def test_confidence_from_emits_deprecation_warning_and_stays_compatible() -> None:
    resp = SimpleNamespace(
        choices=[
            SimpleNamespace(
                logprobs=SimpleNamespace(content=[SimpleNamespace(logprob=-0.1)])
            )
        ]
    )
    with pytest.warns(DeprecationWarning, match="signal_from"):
        score = LeluClient.confidence_from.openai(resp)
    assert score == pytest.approx(math.exp(-0.1))

    with pytest.warns(DeprecationWarning, match="signal_from"):
        assert LeluClient.confidence_from.anthropic({}) is None

    with pytest.warns(DeprecationWarning, match="signal_from"):
        b_score = LeluClient.confidence_from.bedrock({"logprobs": [-0.1]})
    assert b_score == pytest.approx(math.exp(-0.1))


def test_re_exports_on_lelu_package() -> None:
    from lelu.models import ConfidenceSignal as ModelsConfidenceSignal

    provider: ConfidenceProvider = "openai"
    sig = ModelsConfidenceSignal(provider=provider, token_logprobs=[-0.05])
    assert isinstance(sig, ConfidenceSignal)
