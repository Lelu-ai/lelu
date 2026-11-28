import { db, ensureSchema } from "@/lib/db";
import { overageChargeRequest, paddleApiBase } from "./paddle";
import { decideQuota, normalizePlan, overageBlocks, previousMonthRange, priceIdsFromEnv } from "./plans";

// Monthly overage billing. Runs on the 1st (see vercel.json) and charges each
// paid subscriber for the calls they made past their plan last month, as a
// one-time charge added to their next renewal invoice.
//
// Safe to re-run: lelu_overage_charges has one row per account per month, and
// a charge is only sent for a row this run created, or one a previous run
// marked 'failed'. A row left 'pending' (a run that died mid-request) is never
// retried automatically, because the charge may have gone through; it is
// reported under needsReview for a person to check in Paddle.
//
// The plan used is the account's plan when the job runs. Someone who upgraded
// late in the month is measured against the larger plan, which only ever
// lowers what they pay.

export interface OverageRunResult {
  period: string;
  configured: boolean;
  checked: number;
  charged: Array<{ userId: string; blocks: number }>;
  failed: Array<{ userId: string; error: string }>;
  alreadyBilled: number;
  needsReview: string[];
}

export async function runOverageBilling(now: Date = new Date()): Promise<OverageRunResult> {
  const { start, end } = previousMonthRange(now);
  const period = start.toISOString().slice(0, 7);
  const result: OverageRunResult = {
    period,
    configured: false,
    checked: 0,
    charged: [],
    failed: [],
    alreadyBilled: 0,
    needsReview: [],
  };

  const apiKey = process.env.PADDLE_API_KEY;
  const overagePriceId = priceIdsFromEnv()?.overage;
  if (!apiKey || !overagePriceId) return result;
  result.configured = true;

  await ensureSchema();
  const sql = db();

  const subscribers = await sql`
    SELECT id, plan, call_limit_override, billing_subscription_id
    FROM lelu_users
    WHERE billing_provider = 'paddle'
      AND billing_subscription_id IS NOT NULL
      AND plan <> 'free'
  `;
  if (subscribers.length === 0) return result;

  const ids = subscribers.map((s) => s.id as string);
  const usageRows = await sql`
    SELECT user_id, COUNT(*) AS count
    FROM lelu_audit_events
    WHERE mode = 'live'
      AND created_at >= ${start}
      AND created_at < ${end}
      AND user_id = ANY(${ids})
    GROUP BY user_id
  `;
  const usage = new Map(usageRows.map((r) => [r.user_id as string, Number(r.count)]));

  for (const s of subscribers) {
    result.checked++;
    const userId = s.id as string;
    const plan = normalizePlan(s.plan as string);
    const override = s.call_limit_override === null ? null : Number(s.call_limit_override);
    const used = usage.get(userId) ?? 0;
    const quota = decideQuota(plan, used, override);
    const blocks = overageBlocks(quota.overageCalls);
    if (blocks === 0) continue;

    // Claim the month: a new row, or a failed one being retried. Either way
    // this run now owns the charge; any other concurrent run gets nothing back.
    const claimed = await sql`
      INSERT INTO lelu_overage_charges (user_id, period_start, plan, included_calls, used_calls, blocks, status)
      VALUES (${userId}, ${start}, ${plan}, ${quota.limit}, ${used}, ${blocks}, 'pending')
      ON CONFLICT (user_id, period_start) DO UPDATE
        SET status = 'pending', error = NULL, blocks = EXCLUDED.blocks,
            used_calls = EXCLUDED.used_calls, updated_at = NOW()
        WHERE lelu_overage_charges.status = 'failed'
      RETURNING user_id
    `;
    if (claimed.length === 0) {
      const existing = await sql`
        SELECT status FROM lelu_overage_charges WHERE user_id = ${userId} AND period_start = ${start}
      `;
      if (existing[0]?.status === "pending") result.needsReview.push(userId);
      else result.alreadyBilled++;
      continue;
    }

    const subscriptionId = s.billing_subscription_id as string;
    let error: string | null = null;
    try {
      const res = await fetch(`${paddleApiBase()}/subscriptions/${encodeURIComponent(subscriptionId)}/charge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(overageChargeRequest(overagePriceId, blocks)),
      });
      if (!res.ok) error = `Paddle answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    await sql`
      UPDATE lelu_overage_charges
      SET status = ${error ? "failed" : "charged"}, error = ${error}, updated_at = NOW()
      WHERE user_id = ${userId} AND period_start = ${start}
    `;
    if (error) result.failed.push({ userId, error });
    else result.charged.push({ userId, blocks });
  }

  return result;
}
