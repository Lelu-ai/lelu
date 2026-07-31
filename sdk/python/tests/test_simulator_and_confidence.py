"""Tests for the Python SDK — simulator_replay() and LeluClient.confidence_from."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from pytest_httpx import HTTPXMock

from lelu import LeluClient, SimulatorReplayRequest, SimulatorTraceItem


@pytest.fixture
def client() -> LeluClient:
    return LeluClient(base_url="http://localhost:8080")


# ─── POST /v1/simulator/replay ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_simulator_replay(client: LeluClient, httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        method="POST",
        url="http://localhost:8080/v1/simulator/replay",
        json={
            "summary": {
                "total": 1,
                "changed": 1,
                "allow_to_deny": 1,
                "allow_to_review": 0,
                "review_to_deny": 0,
                "deny_to_allow": 0,
                "review_to_allow": 0,
                "deny_to_review": 0,
                "other_changes": 0,
            },
            "items": [
                {
                    "index": 0,
                    "kind": "agent",
                    "action": "refund:process",
                    "changed": True,
                    "before": {
                        "allowed": True,
                        "requires_human_review": False,
                        "reason": "ok",
                        "outcome": "allow",
                    },
                    "after": {
                        "allowed": False,
                        "requires_human_review": False,
                        "reason": "new policy denies",
                        "outcome": "deny",
                    },
                }
            ],
        },
    )
    req = SimulatorReplayRequest(
        proposed_policy_yaml="rules: []",
        traces=[
            SimulatorTraceItem(kind="agent", tenant_id="t1", action="refund:process"),
        ],
    )
    result = await client.simulator_replay(req)
    assert result.summary.total == 1
    assert result.summary.allow_to_deny == 1
    assert result.items[0].changed is True
    assert result.items[0].after.outcome == "deny"


# ─── LeluClient.confidence_from ────────────────────────────────────────────────


def test_confidence_from_openai() -> None:
    response = SimpleNamespace(
        choices=[
            SimpleNamespace(
                logprobs=SimpleNamespace(
                    content=[SimpleNamespace(logprob=-0.1), SimpleNamespace(logprob=-0.2)]
                )
            )
        ]
    )
    score = LeluClient.confidence_from.openai(response)
    assert score is not None
    assert 0.0 <= score <= 1.0


def test_confidence_from_openai_no_logprobs() -> None:
    response = SimpleNamespace(choices=[SimpleNamespace(logprobs=None)])
    assert LeluClient.confidence_from.openai(response) is None


def test_confidence_from_anthropic_always_none() -> None:
    assert LeluClient.confidence_from.anthropic(object()) is None


def test_confidence_from_bedrock_dict_logprobs() -> None:
    score = LeluClient.confidence_from.bedrock({"logprobs": [-0.1, -0.2, -0.05]})
    assert score is not None
    assert 0.0 <= score <= 1.0


def test_confidence_from_bedrock_cohere_token_likelihoods() -> None:
    response = {
        "generations": [{"token_likelihoods": [{"likelihood": -0.1}, {"likelihood": -0.3}]}]
    }
    score = LeluClient.confidence_from.bedrock(response)
    assert score is not None
    assert 0.0 <= score <= 1.0


def test_confidence_from_bedrock_no_signal_returns_none() -> None:
    # e.g. Claude on Bedrock — no token-level data exposed.
    assert LeluClient.confidence_from.bedrock({"generations": [{}]}) is None
    assert LeluClient.confidence_from.bedrock({}) is None
