import { createHmac, timingSafeEqual } from "node:crypto";

// Paddle Billing helpers. Everything in this file is pure (no network, no
// database) so it can be unit tested; the routes under app/api/billing/paddle
// do the I/O.
//
// Paddle is a merchant of record: it sells to the customer, collects tax and
// handles chargebacks. Lelu only needs to know "is this user paying right now",
// which is what `planForStatus` answers.

export type Plan = "free" | "paid";

// How far a webhook's signed timestamp may be from our clock. Paddle's SDK
// helpers default to 5 seconds; serverless clocks and retries make that too
// tight for a hand-rolled check, so we allow five minutes. A replayed event is
// harmless anyway: applyPlanChange ignores anything older than what is stored.
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export interface PaddleConfig {
  environment: "sandbox" | "production";
  /** Public client-side token (Paddle.js). Safe to send to the browser. */
  clientToken: string;
  /** Price ID (pri_...) of the paid plan. */
  priceId: string;
}

// Returns null when billing is not configured, so callers can answer 503 and
// the dashboard can simply hide the upgrade button.
export function paddleConfig(env: NodeJS.ProcessEnv = process.env): PaddleConfig | null {
  const clientToken = env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const priceId = env.PADDLE_PRICE_ID;
  if (!clientToken || !priceId) return null;
  const environment = env.PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox";
  return { environment, clientToken, priceId };
}

export function paddleApiBase(env: NodeJS.ProcessEnv = process.env): string {
  return env.PADDLE_ENVIRONMENT === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

// ── Webhook signature ────────────────────────────────────────────────────────
// Header: `Paddle-Signature: ts=<unix seconds>;h1=<hex hmac>`.
// Signed payload: `${ts}:${rawBody}`, HMAC-SHA256 with the notification
// destination's secret (pdl_ntfset_...). The body must be the raw text exactly
// as received, so callers read `await req.text()` before any JSON parsing.
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds: number = SIGNATURE_TOLERANCE_SECONDS,
): boolean {
  if (!header || !secret) return false;

  let ts = "";
  const signatures: string[] = [];
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "ts") ts = value;
    else if (key === "h1") signatures.push(value);
  }
  if (!ts || signatures.length === 0) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(nowSeconds - tsNum) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest();
  // Paddle may send several h1 values while a secret is being rotated; any
  // one matching is enough. Compare in constant time.
  return signatures.some((sig) => {
    if (!/^[0-9a-f]+$/i.test(sig) || sig.length !== expected.length * 2) return false;
    return timingSafeEqual(Buffer.from(sig, "hex"), expected);
  });
}

// ── Events → plan ────────────────────────────────────────────────────────────

// Subscription statuses Paddle reports: active, trialing, past_due, paused,
// canceled. `past_due` stays paid on purpose: Paddle retries the card for a
// while, and dropping a customer to the free tier on the first failed charge
// is both harsh and noisy. When retries run out Paddle moves the subscription
// to canceled (or paused), and that event flips the user to free.
export function planForStatus(status: string | undefined | null): Plan {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
      return "paid";
    default:
      return "free";
  }
}

export interface PlanChange {
  /** Our user id, from the checkout's custom data. Preferred match. */
  userId: string | null;
  /** Paddle customer id (ctm_...). Fallback match once a user has paid before. */
  customerId: string | null;
  subscriptionId: string | null;
  plan: Plan;
  /** When Paddle says the event happened; used to ignore stale or reordered events. */
  occurredAt: Date;
  eventType: string;
}

const SUBSCRIPTION_EVENTS = new Set([
  "subscription.created",
  "subscription.activated",
  "subscription.trialing",
  "subscription.updated",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.canceled",
]);

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// Turns a webhook body into a plan change, or null for events we do not act on
// (transactions, customers, malformed payloads). Never throws on bad input.
export function planChangeFromEvent(body: unknown): PlanChange | null {
  if (!body || typeof body !== "object") return null;
  const event = body as Record<string, unknown>;
  const eventType = str(event.event_type);
  if (!eventType || !SUBSCRIPTION_EVENTS.has(eventType)) return null;

  const data = event.data;
  if (!data || typeof data !== "object") return null;
  const sub = data as Record<string, unknown>;

  const occurredRaw = str(event.occurred_at);
  const occurredAt = occurredRaw ? new Date(occurredRaw) : new Date(NaN);
  if (Number.isNaN(occurredAt.getTime())) return null;

  const customData = sub.custom_data && typeof sub.custom_data === "object" ? (sub.custom_data as Record<string, unknown>) : {};

  // `canceled` and `paused` events always mean "not paying", whatever the
  // status field says; everything else is decided by the status.
  const plan: Plan =
    eventType === "subscription.canceled" || eventType === "subscription.paused" ? "free" : planForStatus(str(sub.status));

  return {
    userId: str(customData.user_id),
    customerId: str(sub.customer_id),
    subscriptionId: str(sub.id),
    plan,
    occurredAt,
    eventType,
  };
}
