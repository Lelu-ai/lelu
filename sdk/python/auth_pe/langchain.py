"""LangChain tool wrapper for the Auth Permission Engine.

This module provides ``SecuredTool`` and ``create_secured_tool`` for wrapping
plain LangChain tools. The wrapper intercepts ``_run`` and ``_arun`` so the
tool is authorized before its underlying implementation executes.

Usage
-----
.. code-block:: python

    from langchain_core.tools import tool
    from lelu import LeluClient, create_secured_tool

    lelu = LeluClient(api_key="...")

    @tool
    def delete_record(record_id: str) -> str:
        return f"deleted:{record_id}"

    secured = create_secured_tool(
        delete_record,
        client=lelu,
        actor="invoice_bot",
        action="db:delete",
    )

    result = secured.invoke({"record_id": "42"})
"""

from __future__ import annotations

import asyncio
import functools
from typing import Any

from pydantic import BaseModel, PrivateAttr

from .client import LeluClient
from .models import AgentContext, AuthorizeRequest

__all__ = ["LangChainPermissionDeniedError", "SecuredTool", "create_secured_tool"]

try:  # pragma: no cover - exercised through the fake module in tests
    from langchain_core.tools import BaseTool as LangChainBaseTool
except ImportError:  # pragma: no cover - fallback when langchain is absent
    try:
        from langchain.tools import BaseTool as LangChainBaseTool  # type: ignore[assignment]
    except ImportError:  # pragma: no cover - lightweight local fallback

        class LangChainBaseTool(BaseModel):  # type: ignore[no-redef]
            """Fallback base class that mirrors the LangChain tool fields."""

            name: str = ""
            description: str = ""
            args_schema: Any = None
            return_direct: bool = False
            verbose: bool = False
            callbacks: Any = None
            tags: list[str] | None = None
            metadata: dict[str, Any] | None = None
            handle_tool_error: Any = False
            handle_validation_error: Any = False
            response_format: str = "content"

            model_config = {"arbitrary_types_allowed": True}

            def run(self, *args: Any, **kwargs: Any) -> Any:
                return self._run(*args, **kwargs)

            async def arun(self, *args: Any, **kwargs: Any) -> Any:
                return await self._arun(*args, **kwargs)


def _tool_field_value(tool: Any, field_name: str, default: Any = None) -> Any:
    return getattr(tool, field_name, default)


def _tool_metadata(tool: Any) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    model_fields = getattr(LangChainBaseTool, "model_fields", {})
    candidate_fields = (
        "name",
        "description",
        "args_schema",
        "return_direct",
        "verbose",
        "callbacks",
        "tags",
        "metadata",
        "handle_tool_error",
        "handle_validation_error",
        "response_format",
    )
    for field_name in candidate_fields:
        if field_name in model_fields:
            metadata[field_name] = _tool_field_value(tool, field_name)
    return metadata


def _build_args_payload(args: tuple[Any, ...], kwargs: dict[str, Any]) -> dict[str, Any] | None:
    if not args and not kwargs:
        return None
    if kwargs and args:
        return {"args": list(args), **kwargs}
    if kwargs:
        return dict(kwargs)
    if len(args) == 1:
        return {"input": args[0]}
    return {"args": list(args)}


class LangChainPermissionDeniedError(PermissionError):
    """Raised when Lelu denies a LangChain tool invocation."""

    def __init__(
        self,
        *,
        tool_name: str,
        action: str,
        actor: str,
        decision: str,
        reason: str,
        request_id: str | None = None,
    ) -> None:
        self.tool_name = tool_name
        self.action = action
        self.actor = actor
        self.decision = decision
        self.reason = reason
        self.request_id = request_id

        details = (
            f"Lelu denied LangChain tool '{tool_name}' for actor '{actor}' "
            f"(action '{action}', decision '{decision}')"
        )
        if request_id:
            details += f" [request_id={request_id}]"
        if reason:
            details += f": {reason}"
        super().__init__(details)


class SecuredTool(LangChainBaseTool):  # type: ignore[misc]
    """LangChain ``BaseTool`` wrapper that authorizes tool execution first."""

    _tool: Any = PrivateAttr()
    _client: LeluClient = PrivateAttr()
    _actor: str = PrivateAttr()
    _action: str = PrivateAttr()
    _confidence: float | None = PrivateAttr(default=None)
    _acting_for: str | None = PrivateAttr(default=None)
    _scope: str | None = PrivateAttr(default=None)

    model_config = {"arbitrary_types_allowed": True}

    def __init__(
        self,
        tool: Any,
        *,
        client: LeluClient,
        actor: str,
        action: str | None = None,
        confidence: float | None = None,
        acting_for: str | None = None,
        scope: str | None = None,
    ) -> None:
        super().__init__(**_tool_metadata(tool))
        self._tool = tool
        self._client = client
        self._actor = actor
        self._action = action or str(getattr(tool, "name", type(tool).__name__))
        self._confidence = confidence
        self._acting_for = acting_for
        self._scope = scope

    async def _authorize(self, *args: Any, **kwargs: Any) -> Any:
        request = AuthorizeRequest(
            tool=self._action,
            actor=self._actor,
            context=AgentContext(
                confidence=self._confidence,
                acting_for=self._acting_for,
                scope=self._scope,
            ),
            args=_build_args_payload(args, kwargs),
        )
        return await self._client.authorize_tool(request)

    def _denial_error(self, decision: Any) -> LangChainPermissionDeniedError:
        return LangChainPermissionDeniedError(
            tool_name=str(getattr(self, "name", self._action)),
            action=self._action,
            actor=self._actor,
            decision=str(getattr(decision, "decision", "deny")),
            reason=str(getattr(decision, "reason", "Access denied")),
            request_id=str(getattr(decision, "request_id", "")) or None,
        )

    def _execute_sync(self, *args: Any, **kwargs: Any) -> Any:
        if callable(getattr(self._tool, "_run", None)):
            return self._tool._run(*args, **kwargs)
        if callable(getattr(self._tool, "run", None)):
            return self._tool.run(*args, **kwargs)
        if callable(getattr(self._tool, "invoke", None)):
            return self._tool.invoke(*args, **kwargs)
        raise TypeError(
            f"Wrapped tool '{type(self._tool).__name__}' does not expose a sync entrypoint"
        )

    async def _execute_async(self, *args: Any, **kwargs: Any) -> Any:
        if callable(getattr(self._tool, "_arun", None)):
            return await self._tool._arun(*args, **kwargs)
        if callable(getattr(self._tool, "arun", None)):
            return await self._tool.arun(*args, **kwargs)
        return await asyncio.to_thread(functools.partial(self._execute_sync, *args, **kwargs))

    def _run(self, *args: Any, **kwargs: Any) -> Any:
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            decision = asyncio.run(self._authorize(*args, **kwargs))
        else:
            raise RuntimeError(
                "SecuredTool._run() was called from a running event loop; use _arun()."
            )

        if not getattr(decision, "allowed", False):
            raise self._denial_error(decision)
        return self._execute_sync(*args, **kwargs)

    async def _arun(self, *args: Any, **kwargs: Any) -> Any:
        decision = await self._authorize(*args, **kwargs)
        if not getattr(decision, "allowed", False):
            raise self._denial_error(decision)
        return await self._execute_async(*args, **kwargs)


def create_secured_tool(
    tool: Any,
    *,
    client: LeluClient,
    actor: str,
    action: str | None = None,
    confidence: float | None = None,
    acting_for: str | None = None,
    scope: str | None = None,
) -> SecuredTool:
    """Create a Lelu-secured wrapper around a LangChain tool instance."""

    return SecuredTool(
        tool,
        client=client,
        actor=actor,
        action=action,
        confidence=confidence,
        acting_for=acting_for,
        scope=scope,
    )