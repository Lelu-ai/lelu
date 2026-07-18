"""Tests for the runnable LangChain example."""

from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path
from typing import Any

import pytest


class _FakeStructuredTool:
    def __init__(self, *, func: Any, name: str, description: str) -> None:
        self.func = func
        self.name = name
        self.description = description

    @classmethod
    def from_function(cls, *, func: Any, name: str, description: str) -> "_FakeStructuredTool":
        return cls(func=func, name=name, description=description)

    def invoke(self, tool_args: dict[str, Any]) -> Any:
        return self.func(**tool_args)


def _load_example(monkeypatch: pytest.MonkeyPatch) -> Any:
    fake_tools = types.ModuleType("langchain_core.tools")
    fake_tools.StructuredTool = _FakeStructuredTool  # type: ignore[attr-defined]
    fake_core = types.ModuleType("langchain_core")
    fake_core.tools = fake_tools  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "langchain_core", fake_core)
    monkeypatch.setitem(sys.modules, "langchain_core.tools", fake_tools)

    example_path = Path(__file__).resolve().parents[3] / "examples/langchain/secure_refund_tool.py"
    spec = importlib.util.spec_from_file_location("langchain_secure_refund_tool", example_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["langchain_secure_refund_tool"] = module
    spec.loader.exec_module(module)
    return module


class _NeverRunTool:
    called = False

    def invoke(self, tool_args: dict[str, Any]) -> str:
        self.called = True
        return f"unexpected:{tool_args}"


@pytest.mark.asyncio
async def test_example_runs_tool_after_allow(monkeypatch: pytest.MonkeyPatch) -> None:
    module = _load_example(monkeypatch)

    result = await module.run_secured_tool(
        module.refund_tool,
        lelu=module.DemoLeluClient(),
        invoice_id="INV-1001",
        amount_cents=2_500,
        reason="duplicate charge",
    )

    assert result == "Refund issued for invoice INV-1001 ($25.00): duplicate charge"


@pytest.mark.asyncio
async def test_example_does_not_run_tool_after_deny(monkeypatch: pytest.MonkeyPatch) -> None:
    module = _load_example(monkeypatch)
    tool = _NeverRunTool()

    with pytest.raises(PermissionError, match="protected invoice"):
        await module.run_secured_tool(
            tool,
            lelu=module.DemoLeluClient(),
            invoice_id="INV-1013",
            amount_cents=2_500,
            reason="protected account",
        )

    assert tool.called is False


@pytest.mark.asyncio
async def test_example_does_not_run_tool_during_human_review(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _load_example(monkeypatch)
    tool = _NeverRunTool()

    result = await module.run_secured_tool(
        tool,
        lelu=module.DemoLeluClient(),
        invoice_id="INV-2001",
        amount_cents=75_000,
        reason="enterprise credit",
    )

    assert "Awaiting human approval" in result
    assert tool.called is False
