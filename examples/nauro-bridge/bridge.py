"""Resolve a Lelu human_review and hand off a source packet — not a Nauro record.

Flow:
  1. Ask Lelu to authorize an action that policy routes to human_review.
  2. Resolve the review (stands in for your real approval webhook/UI).
  3. Build a minimal source packet identifying the resolved review.

This script stops there. It does not call Nauro's propose_decision — see
README.md for why: a Lelu approval resolves one runtime action, it is not
Nauro judgment. Whether any of the reasoning behind it should become a
durable project decision is a separate, human-gated call that belongs to
the agent session working the Nauro side (check_decision against related
judgment, draft the exact proposal, get it approved, then propose_decision)
— not something this script should decide unattended.

The packet deliberately carries only review_id plus non-sensitive metadata,
not the resolution note itself: an agent session that needs the actual
reasoning can call get_review(review_id) fresh when it's ready to draft a
proposal, rather than this script copying sensitive review content into an
intermediate structure that outlives its reason for existing.

Requires:
  - A running Lelu engine (`npx -y lelu-mcp start`, or set LELU_BASE_URL).
"""

from __future__ import annotations

import asyncio
import json

from auth_pe import AuthorizeRequest, LeluClient
from auth_pe.models import AgentContext, ReviewItem


def to_source_packet(review: ReviewItem) -> dict:
    """The smallest packet that identifies a resolved review without copying
    its reasoning. review_id (not request_id/trace_id — those identify the
    authorization trace, not the queue item, and can't be used to look the
    review back up) is the load-bearing field; an agent session fetches full
    detail via get_review(review_id) only if it decides there's something
    here worth carrying forward."""
    return {
        "review_id": review.id,
        "action": review.action,
        "status": review.status,
        "resolved_by": review.resolved_by,
        "resolved_at": review.resolved_at.isoformat() if review.resolved_at else None,
    }


async def main() -> None:
    async with LeluClient() as lelu:
        decision = await lelu.authorize(
            AuthorizeRequest(
                tool="process_refund_payment",
                actor="refund_bot",
                context=AgentContext(confidence=0.62, acting_for="user_42"),
                args={"invoice_id": "INV-1001", "amount": 750},
            )
        )

        if decision.decision != "human_review":
            print(f"Expected human_review for this demo, got: {decision.decision}")
            return

        print(f"Paused for review: {decision.review_id} — {decision.reason}")

        # Stand-in for your real approval flow: a human decides and attaches
        # a note explaining why. In production this comes from your own
        # webhook/UI, not an immediate auto-approve.
        await lelu.approve_review(
            decision.review_id,
            resolved_by="finance-oncall@example.com",
            note="Confirmed duplicate charge against Stripe records — approved.",
        )

        review = await lelu.get_review(decision.review_id)
        packet = to_source_packet(review)

        print("Source packet (hand this to the agent session — nothing further runs here):")
        print(json.dumps(packet, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
