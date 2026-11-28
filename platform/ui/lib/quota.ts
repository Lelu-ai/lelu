import { db, ensureSchema } from "./db";
import { decideQuota, monthRange, normalizePlan, type PlanId, type QuotaDecision } from "./billing/plans";

// Monthly authorize-call quotas. The numbers live in lib/billing/plans.ts.
// Free stops at its limit; paid plans keep going and the extra calls are
// billed at the end of the month (lib/billing/overage.ts). Agents and team
// members are unlimited on every plan: pricing is per call, not per seat.

// Count of live (non-sandbox) authorize calls a user made in [from, to),
// computed on demand from lelu_audit_events rather than a separate counter
// table, which avoids write-amplification on the hot authorize path.
export async function countLiveCalls(userId: string, from: Date, to: Date): Promise<number> {
  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT COUNT(*) AS count
    FROM lelu_audit_events
    WHERE user_id = ${userId}
      AND mode = 'live'
      AND created_at >= ${from}
      AND created_at < ${to}
  `;
  return Number(rows[0]?.count ?? 0);
}

// Current calendar-month (UTC) count of live authorize calls for a user.
export async function getMonthlyUsage(userId: string): Promise<number> {
  const { start, end } = monthRange(new Date());
  return countLiveCalls(userId, start, end);
}

export interface UserPlan {
  plan: PlanId;
  /** Per-account monthly call volume, or null for the plan's own amount. */
  callLimitOverride: number | null;
}

export async function getUserPlanInfo(userId: string): Promise<UserPlan> {
  await ensureSchema();
  const sql = db();
  const rows = await sql`SELECT plan, call_limit_override FROM lelu_users WHERE id = ${userId}`;
  const override = rows[0]?.call_limit_override;
  return {
    plan: normalizePlan(rows[0]?.plan as string | undefined),
    callLimitOverride: override === null || override === undefined ? null : Number(override),
  };
}

export async function getUserPlan(userId: string): Promise<PlanId> {
  return (await getUserPlanInfo(userId)).plan;
}

export type QuotaStatus = QuotaDecision;

// Checks whether a user may make another authorize call this month. Call
// before proxying a request to the engine, never after, since the point is to
// avoid engine load for requests that shouldn't happen.
export async function checkQuota(userId: string): Promise<QuotaStatus> {
  const [info, used] = await Promise.all([getUserPlanInfo(userId), getMonthlyUsage(userId)]);
  return decideQuota(info.plan, used, info.callLimitOverride);
}
