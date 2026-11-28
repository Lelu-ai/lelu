// The hosted plans, in one place. Pure (no network, no database) so the
// pricing page, quota checks, webhook and overage job all read the same
// numbers and the logic can be unit tested.
//
// Pricing is per authorize call, not per seat or agent: every plan has
// unlimited agents and team members. Free stops at its limit. Paid plans keep
// working past it and the extra calls are billed at the end of the month.

export type PlanId = "free" | "starter" | "growth" | "enterprise";

/** Plans a customer can buy on their own through checkout. */
export type SelfServePlan = "starter" | "growth";
export const SELF_SERVE_PLANS: readonly SelfServePlan[] = ["starter", "growth"];

export interface PlanDef {
  id: PlanId;
  name: string;
  /** Monthly price in USD; null means custom (Enterprise). */
  priceUsd: number | null;
  /** Authorize calls included each calendar month. */
  includedCalls: number;
  /** Whether calls past the included amount are allowed and billed. */
  overage: boolean;
  /** Days of audit history shown; null means unlimited. */
  auditRetentionDays: number | null;
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: { id: "free", name: "Free", priceUsd: 0, includedCalls: 1_000, overage: false, auditRetentionDays: 30 },
  starter: { id: "starter", name: "Starter", priceUsd: 20, includedCalls: 100_000, overage: true, auditRetentionDays: null },
  growth: { id: "growth", name: "Growth", priceUsd: 99, includedCalls: 1_000_000, overage: true, auditRetentionDays: null },
  // Volume is set per account with lelu_users.call_limit_override.
  enterprise: { id: "enterprise", name: "Enterprise", priceUsd: null, includedCalls: 10_000_000, overage: true, auditRetentionDays: null },
};

/** Price of overage, in USD per block of OVERAGE_BLOCK calls. */
export const OVERAGE_USD_PER_BLOCK = 0.5;
export const OVERAGE_BLOCK = 1_000;

/**
 * Maps a stored plan value to a plan. "paid" is the single paid plan that
 * existed before Starter and Growth; those subscribers are on Starter's
 * price and limits. Anything unknown is treated as Free, never as paid.
 */
export function normalizePlan(stored: string | null | undefined): PlanId {
  if (stored === "paid") return "starter";
  if (stored === "starter" || stored === "growth" || stored === "enterprise") return stored;
  return "free";
}

export function isPaidPlan(plan: PlanId): boolean {
  return plan !== "free";
}

/** Calls included this month, honouring a per-account override when set. */
export function includedCalls(plan: PlanId, override?: number | null): number {
  if (typeof override === "number" && Number.isFinite(override) && override > 0) return Math.floor(override);
  return PLANS[plan].includedCalls;
}

export interface QuotaDecision {
  plan: PlanId;
  /** Calls included this month. */
  limit: number;
  used: number;
  /** Whether one more call may run. */
  allowed: boolean;
  /** Calls past the included amount so far (0 when under). */
  overageCalls: number;
}

/** Whether another call may run, given the calls already used this month. */
export function decideQuota(plan: PlanId, used: number, override?: number | null): QuotaDecision {
  const limit = includedCalls(plan, override);
  const overageCalls = Math.max(0, used - limit);
  const allowed = used < limit || PLANS[plan].overage;
  return { plan, limit, used, allowed, overageCalls };
}

/** Billable overage blocks for a month: partial blocks round up. */
export function overageBlocks(overageCalls: number): number {
  if (!Number.isFinite(overageCalls) || overageCalls <= 0) return 0;
  return Math.ceil(overageCalls / OVERAGE_BLOCK);
}

/** Overage cost in USD for a month, for display. */
export function overageUsd(overageCalls: number): number {
  return overageBlocks(overageCalls) * OVERAGE_USD_PER_BLOCK;
}

/** True when moving from `from` to `to` is an upgrade (a higher price). */
export function isUpgrade(from: PlanId, to: PlanId): boolean {
  const rank: Record<PlanId, number> = { free: 0, starter: 1, growth: 2, enterprise: 3 };
  return rank[to] > rank[from];
}

/** The [start, end) of the calendar month (UTC) that contains `date`. */
export function monthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, end };
}

/** The [start, end) of the calendar month (UTC) before the one containing `date`. */
export function previousMonthRange(date: Date): { start: Date; end: Date } {
  return monthRange(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)));
}

// ── Paddle price ids ─────────────────────────────────────────────────────────

export interface PriceIds {
  starter: string;
  growth: string | null;
  /** Price for one OVERAGE_BLOCK of calls; null disables overage billing. */
  overage: string | null;
  /**
   * The old single "Pro" price (PADDLE_PRICE_ID) when it differs from
   * Starter's. Existing subscribers stay on it and are treated as Starter;
   * new checkouts always use `starter`.
   */
  legacyStarter: string | null;
}

/**
 * Reads the Paddle price ids. PADDLE_PRICE_ID is the old single paid price and
 * is accepted for Starter so existing deployments keep working. Returns null
 * when no Starter price is set (billing not configured).
 */
export function priceIdsFromEnv(env: NodeJS.ProcessEnv = process.env): PriceIds | null {
  const legacy = env.PADDLE_PRICE_ID || null;
  const starter = env.PADDLE_PRICE_ID_STARTER || legacy;
  if (!starter) return null;
  return {
    starter,
    growth: env.PADDLE_PRICE_ID_GROWTH || null,
    overage: env.PADDLE_PRICE_ID_OVERAGE || null,
    legacyStarter: legacy && legacy !== starter ? legacy : null,
  };
}

/** Which plan a subscription price belongs to, or null for any other price. */
export function planForPriceId(priceId: string | null | undefined, ids: PriceIds | null): SelfServePlan | null {
  if (!priceId || !ids) return null;
  if (priceId === ids.starter || (ids.legacyStarter && priceId === ids.legacyStarter)) return "starter";
  if (ids.growth && priceId === ids.growth) return "growth";
  return null;
}

export function priceIdForPlan(plan: SelfServePlan, ids: PriceIds): string | null {
  return plan === "starter" ? ids.starter : ids.growth;
}
