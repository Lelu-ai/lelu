"""Secure a plain LangChain StructuredTool with Lelu authorization.

The demo authorizer keeps this example runnable without a hosted service. Set
``LELU_EXAMPLE_MODE=live`` to call a local Lelu engine through ``LeluClient``.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any, Protocol

from langchain_core.tools import StructuredTool

from lelu import AgentContext, AuthDecision, AuthorizeRequest, LeluClient


class Authorizer(Protocol):
    async def authorize(self, request: AuthorizeRequest) -> AuthDecision:
        """Authorize one tool call before LangChain executes it."""


def refund_invoice(invoice_id: str, amount_cents: int, reason: str) -> str:
    return f"Refund issued for invoice {invoice_id} (${amount_cents / 100:.2f}): {reason}"


refund_tool = StructuredTool.from_function(
    func=refund_invoice,
    name="process_refund",
    description="Issue a customer refund after Lelu approves the action.",
)


async def run_secured_tool(
    tool: StructuredTool,
    *,
    lelu: Authorizer,
    invoice_id: str,
    amount_cents: int,
    reason: str,
    actor: str = "invoice_bot",
    confidence: float = 0.95,
) -> str:
    tool_args = {
        "invoice_id": invoice_id,
        "amount_cents": amount_cents,
        "reason": reason,
    }
    decision = await lelu.authorize(
        AuthorizeRequest(
            tool="approve_refunds",
            actor=actor,
            context=AgentContext(
                confidence=confidence,
                acting_for="support-agent",
                scope="refunds:write",
            ),
            args=tool_args,
        )
    )

    if decision.decision == "allow":
        return str(tool.invoke(tool_args))
    if decision.decision == "human_review":
        return f"Awaiting human approval for request {decision.request_id}: {decision.reason}"
    raise PermissionError(f"Blocked by Lelu: {decision.reason}")


class DemoLeluClient:
    """Small stand-in for LeluClient so the example is runnable from docs."""

    async def authorize(self, request: AuthorizeRequest) -> AuthDecision:
        amount_cents = int((request.args or {}).get("amount_cents", 0))
        invoice_id = str((request.args or {}).get("invoice_id", ""))

        if invoice_id.endswith("13"):
            return _decision(request, "deny", "demo policy: protected invoice")
        if amount_cents >= 50_000:
            return _decision(request, "human_review", "demo policy: large refund needs approval")
        return _decision(request, "allow", "demo policy: refund allowed")


def _decision(request: AuthorizeRequest, decision: str, reason: str) -> AuthDecision:
    return AuthDecision(
        request_id=f"demo-{decision}",
        tool=request.tool,
        decision=decision,
        reason=reason,
        rule="examples/langchain/demo",
        latency_ms=1.0,
        mode="sandbox",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


def build_authorizer() -> Authorizer:
    if os.environ.get("LELU_EXAMPLE_MODE") == "live":
        return LeluClient(
            base_url=os.environ.get("LELU_BASE_URL", "http://localhost:8080"),
            api_key=os.environ.get("LELU_API_KEY", "lelu-dev-key"),
        )
    return DemoLeluClient()


async def main() -> None:
    lelu = build_authorizer()
    try:
        print(
            await run_secured_tool(
                refund_tool,
                lelu=lelu,
                invoice_id="INV-1001",
                amount_cents=2_500,
                reason="duplicate charge",
            )
        )

        try:
            await run_secured_tool(
                refund_tool,
                lelu=lelu,
                invoice_id="INV-1013",
                amount_cents=2_500,
                reason="protected account",
            )
        except PermissionError as exc:
            print(exc)

        print(
            await run_secured_tool(
                refund_tool,
                lelu=lelu,
                invoice_id="INV-2001",
                amount_cents=75_000,
                reason="enterprise credit",
            )
        )
    finally:
        if isinstance(lelu, LeluClient):
            await lelu.aclose()


if __name__ == "__main__":
    asyncio.run(main())
