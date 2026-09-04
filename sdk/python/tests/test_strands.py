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
from auth_pe.strands import (
    GuardOutcome,
    HumanReviewRequired,
    LeluHook,
    PermissionDeniedError,
    ToolCall,
    _apply,
    _extract_call,
    decide,
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
    """Stands in for Strands' BeforeToolCallEvent."""

    def __init__(self, name="refund", tool_input=None):
        self.tool_use = {"name": name, "input": tool_input or {}, "toolUseId": "tu-1"}
        self.cancel = None


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
    call = _extract_call(_FakeEvent("refund", {"amount": 10}))
    assert call.name == "refund"
    assert call.arguments == {"amount": 10}
    assert call.tool_use_id == "tu-1"


def test_extract_call_survives_a_missing_tool_use():
    class _Empty:
        pass

    call = _extract_call(_Empty())
    assert call.name == ""


def test_apply_allow_changes_nothing():
    event = _FakeEvent()
    _apply(event, GuardOutcome(action="allow"))
    assert event.cancel is None
    assert event.tool_use["name"] == "refund"


def test_apply_deny_cancels():
    event = _FakeEvent()
    _apply(event, GuardOutcome(action="deny", message="blocked"))
    assert event.cancel == "blocked"


def test_apply_redirect_renames_so_strands_reresolves():
    event = _FakeEvent()
    _apply(
        event,
        GuardOutcome(action="redirect", replacement_tool="refund_sandbox", replacement_args={"dry_run": True}),
    )
    assert event.tool_use["name"] == "refund_sandbox"
    assert event.tool_use["input"] == {"dry_run": True}
    assert event.cancel is None


def test_apply_redirect_without_a_usable_tool_use_cancels():
    """Failing to apply a redirect must stop the call, not let the original
    unauthorized tool run because a field was not where we expected."""

    class _NoToolUse:
        def __init__(self):
            self.cancel = None

    event = _NoToolUse()
    _apply(event, GuardOutcome(action="redirect", replacement_tool="safe", message="redirect failed"))
    assert event.cancel == "redirect failed"


# ── The hook ─────────────────────────────────────────────────────────────────


def _hook(decision, **kwargs):
    client = MagicMock()
    client.authorize = AsyncMock(return_value=decision)
    return LeluHook(client, actor="invoice_bot", **kwargs), client


def test_hook_authorizes_and_allows():
    hook, client = _hook(_decision(decision="allow"))
    event = _FakeEvent()
    hook.before_tool_call(event)
    assert event.cancel is None
    client.authorize.assert_awaited_once()


def test_hook_sends_the_tool_name_as_the_action_by_default():
    hook, client = _hook(_decision(decision="allow"))
    hook.before_tool_call(_FakeEvent("refund"))
    sent: AuthorizeRequest = client.authorize.await_args.args[0]
    assert sent.tool == "refund"
    assert sent.actor == "invoice_bot"
    assert sent.resource == {"tool": "refund"}


def test_hook_honours_a_custom_action_mapping():
    hook, client = _hook(_decision(decision="allow"), action_for=lambda c: f"tool:{c.name}")
    hook.before_tool_call(_FakeEvent("refund"))
    assert client.authorize.await_args.args[0].tool == "tool:refund"


def test_hook_omits_confidence_when_none_is_supplied():
    """Absent confidence must stay absent so the engine applies its configured
    MissingSignalMode, rather than the integration inventing a perfect score."""
    hook, client = _hook(_decision(decision="allow"))
    hook.before_tool_call(_FakeEvent())
    assert client.authorize.await_args.args[0].context.confidence is None


def test_hook_cancels_on_deny():
    hook, _ = _hook(_decision(decision="deny", reason="nope"))
    event = _FakeEvent()
    hook.before_tool_call(event)
    assert "nope" in event.cancel


def test_hook_raises_on_deny_when_asked():
    hook, _ = _hook(_decision(decision="deny", reason="nope"), raise_on_deny=True)
    with pytest.raises(PermissionDeniedError) as exc:
        hook.before_tool_call(_FakeEvent())
    assert exc.value.reason == "nope"


def test_hook_interrupts_on_review_when_asked():
    hook, _ = _hook(
        _decision(decision="human_review", review_id="rev-42"), on_review="interrupt"
    )
    with pytest.raises(HumanReviewRequired) as exc:
        hook.before_tool_call(_FakeEvent())
    assert exc.value.review_id == "rev-42"


def test_hook_fails_closed_when_the_engine_is_unreachable():
    """An authorization engine that allows everything when it breaks is not an
    authorization engine."""
    client = MagicMock()
    client.authorize = AsyncMock(side_effect=RuntimeError("connection refused"))
    hook = LeluHook(client, actor="invoice_bot")
    event = _FakeEvent()
    hook.before_tool_call(event)
    assert event.cancel
    assert "unreachable" in event.cancel


def test_hook_fails_open_only_when_explicitly_configured():
    client = MagicMock()
    client.authorize = AsyncMock(side_effect=RuntimeError("connection refused"))
    hook = LeluHook(client, actor="invoice_bot", fail_open=True)
    event = _FakeEvent()
    hook.before_tool_call(event)
    assert event.cancel is None


def test_redeem_reuses_the_paused_request():
    """The engine fingerprints the request body to bind an approval to a
    payload. Redemption must present the same object, not a rebuilt one."""
    decision = _decision(decision="human_review", review_id="rev-42")
    hook, client = _hook(decision)
    client.wait_and_redeem = AsyncMock(return_value="redeemed")

    outcome = hook.evaluate(ToolCall("refund", {"amount": 10}))
    assert outcome.action == "review"

    hook.redeem(outcome)
    passed_decision, passed_request = client.wait_and_redeem.await_args.args
    assert passed_decision is decision
    assert passed_request is outcome.request


def test_redeem_refuses_an_outcome_with_nothing_to_redeem():
    hook, _ = _hook(_decision(decision="allow"))
    with pytest.raises(ValueError):
        hook.redeem(GuardOutcome(action="deny"))
