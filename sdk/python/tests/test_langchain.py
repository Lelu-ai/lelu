"""Tests for the LangChain integration (SecuredTool)."""

import asyncio
import importlib
import sys
import types

import pytest
from pydantic import BaseModel
from unittest.mock import AsyncMock, MagicMock

from auth_pe.models import AuthDecision


class _FakeBaseTool(BaseModel):
    name: str = ""
    description: str = ""
    args_schema: object | None = None
    return_direct: bool = False
    verbose: bool = False
    callbacks: object | None = None
    tags: list[str] | None = None
    metadata: dict[str, object] | None = None
    handle_tool_error: object = False
    handle_validation_error: object = False
    response_format: str = "content"

    model_config = {"arbitrary_types_allowed": True}


_fake_tools = types.ModuleType("langchain_core.tools")
_fake_tools.BaseTool = _FakeBaseTool  # type: ignore[attr-defined]
_fake_core = types.ModuleType("langchain_core")
_fake_core.tools = _fake_tools  # type: ignore[attr-defined]
sys.modules["langchain_core"] = _fake_core
sys.modules["langchain_core.tools"] = _fake_tools

import auth_pe.langchain as langchain_mod  # noqa: E402

importlib.reload(langchain_mod)

create_secured_tool = langchain_mod.create_secured_tool
LangChainPermissionDeniedError = langchain_mod.LangChainPermissionDeniedError


def _decision(*, decision: str, reason: str = "ok", request_id: str = "req-test") -> AuthDecision:
    return AuthDecision(
        request_id=request_id,
        tool="delete_record",
        decision=decision,
        reason=reason,
        rule="default",
        latency_ms=1.0,
        mode="live",
        timestamp="2024-01-01T00:00:00Z",
    )


def _client(*, decision: str, reason: str = "ok") -> MagicMock:
    client = MagicMock()
    client.authorize_tool = AsyncMock(return_value=_decision(decision=decision, reason=reason))
    return client


class DeleteRecordTool(_FakeBaseTool):
    name: str = "delete_record"
    description: str = "Delete a record by ID."

    def _run(self, record_id: str) -> str:
        return f"deleted:{record_id}"

    async def _arun(self, record_id: str) -> str:
        await asyncio.sleep(0)
        return f"deleted-async:{record_id}"


def test_create_secured_tool_runs_when_allowed():
    tool = create_secured_tool(
        DeleteRecordTool(),
        client=_client(decision="allow"),
        actor="invoice_bot",
        action="db:delete",
    )

    assert tool._run(record_id="42") == "deleted:42"
    call = tool._client.authorize_tool.call_args.args[0]
    assert call.tool == "db:delete"
    assert call.actor == "invoice_bot"
    assert call.args == {"record_id": "42"}


@pytest.mark.asyncio
async def test_create_secured_tool_arun_runs_when_allowed():
    tool = create_secured_tool(
        DeleteRecordTool(),
        client=_client(decision="allow"),
        actor="invoice_bot",
        action="db:delete",
    )

    assert await tool._arun(record_id="42") == "deleted-async:42"


def test_create_secured_tool_raises_on_denial():
    tool = create_secured_tool(
        DeleteRecordTool(),
        client=_client(decision="deny", reason="policy blocked"),
        actor="invoice_bot",
        action="db:delete",
    )

    with pytest.raises(LangChainPermissionDeniedError) as exc_info:
        tool._run(record_id="42")

    assert "policy blocked" in str(exc_info.value)
    assert exc_info.value.reason == "policy blocked"