// Unit tests for lib/billing (plans, Paddle signature and event mapping, checkout state).
// Run: node scripts/paddle-billing.test.mjs   (or: npm run test:billing)
// The module is TypeScript, so it is transpiled in memory with the repo's own
// `typescript` dependency; no extra tooling is needed.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import ts from "typescript";

const load = async (file) => {
  const src = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
};
const m = await load("../lib/billing/paddle.ts");
const cs = await load("../lib/billing/checkout-state.ts");
const p = await load("../lib/billing/plans.ts");

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log("PASS  " + name); }
  catch (e) { console.error("FAIL  " + name + "\n      " + e.message); process.exitCode = 1; }
};

const SECRET = "pdl_ntfset_test_secret";
const NOW = 1_800_000_000;
const sign = (body, ts = NOW, secret = SECRET) => `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex")}`;
const body = JSON.stringify({ event_type: "subscription.created", occurred_at: "2026-11-18T10:00:00Z", data: { id: "sub_1" } });

// ── signature ──
test("accepts a correctly signed body", () => assert.equal(m.verifyPaddleSignature(body, sign(body), SECRET, NOW), true));
test("rejects a tampered body", () => assert.equal(m.verifyPaddleSignature(body + " ", sign(body), SECRET, NOW), false));
test("rejects the wrong secret", () => assert.equal(m.verifyPaddleSignature(body, sign(body, NOW, "other"), SECRET, NOW), false));
test("rejects a missing or empty header", () => {
  assert.equal(m.verifyPaddleSignature(body, null, SECRET, NOW), false);
  assert.equal(m.verifyPaddleSignature(body, "", SECRET, NOW), false);
});
test("rejects a missing secret", () => assert.equal(m.verifyPaddleSignature(body, sign(body), "", NOW), false));
test("rejects a header with no h1 or no ts", () => {
  assert.equal(m.verifyPaddleSignature(body, `ts=${NOW}`, SECRET, NOW), false);
  assert.equal(m.verifyPaddleSignature(body, "h1=abcd", SECRET, NOW), false);
});
test("rejects a stale timestamp, accepts one inside the tolerance", () => {
  assert.equal(m.verifyPaddleSignature(body, sign(body, NOW - 301), SECRET, NOW), false);
  assert.equal(m.verifyPaddleSignature(body, sign(body, NOW - 299), SECRET, NOW), true);
  assert.equal(m.verifyPaddleSignature(body, sign(body, NOW + 301), SECRET, NOW), false);
});
test("rejects non-hex and wrong-length signatures without throwing", () => {
  assert.equal(m.verifyPaddleSignature(body, `ts=${NOW};h1=not-hex`, SECRET, NOW), false);
  assert.equal(m.verifyPaddleSignature(body, `ts=${NOW};h1=abcd`, SECRET, NOW), false);
});
test("accepts when any one of several h1 values matches (secret rotation)", () => {
  const good = sign(body).split(";")[1];
  assert.equal(m.verifyPaddleSignature(body, `ts=${NOW};h1=${"0".repeat(64)};${good}`, SECRET, NOW), true);
});


// ── plans ──
test("plans: Free 1K hard stop, Starter $20/100K, Growth $99/1M, both billing overage", () => {
  assert.deepEqual([p.PLANS.free.includedCalls, p.PLANS.free.overage, p.PLANS.free.priceUsd], [1000, false, 0]);
  assert.deepEqual([p.PLANS.starter.includedCalls, p.PLANS.starter.overage, p.PLANS.starter.priceUsd], [100000, true, 20]);
  assert.deepEqual([p.PLANS.growth.includedCalls, p.PLANS.growth.overage, p.PLANS.growth.priceUsd], [1000000, true, 99]);
  assert.equal(p.PLANS.free.auditRetentionDays, 30);
  assert.equal(p.PLANS.starter.auditRetentionDays, null);
});
test("normalizePlan: legacy 'paid' is Starter; unknown values are Free, never paid", () => {
  assert.equal(p.normalizePlan("paid"), "starter");
  for (const s of ["starter", "growth", "enterprise", "free"]) assert.equal(p.normalizePlan(s), s);
  for (const s of [null, undefined, "", "pro", "PAID", "admin"]) assert.equal(p.normalizePlan(s), "free", String(s));
});
test("decideQuota: Free stops at its limit", () => {
  assert.equal(p.decideQuota("free", 999).allowed, true);
  assert.equal(p.decideQuota("free", 1000).allowed, false);
  assert.equal(p.decideQuota("free", 5000).allowed, false);
});
test("decideQuota: paid plans keep going past the limit and count the overage", () => {
  const q = p.decideQuota("starter", 100_250);
  assert.deepEqual([q.allowed, q.limit, q.overageCalls], [true, 100000, 250]);
  assert.equal(p.decideQuota("growth", 10).overageCalls, 0);
});
test("decideQuota: a positive per-account override replaces the plan's volume", () => {
  assert.equal(p.decideQuota("enterprise", 0, 5_000_000).limit, 5000000);
  assert.equal(p.decideQuota("free", 1500, 2000).allowed, true);
  for (const bad of [null, undefined, 0, -5, NaN]) assert.equal(p.decideQuota("starter", 0, bad).limit, 100000, String(bad));
});
test("overage: partial blocks round up; nothing over means nothing billed", () => {
  assert.equal(p.overageBlocks(0), 0);
  assert.equal(p.overageBlocks(-3), 0);
  assert.equal(p.overageBlocks(1), 1);
  assert.equal(p.overageBlocks(1000), 1);
  assert.equal(p.overageBlocks(1001), 2);
  assert.equal(p.overageUsd(250), 0.5);
  assert.equal(p.overageUsd(2_000_000), 1000);
});
test("isUpgrade follows price order", () => {
  assert.equal(p.isUpgrade("free", "starter"), true);
  assert.equal(p.isUpgrade("starter", "growth"), true);
  assert.equal(p.isUpgrade("growth", "starter"), false);
  assert.equal(p.isUpgrade("starter", "starter"), false);
});
test("previousMonthRange covers the whole prior UTC month, including across a year", () => {
  const r = p.previousMonthRange(new Date("2026-12-01T03:00:00Z"));
  assert.deepEqual([r.start.toISOString(), r.end.toISOString()], ["2026-11-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z"]);
  const j = p.previousMonthRange(new Date("2027-01-15T12:00:00Z"));
  assert.deepEqual([j.start.toISOString(), j.end.toISOString()], ["2026-12-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z"]);
});
test("priceIdsFromEnv: Starter is required; the old PADDLE_PRICE_ID still works for it", () => {
  assert.equal(p.priceIdsFromEnv({}), null);
  assert.deepEqual(p.priceIdsFromEnv({ PADDLE_PRICE_ID: "pri_old" }), { starter: "pri_old", growth: null, overage: null, legacyStarter: null });
  assert.deepEqual(
    p.priceIdsFromEnv({ PADDLE_PRICE_ID: "pri_old", PADDLE_PRICE_ID_STARTER: "pri_s", PADDLE_PRICE_ID_GROWTH: "pri_g", PADDLE_PRICE_ID_OVERAGE: "pri_o" }),
    { starter: "pri_s", growth: "pri_g", overage: "pri_o", legacyStarter: "pri_old" },
  );
});
const IDS = { starter: "pri_s", growth: "pri_g", overage: "pri_o", legacyStarter: "pri_old" };
test("planForPriceId maps only our plan prices; overage and unknown prices grant nothing", () => {
  assert.equal(p.planForPriceId("pri_s", IDS), "starter");
  assert.equal(p.planForPriceId("pri_g", IDS), "growth");
  for (const x of ["pri_o", "pri_other", "", null, undefined]) assert.equal(p.planForPriceId(x, IDS), null, String(x));
  assert.equal(p.planForPriceId("pri_s", null), null);
});
test("existing Pro subscribers on the old price are recognised as Starter", () => {
  assert.equal(p.planForPriceId("pri_old", IDS), "starter");
  assert.equal(p.planForPriceId("pri_old", { ...IDS, legacyStarter: null }), null);
});

// ── Paddle event mapping ──
const forPrice = (id) => p.planForPriceId(id, IDS);
test("isPayingStatus: paying and grace states only", () => {
  for (const s of ["active", "trialing", "past_due"]) assert.equal(m.isPayingStatus(s), true, s);
  for (const s of ["canceled", "paused", "", undefined, null, "weird"]) assert.equal(m.isPayingStatus(s), false, String(s));
});

const ev = (event_type, status, extra = {}, price = "pri_s") => ({
  event_type, occurred_at: "2026-11-18T10:00:00Z",
  data: { id: "sub_1", customer_id: "ctm_1", status, custom_data: { user_id: "user-1" }, items: [{ price: { id: price } }], ...extra },
});

test("an active Starter subscription maps to a starter change for that user", () => {
  const c = m.planChangeFromEvent(ev("subscription.created", "active"), forPrice);
  assert.deepEqual({ ...c, occurredAt: c.occurredAt.toISOString() }, {
    userId: "user-1", customerId: "ctm_1", subscriptionId: "sub_1", plan: "starter",
    occurredAt: "2026-11-18T10:00:00.000Z", eventType: "subscription.created",
  });
});
test("the plan follows the subscription's price (Growth, and a switch between plans)", () => {
  assert.equal(m.planChangeFromEvent(ev("subscription.created", "active", {}, "pri_g"), forPrice).plan, "growth");
  assert.equal(m.planChangeFromEvent(ev("subscription.updated", "active", {}, "pri_s"), forPrice).plan, "starter");
});
test("the first known price wins when a subscription has several items", () => {
  const e = ev("subscription.updated", "active", { items: [{ price: { id: "pri_addon" } }, { price: { id: "pri_g" } }] });
  assert.equal(m.planChangeFromEvent(e, forPrice).plan, "growth");
});
test("a paying subscription to an unknown price is ignored, not guessed", () => {
  assert.equal(m.planChangeFromEvent(ev("subscription.created", "active", {}, "pri_other"), forPrice), null);
  assert.equal(m.planChangeFromEvent(ev("subscription.created", "active", { items: [] }), forPrice), null);
  assert.equal(m.planChangeFromEvent(ev("subscription.created", "active", { items: "x" }), forPrice), null);
});
test("subscription.canceled and subscription.paused are always free, whatever the price", () => {
  assert.equal(m.planChangeFromEvent(ev("subscription.canceled", "active"), forPrice).plan, "free");
  assert.equal(m.planChangeFromEvent(ev("subscription.paused", "active", {}, "pri_other"), forPrice).plan, "free");
});
test("past_due keeps the user on their plan (grace period)", () =>
  assert.equal(m.planChangeFromEvent(ev("subscription.past_due", "past_due", {}, "pri_g"), forPrice).plan, "growth"));
test("a later event without custom data still carries the customer id", () => {
  const c = m.planChangeFromEvent(ev("subscription.updated", "active", { custom_data: null }), forPrice);
  assert.equal(c.userId, null); assert.equal(c.customerId, "ctm_1");
});
test("non-subscription events are ignored", () => {
  assert.equal(m.planChangeFromEvent(ev("transaction.completed", "completed"), forPrice), null);
  assert.equal(m.planChangeFromEvent(ev("customer.created", "active"), forPrice), null);
});
test("malformed payloads are ignored, never thrown", () => {
  for (const bad of [null, undefined, "x", 5, [], {}, { event_type: "subscription.created" },
    { event_type: "subscription.created", occurred_at: "garbage", data: {} },
    { event_type: "subscription.created", occurred_at: "2026-11-18T10:00:00Z", data: null }]) {
    assert.equal(m.planChangeFromEvent(bad, forPrice), null, JSON.stringify(bad));
  }
});

// ── config and request bodies ──
test("paddleConfig is null unless both the client token and prices are set", () => {
  assert.equal(m.paddleConfig(null, {}), null);
  assert.equal(m.paddleConfig(null, { NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_x" }), null);
  assert.equal(m.paddleConfig(IDS, {}), null);
});
test("paddleConfig defaults to the sandbox and only uses production when asked", () => {
  const base = { NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_x" };
  assert.equal(m.paddleConfig(IDS, base).environment, "sandbox");
  assert.equal(m.paddleConfig(IDS, { ...base, PADDLE_ENVIRONMENT: "production" }).environment, "production");
  assert.equal(m.paddleApiBase({}), "https://sandbox-api.paddle.com");
  assert.equal(m.paddleApiBase({ PADDLE_ENVIRONMENT: "production" }), "https://api.paddle.com");
});
test("changePlanRequest: upgrades charge now, downgrades credit the next bill", () => {
  assert.deepEqual(m.changePlanRequest("pri_g", true), { items: [{ price_id: "pri_g", quantity: 1 }], proration_billing_mode: "prorated_immediately" });
  assert.equal(m.changePlanRequest("pri_s", false).proration_billing_mode, "prorated_next_billing_period");
});
test("overageChargeRequest adds the blocks to the next renewal invoice", () => {
  assert.deepEqual(m.overageChargeRequest("pri_o", 7), { effective_from: "next_billing_period", items: [{ price_id: "pri_o", quantity: 7 }] });
});

// ── checkout state (pricing page / dashboard) ──
const okBody = {
  environment: "sandbox", clientToken: "test_x", priceIds: { starter: "pri_s", growth: "pri_g" },
  email: "a@b.co", userId: "u1", currentPlan: "free", hasSubscription: false, paddleCustomerId: null,
};
test("config 200 with a complete body is ready", () => {
  const r = cs.classifyConfigResponse(200, okBody);
  assert.equal(r.status, "ready"); assert.deepEqual(r.config, okBody);
});
test("paddleCustomerId passes through only when it is a Paddle customer id", () => {
  assert.equal(cs.classifyConfigResponse(200, { ...okBody, paddleCustomerId: "ctm_123" }).config.paddleCustomerId, "ctm_123");
  assert.equal(cs.classifyConfigResponse(200, { ...okBody, paddleCustomerId: "u1" }).config.paddleCustomerId, null);
  const { paddleCustomerId, ...older } = okBody;
  assert.equal(cs.classifyConfigResponse(200, older).config.paddleCustomerId, null);
});
test("Growth may be unconfigured (null) and the body is still ready", () => {
  assert.equal(cs.classifyConfigResponse(200, { ...okBody, priceIds: { starter: "pri_s", growth: null } }).status, "ready");
});
test("config 401 means signed out, 503 means billing is not configured", () => {
  assert.equal(cs.classifyConfigResponse(401, { error: "Unauthorized" }).status, "signed_out");
  assert.equal(cs.classifyConfigResponse(503, { error: "x" }).status, "unconfigured");
});
test("anything else, or an incomplete body, is an error, never ready", () => {
  assert.equal(cs.classifyConfigResponse(500, okBody).status, "error");
  assert.equal(cs.classifyConfigResponse(200, null).status, "error");
  assert.equal(cs.classifyConfigResponse(200, "x").status, "error");
  for (const k of ["clientToken", "userId"]) assert.equal(cs.classifyConfigResponse(200, { ...okBody, [k]: "" }).status, "error", k);
  assert.equal(cs.classifyConfigResponse(200, { ...okBody, environment: "staging" }).status, "error");
  assert.equal(cs.classifyConfigResponse(200, { ...okBody, email: undefined }).status, "error");
  assert.equal(cs.classifyConfigResponse(200, { ...okBody, priceIds: { starter: "", growth: "pri_g" } }).status, "error");
  assert.equal(cs.classifyConfigResponse(200, { ...okBody, priceIds: undefined }).status, "error");
  assert.equal(cs.classifyConfigResponse(200, { ...okBody, currentPlan: "pro" }).status, "error");
  assert.equal(cs.classifyConfigResponse(200, { ...okBody, hasSubscription: "yes" }).status, "error");
});
test("planAction: free users check out; subscribers switch in place; current plan is current", () => {
  const cfg = (over) => ({ ...okBody, ...over });
  assert.equal(cs.planAction(cfg({}), "starter"), "checkout");
  assert.equal(cs.planAction(cfg({ currentPlan: "starter", hasSubscription: true }), "growth"), "change");
  assert.equal(cs.planAction(cfg({ currentPlan: "growth", hasSubscription: true }), "starter"), "change");
  assert.equal(cs.planAction(cfg({ currentPlan: "starter", hasSubscription: true }), "starter"), "current");
  assert.equal(cs.planAction(cfg({ priceIds: { starter: "pri_s", growth: null } }), "growth"), "unavailable");
  assert.equal(cs.planAction(cfg({ currentPlan: "enterprise", hasSubscription: true }), "growth"), "contact");
  // A canceled subscriber (back on free, old subscription id kept) checks out again.
  assert.equal(cs.planAction(cfg({ currentPlan: "free", hasSubscription: true }), "starter"), "checkout");
});
test("a signed-out visitor returns to the pricing page with that plan's checkout set to open", () => {
  assert.equal(cs.loginUrlForUpgrade("growth"), "/login?next=%2Fpricing%3Fupgrade%3Dgrowth");
});

console.log(`\n${passed} test(s) passed${process.exitCode ? ", with failures" : ""}`);
