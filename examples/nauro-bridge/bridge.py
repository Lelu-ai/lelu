"""Rough draft: push a resolved Lelu human_review decision into Nauro.

Flow:
  1. Ask Lelu to authorize an action that policy routes to human_review.
  2. Resolve the review (stands in for your real approval webhook/UI).
  3. Translate the resolved ReviewItem into a Nauro propose_decision call,
     made over MCP stdio against a `nauro serve` subprocess.

Requires:
  - A running Lelu engine (`npx -y lelu-mcp start`, or set LELU_BASE_URL).
  - A Nauro project: `pip install nauro && nauro init` in NAURO_PROJECT_DIR.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from auth_pe import AuthorizeRequest, LeluClient
from auth_pe.models import AgentContext, ReviewItem

NAURO_PROJECT_DIR = Path(os.environ.get("NAURO_PROJECT_DIR", "."))


def confidence_tier(score: float) -> str:
    """Map Lelu's 0.0-1.0 confidence_score to Nauro's low/medium/high tiers."""
    if score >= 0.8:
        return "high"
    if score >= 0.5:
        return "medium"
    return "low"


def to_nauro_decision(review: ReviewItem) -> dict:
    """Shape a resolved Lelu ReviewItem as a Nauro propose_decision call.

    decision_type/reversibility are placeholders — need Nauro's canonical
    enum values from nauro_core.constants before this is more than a draft.
    """
    resource = ", ".join(f"{k}={v}" for k, v in (review.resource or {}).items())
    title = f"{review.action}" + (f" ({resource})" if resource else "")
    rationale = review.resolution_note or review.reason or "No reasoning recorded."

    return {
        "title": title[:120],
        "rationale": f"[via Lelu review {review.id}, resolved by {review.resolved_by or 'unknown'}] {rationale}",
        "operation": "add",
        "confidence": confidence_tier(review.confidence_score),
        "decision_type": "policy",  # placeholder — confirm against nauro_core.constants
        "reversibility": "reversible",  # placeholder — same
    }


async def push_to_nauro(decision: dict) -> dict:
    server = StdioServerParameters(command="nauro", args=["serve"], cwd=str(NAURO_PROJECT_DIR))
    async with stdio_client(server) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool("propose_decision", decision)
            return result


async def main() -> None:
    async with LeluClient() as lelu:
        decision = await lelu.authorize(
            AuthorizeRequest(
                tool="issue_refund",
                actor="refund_bot",
                context=AgentContext(confidence=0.62, acting_for="user_42"),
                args={"invoice_id": "INV-1001", "amount": 750},
            )
        )

        if decision.decision != "human_review":
            print(f"Expected human_review for this demo, got: {decision.decision}")
            return

        print(f"Paused for review: {decision.request_id} — {decision.reason}")

        # Stand-in for your real approval flow: a human decides and attaches
        # a note explaining why. In production this comes from your own
        # webhook/UI, not an immediate auto-approve.
        await lelu.approve_review(
            decision.request_id,
            resolved_by="finance-oncall@example.com",
            note="Confirmed duplicate charge against Stripe records — approved.",
        )

        review = await lelu.get_review(decision.request_id)
        nauro_call = to_nauro_decision(review)
        print(f"Pushing to Nauro: {nauro_call['title']!r}")

        result = await push_to_nauro(nauro_call)
        print(f"Nauro decision recorded: {result}")


if __name__ == "__main__":
    asyncio.run(main())
