import { db, ensureSchema } from "./db";

// Authorize calls per calendar month, by plan. Tune freely — not load-bearing
// on any architecture, just the free/paid split shown on /pricing.
export const PLAN_LIMITS = {
  free: 1_000,
  paid: 100_000,
} as const;

export type Plan = keyof typeof PLAN_LIMITS;

function limitForPlan(plan: string): number {
  return PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.free;
}

export interface QuotaStatus {
  plan: string;
  limit: number;
  used: number;
  allowed: boolean;
}

// Current calendar-month count of live (non-sandbox) authorize calls for a
// user, computed on demand from lelu_audit_events rather than a separate
// counter table — avoids write-amplification on the hot authorize path.
export async function getMonthlyUsage(userId: string): Promise<number> {
  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT COUNT(*) AS count
    FROM lelu_audit_events
    WHERE user_id = ${userId}
      AND mode = 'live'
      AND created_at >= date_trunc('month', NOW())
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function getUserPlan(userId: string): Promise<string> {
  await ensureSchema();
  const sql = db();
  const rows = await sql`SELECT plan FROM lelu_users WHERE id = ${userId}`;
  return (rows[0]?.plan as string | undefined) ?? "free";
}

// Checks whether a user has quota remaining this month. Call before proxying
// a request to the engine — never after, since the point is to avoid billing
// (and engine load) for requests that shouldn't happen.
export async function checkQuota(userId: string): Promise<QuotaStatus> {
  const [plan, used] = await Promise.all([getUserPlan(userId), getMonthlyUsage(userId)]);
  const limit = limitForPlan(plan);
  return { plan, limit, used, allowed: used < limit };
}
