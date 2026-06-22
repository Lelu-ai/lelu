"""Tests for the CrewAI integration (LeluTool).

CrewAI is an optional dependency and isn't installed in CI, so we inject a
minimal fake ``crewai.tools.BaseTool`` (a plain Pydantic model) and reload the
integration against it. This exercises the real LeluTool._run gating logic
without pulling the heavy framework.
"""

import importlib
import sys
import types

import pytest
from pydantic import BaseModel
from unittest.mock import AsyncMock, MagicMock

from auth_pe.models import AgentAuthDecision


# ── Inject a fake crewai.tools.BaseTool before (re)loading the integration ────
class _FakeBaseTool(BaseModel):
    name: str = ""
    description: str = ""


_fake_tools = types.ModuleType("crewai.tools")
_fake_tools.BaseTool = _FakeBaseTool  # type: ignore[attr-defined]
_fake_crewai = types.ModuleType("crewai")
_fake_crewai.tools = _fake_tools  # type: ignore[attr-defined]
sys.modules.setdefault("crewai", _fake_crewai)
sys.modules.setdefault("crewai.tools", _fake_tools)

import auth_pe.crewai as crewai_mod  # noqa: E402

importlib.reload(crewai_mod)  # re-run module import now that fake crewai exists

LeluTool = crewai_mod.LeluTool
PermissionDeniedError = crewai_mod.PermissionDeniedError


def _decision(*, decision: str, reason: str = "ok", downgraded: str | None = None) -> AgentAuthDecision:
    return AgentAuthDecision(
        request_id="req",
        tool="process_refund",
        decision=decision,
        reason=reason,
        rule="default",
        latency_ms=1.0,
        mode="live",
        timestamp="2024-01-01T00:00:00Z",
        confidence_used=0.9,
        trace_id="trace",
        downgraded_scope=downgraded,
    )


def _client(*, decision: str, reason: str = "ok", downgraded: str | None = None) -> MagicMock:
    c = MagicMock()
    c.agent_authorize = AsyncMock(return_value=_decision(decision=decision, reason=reason, downgraded=downgraded))
    return c


class RefundTool(LeluTool):
    name: str = "process_refund"
    description: str = "Process a customer refund."
    actor: str = "invoice_bot"
    action: str = "invoice:refund"

    def _execute(self, invoice_id: str = "inv-1") -> str:
        return f"refund-done:{invoice_id}"


def test_allow_runs_the_real_tool():
    tool = RefundTool(lelu_client=_client(decision="allow"), confidence=0.95)
    assert tool._run(invoice_id="inv-42") == "refund-done:inv-42"


def test_deny_returns_a_refusal_string():
    tool = RefundTool(lelu_client=_client(decision="deny", reason="low confidence"), confidence=0.3)
    out = tool._run(invoice_id="inv-42")
    assert "denied" in out.lower()
    assert "low confidence" in out
    assert "refund-done" not in out  # the real tool never ran


def test_human_review_returns_pending_message():
    tool = RefundTool(lelu_client=_client(decision="human_review", reason="needs approval"), confidence=0.8)
    out = tool._run(invoice_id="inv-42")
    assert "human review" in out.lower()
    assert "refund-done" not in out


def test_deny_raises_when_throw_on_deny():
    tool = RefundTool(
        lelu_client=_client(decision="deny", reason="blocked by policy"),
        confidence=0.2,
        throw_on_deny=True,
    )
    with pytest.raises(PermissionDeniedError):
        tool._run(invoice_id="inv-42")
