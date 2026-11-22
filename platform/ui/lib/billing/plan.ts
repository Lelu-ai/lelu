import { db, ensureSchema } from "@/lib/db";
import type { PlanChange } from "./paddle";

// Applies a plan change from a billing webhook to lelu_users.
//
// Webhooks are retried and can arrive out of order, so the update only goes
// through when this event is not older than the last one applied
// (plan_event_at). Replaying the same event is therefore a no-op.
//
// The user is found by the id we put in the checkout's custom data, or, for a
// later event with no custom data, by the Paddle customer id stored the first
// time. Returns the number of users updated (0 means unmatched or stale).
export async function applyPlanChange(provider: "paddle", change: PlanChange): Promise<number> {
  await ensureSchema();
  const sql = db();

  if (change.userId) {
    // custom_data.user_id is set by the browser that opened the checkout, so it
    // is a claim, not proof. Someone could pay for a subscription labelled with
    // another user's id and then cancel it to downgrade that user. A downgrade
    // is therefore only accepted from the subscription we already recorded for
    // the user (or when none is recorded yet). Upgrades always apply: whoever
    // pays, the account gets the paid plan. Opening the checkout from a
    // server-created transaction would close this entirely (see docs).
    const isPaid = change.plan !== "free";
    const rows = await sql`
      UPDATE lelu_users
      SET plan = ${change.plan},
          plan_updated_at = NOW(),
          plan_event_at = ${change.occurredAt},
          billing_provider = ${provider},
          billing_customer_id = COALESCE(${change.customerId}, billing_customer_id),
          billing_subscription_id = COALESCE(${change.subscriptionId}, billing_subscription_id)
      WHERE id = ${change.userId}
        AND (plan_event_at IS NULL OR plan_event_at <= ${change.occurredAt})
        AND (${isPaid} OR billing_subscription_id IS NULL OR billing_subscription_id = ${change.subscriptionId})
      RETURNING id
    `;
    return rows.length;
  }

  if (change.customerId) {
    const rows = await sql`
      UPDATE lelu_users
      SET plan = ${change.plan},
          plan_updated_at = NOW(),
          plan_event_at = ${change.occurredAt},
          billing_subscription_id = COALESCE(${change.subscriptionId}, billing_subscription_id)
      WHERE billing_provider = ${provider}
        AND billing_customer_id = ${change.customerId}
        AND (plan_event_at IS NULL OR plan_event_at <= ${change.occurredAt})
      RETURNING id
    `;
    return rows.length;
  }

  return 0;
}
