// What the pricing page and dashboard need to know before offering checkout.
// Pure (no DOM, no network) so it can be unit tested.

import type { PlanId, SelfServePlan } from "./plans";

export interface CheckoutConfig {
  environment: "sandbox" | "production";
  clientToken: string;
  /** Paddle price per plan; growth is null until it is configured. */
  priceIds: { starter: string; growth: string | null };
  email: string;
  userId: string;
  currentPlan: PlanId;
  hasSubscription: boolean;
}

export type CheckoutState =
  | { status: "ready"; config: CheckoutConfig }
  | { status: "signed_out" } // no session: send the visitor to sign in first
  | { status: "unconfigured" } // the server has no Paddle settings: checkout is not open yet
  | { status: "error" }; // anything unexpected: do not guess, let the visitor retry

const PLAN_IDS: readonly string[] = ["free", "starter", "growth", "enterprise"];

// Classifies the answer of GET /api/billing/paddle/config.
export function classifyConfigResponse(httpStatus: number, body: unknown): CheckoutState {
  if (httpStatus === 401) return { status: "signed_out" };
  if (httpStatus === 503) return { status: "unconfigured" };
  if (httpStatus !== 200 || !body || typeof body !== "object") return { status: "error" };

  const b = body as Record<string, unknown>;
  const environment = b.environment === "production" ? "production" : b.environment === "sandbox" ? "sandbox" : null;
  const { clientToken, email, userId, currentPlan, hasSubscription } = b;
  const prices = b.priceIds && typeof b.priceIds === "object" ? (b.priceIds as Record<string, unknown>) : null;
  const starter = prices?.starter;
  const growth = prices?.growth;
  if (
    !environment ||
    typeof clientToken !== "string" || !clientToken ||
    typeof starter !== "string" || !starter ||
    (growth !== null && (typeof growth !== "string" || !growth)) ||
    typeof email !== "string" ||
    typeof userId !== "string" || !userId ||
    typeof currentPlan !== "string" || !PLAN_IDS.includes(currentPlan) ||
    typeof hasSubscription !== "boolean"
  ) {
    return { status: "error" };
  }
  return {
    status: "ready",
    config: {
      environment,
      clientToken,
      priceIds: { starter, growth: growth as string | null },
      email,
      userId,
      currentPlan: currentPlan as PlanId,
      hasSubscription,
    },
  };
}

/**
 * What a plan's button should do for this visitor:
 *  - "current":     they are already on it
 *  - "checkout":    no subscription yet, so open Paddle's checkout
 *  - "change":      they subscribe to another plan, so switch it in place
 *  - "unavailable": this plan has no price configured yet
 *  - "contact":     they are on a custom (Enterprise) plan; changes go through us
 */
export type PlanAction = "current" | "checkout" | "change" | "unavailable" | "contact";

export function planAction(config: CheckoutConfig, plan: SelfServePlan): PlanAction {
  if (config.currentPlan === plan) return "current";
  if (config.currentPlan === "enterprise") return "contact";
  if (!config.priceIds[plan]) return "unavailable";
  return config.hasSubscription && config.currentPlan !== "free" ? "change" : "checkout";
}

// Where a signed-out visitor goes to sign in and come back to the pricing page
// with checkout for `plan` opening by itself.
export function upgradeReturnPath(plan: SelfServePlan): string {
  return `/pricing?upgrade=${plan}`;
}
export function loginUrlForUpgrade(plan: SelfServePlan): string {
  return `/login?next=${encodeURIComponent(upgradeReturnPath(plan))}`;
}
