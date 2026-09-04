"""Tests for the Strands Agents integration.

Strands is an optional dependency and is not installed in CI, so these tests
exercise the parts that matter without it: the mapping from a Lelu decision to
a Strands outcome, and the adapter that writes that outcome back onto an event.
A fake event object stands in for the framework's ``BeforeToolCallEvent``,
which is enough because the adapter only ever touches three fields.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from auth_pe.models import AuthDecision, AuthorizeRequest
from strands.interventions import Confirm, Deny, Proceed, Transform

from auth_pe.strands import (
    GuardOutcome,
    LeluIntervention,
    ToolCall,
    decide,
    extract_call,
)


def _decision(**overrides):
    """An AuthDecision with the required fields filled in."""
    base = dict(
        request_id="req-1",
        tool="refund",
        decision="allow",
        reason="policy allows",
        rule="r1",
        latency_ms=1.0,
        mode="live",
        timestamp="2026-09-04T00:00:00Z",
    )
    base.update(overrides)
    return AuthDecision(**base)


class _FakeEvent:
    """Stands in for Strands' BeforeToolCallEvent.

    Only tool_use is needed: the handler returns actions rather than mutating
    the event, and the one mutation that does happen (Transform) goes through
    the apply callback, which this exercises directly.
    """

    def __init__(self, name="refund", tool_input=None):
        self.tool_use = {"name": name, "input": tool_input or {}, "toolUseId": "tu-1"}


# ── The decision mapping ─────────────────────────────────────────────────────


def test_allow_lets_the_call_through():
    outcome = decide(_decision(decision="allow"), ToolCall("refund"), "invoice_bot")
    assert outcome.action == "allow"
    assert outcome.allowed


def test_deny_stops_the_call_and_keeps_the_reason():
    outcome = decide(
        _decision(decision="deny", reason="destructive action"), ToolCall("refund"), "invoice_bot"
    )
    assert outcome.action == "deny"
    assert not outcome.allowed
    assert "destructive action" in outcome.message
    assert "invoice_bot" in outcome.message


def test_compute_redirects_to_the_safe_tool():
    outcome = decide(
        _decision(decision="compute", safe_tool="refund_sandbox", safe_args={"dry_run": True}),
        ToolCall("refund"),
        "invoice_bot",
    )
    assert outcome.action == "redirect"
    assert outcome.replacement_tool == "refund_sandbox"
    assert outcome.replacement_args == {"dry_run": True}


def test_human_review_carries_the_review_id():
    """Without the review id the pending item is unreachable — the agent would
    have no way to resume after a human approves."""
    outcome = decide(
        _decision(decision="human_review", review_id="rev-42"), ToolCall("refund"), "invoice_bot"
    )
    assert outcome.action == "review"
    assert outcome.review_id == "rev-42"


def test_compute_is_checked_before_allowed():
    """A compute decision reports allowed=False for the tool that was asked
    for. Reading `allowed` first would turn a redirect into a denial."""
    outcome = decide(
        _decision(decision="compute", safe_tool="refund_sandbox"), ToolCall("refund"), "bot"
    )
    assert outcome.action == "redirect"


# ── The adapter ──────────────────────────────────────────────────────────────


def test_extract_call_reads_the_tool_use():
    call = extract_call(_FakeEvent("refund", {"amount": 10}))
    assert call.name == "refund"
    assert call.arguments == {"amount": 10}
    assert call.tool_use_id == "tu-1"


def test_extract_call_survives_a_missing_tool_use():
    class _Empty:
        pass

    call = extract_call(_Empty())
    assert call.name == ""


# ── The intervention ─────────────────────────────────────────────────────────────────


def _guard(decision, **kwargs):
    client = MagicMock()
    client.authorize = AsyncMock(return_value=decision)
    return LeluIntervention(client, actor="invoice_bot", **kwargs), client


async def _act(guard, event):
    return await guard.before_tool_call(event)


def test_registers_a_name_strands_can_identify():
    guard, _ = _guard(_decision())
    assert guard.name == "lelu-authorization"


def test_defaults_to_fail_closed_on_handler_error():
    """Strands defaults on_error to 'throw'. A broken authorization check must
    block the call, not surface as an unhandled exception."""
    guard, _ = _guard(_decision())
    assert guard.on_error == "deny"


@pytest.mark.asyncio
async def test_allow_returns_proceed():
    guard, client = _guard(_decision(decision="allow"))
    action = await _act(guard, _FakeEvent())
    assert isinstance(action, Proceed)
    client.authorize.assert_awaited_once()


@pytest.mark.asyncio
async def test_deny_returns_deny_with_the_reason():
    guard, _ = _guard(_decision(decision="deny", reason="destructive action"))
    action = await _act(guard, _FakeEvent())
    assert isinstance(action, Deny)
    assert "destructive action" in action.reason


@pytest.mark.asyncio
async def test_compute_returns_transform_that_repoints_the_call():
    guard, _ = _guard(
        _decision(decision="compute", safe_tool="refund_sandbox", safe_args={"dry_run": True})
    )
    event = _FakeEvent()
    action = await _act(guard, event)
    assert isinstance(action, Transform)

    # Strands calls apply() to mutate the event in place.
    action.apply(event)
    assert event.tool_use["name"] == "refund_sandbox"
    assert event.tool_use["input"] == {"dry_run": True}


@pytest.mark.asyncio
async def test_human_review_returns_confirm_by_default():
    """Confirm pauses through Strands' interrupt system, which is the whole
    reason human_review maps onto it rather than onto a plain denial."""
    guard, _ = _guard(_decision(decision="human_review", review_id="rev-42"))
    action = await _act(guard, _FakeEvent())
    assert isinstance(action, Confirm)
    assert "human approval" in action.prompt


@pytest.mark.asyncio
async def test_human_review_can_defer_to_lelus_own_queue():
    guard, _ = _guard(
        _decision(decision="human_review", review_id="rev-42"), on_review="deny"
    )
    action = await _act(guard, _FakeEvent())
    assert isinstance(action, Deny)


@pytest.mark.asyncio
async def test_sends_the_tool_name_as_the_action_by_default():
    guard, client = _guard(_decision(decision="allow"))
    await _act(guard, _FakeEvent("refund"))
    sent: AuthorizeRequest = client.authorize.await_args.args[0]
    assert sent.tool == "refund"
    assert sent.actor == "invoice_bot"


@pytest.mark.asyncio
async def test_honours_a_custom_action_mapping():
    guard, client = _guard(_decision(decision="allow"), action_for=lambda c: f"tool:{c.name}")
    await _act(guard, _FakeEvent("refund"))
    assert client.authorize.await_args.args[0].tool == "tool:refund"


@pytest.mark.asyncio
async def test_omits_confidence_when_none_is_supplied():
    """Absent confidence must stay absent so the engine applies its configured
    MissingSignalMode, rather than the integration inventing a perfect score."""
    guard, client = _guard(_decision(decision="allow"))
    await _act(guard, _FakeEvent())
    assert client.authorize.await_args.args[0].context.confidence is None


@pytest.mark.asyncio
async def test_fails_closed_when_the_engine_is_unreachable():
    """An authorization engine that allows everything when it breaks is not an
    authorization engine."""
    client = MagicMock()
    client.authorize = AsyncMock(side_effect=RuntimeError("connection refused"))
    guard = LeluIntervention(client, actor="invoice_bot")
    action = await _act(guard, _FakeEvent())
    assert isinstance(action, Deny)
    assert "unreachable" in action.reason


@pytest.mark.asyncio
async def test_fails_open_only_when_explicitly_configured():
    client = MagicMock()
    client.authorize = AsyncMock(side_effect=RuntimeError("connection refused"))
    guard = LeluIntervention(client, actor="invoice_bot", fail_open=True)
    action = await _act(guard, _FakeEvent())
    assert isinstance(action, Proceed)


@pytest.mark.asyncio
async def test_redeem_reuses_the_paused_request():
    """The engine fingerprints the request body to bind an approval to a
    payload. Redemption must present the same object, not a rebuilt one."""
    decision = _decision(decision="human_review", review_id="rev-42")
    guard, client = _guard(decision)
    client.wait_and_redeem = AsyncMock(return_value="redeemed")

    outcome = await guard.evaluate(ToolCall("refund", {"amount": 10}))
    assert outcome.action == "review"

    await guard.redeem(outcome)
    passed_decision, passed_request = client.wait_and_redeem.await_args.args
    assert passed_decision is decision
    assert passed_request is outcome.request


@pytest.mark.asyncio
async def test_redeem_refuses_an_outcome_with_nothing_to_redeem():
    guard, _ = _guard(_decision(decision="allow"))
    with pytest.raises(ValueError):
        await guard.redeem(GuardOutcome(action="deny"))
