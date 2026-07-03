"""Minimal LangChain example secured by Lelu.

This script uses a dummy client so it is reproducible without a live Lelu
server. Replace ``DummyClient`` with ``LeluClient`` in real usage.
"""

from __future__ import annotations

import asyncio

from langchain_core.tools import tool

from lelu import create_secured_tool


class DummyDecision:
    def __init__(self, *, allowed: bool, reason: str = "ok", request_id: str = "demo") -> None:
        self.allowed = allowed
        self.reason = reason
        self.request_id = request_id
        self.decision = "allow" if allowed else "deny"


class DummyClient:
    async def authorize_tool(self, request):  # noqa: ANN001
        if request.tool == "delete_record" and request.args and request.args.get("record_id") == "13":
            return DummyDecision(allowed=False, reason="demo policy: record 13 is protected")
        return DummyDecision(allowed=True)


@tool
def delete_record(record_id: str) -> str:
    return f"deleted:{record_id}"


async def main() -> None:
    secured = create_secured_tool(
        delete_record,
        client=DummyClient(),
        actor="invoice_bot",
        action="delete_record",
    )

    print(await secured._arun(record_id="42"))

    try:
        print(await secured._arun(record_id="13"))
    except Exception as exc:  # noqa: BLE001
        print(exc)


if __name__ == "__main__":
    asyncio.run(main())