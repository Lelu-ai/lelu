// Unit tests for lib/billing/paddle.ts (signature check and event mapping).
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

// ── plan mapping ──
test("planForStatus: paying and grace states are paid, others free", () => {
  for (const s of ["active", "trialing", "past_due"]) assert.equal(m.planForStatus(s), "paid", s);
  for (const s of ["canceled", "paused", "", undefined, null, "weird"]) assert.equal(m.planForStatus(s), "free", String(s));
});

const ev = (event_type, status, extra = {}) => ({
  event_type, occurred_at: "2026-11-18T10:00:00Z",
  data: { id: "sub_1", customer_id: "ctm_1", status, custom_data: { user_id: "user-1" }, ...extra },
});

test("subscription.created with custom data maps to a paid change for that user", () => {
  const c = m.planChangeFromEvent(ev("subscription.created", "active"));
  assert.deepEqual({ ...c, occurredAt: c.occurredAt.toISOString() }, {
    userId: "user-1", customerId: "ctm_1", subscriptionId: "sub_1", plan: "paid",
    occurredAt: "2026-11-18T10:00:00.000Z", eventType: "subscription.created",
  });
});
test("subscription.canceled and subscription.paused are always free", () => {
  assert.equal(m.planChangeFromEvent(ev("subscription.canceled", "active")).plan, "free");
  assert.equal(m.planChangeFromEvent(ev("subscription.paused", "active")).plan, "free");
});
test("past_due keeps the user paid (grace period)", () => assert.equal(m.planChangeFromEvent(ev("subscription.past_due", "past_due")).plan, "paid"));
test("a later event without custom data still carries the customer id", () => {
  const c = m.planChangeFromEvent(ev("subscription.updated", "active", { custom_data: null }));
  assert.equal(c.userId, null); assert.equal(c.customerId, "ctm_1");
});
test("non-subscription events are ignored", () => {
  assert.equal(m.planChangeFromEvent(ev("transaction.completed", "completed")), null);
  assert.equal(m.planChangeFromEvent(ev("customer.created", "active")), null);
});
test("malformed payloads are ignored, never thrown", () => {
  for (const bad of [null, undefined, "x", 5, [], {}, { event_type: "subscription.created" },
    { event_type: "subscription.created", occurred_at: "garbage", data: {} },
    { event_type: "subscription.created", occurred_at: "2026-11-18T10:00:00Z", data: null }]) {
    assert.equal(m.planChangeFromEvent(bad), null, JSON.stringify(bad));
  }
});

// ── config ──
test("paddleConfig is null unless both the client token and price id are set", () => {
  assert.equal(m.paddleConfig({}), null);
  assert.equal(m.paddleConfig({ NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_x" }), null);
  assert.equal(m.paddleConfig({ PADDLE_PRICE_ID: "pri_x" }), null);
});
test("paddleConfig defaults to the sandbox and only uses production when asked", () => {
  const base = { NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_x", PADDLE_PRICE_ID: "pri_x" };
  assert.equal(m.paddleConfig(base).environment, "sandbox");
  assert.equal(m.paddleConfig({ ...base, PADDLE_ENVIRONMENT: "production" }).environment, "production");
  assert.equal(m.paddleApiBase({}), "https://sandbox-api.paddle.com");
  assert.equal(m.paddleApiBase({ PADDLE_ENVIRONMENT: "production" }), "https://api.paddle.com");
});

// ── checkout state (pricing page / dashboard) ──
const okBody = { environment: "sandbox", clientToken: "test_x", priceId: "pri_x", email: "a@b.co", userId: "u1" };
test("config 200 with a complete body is ready", () => {
  const r = cs.classifyConfigResponse(200, okBody);
  assert.equal(r.status, "ready"); assert.deepEqual(r.config, okBody);
});
test("config 401 means signed out, 503 means billing is not configured", () => {
  assert.equal(cs.classifyConfigResponse(401, { error: "Unauthorized" }).status, "signed_out");
  assert.equal(cs.classifyConfigResponse(503, { error: "x" }).status, "unconfigured");
});
test("anything else, or an incomplete body, is an error, never ready", () => {
  assert.equal(cs.classifyConfigResponse(500, okBody).status, "error");
  assert.equal(cs.classifyConfigResponse(200, null).status, "error");
  assert.equal(cs.classifyConfigResponse(200, "x").status, "error");
  for (const k of ["clientToken", "priceId", "userId"]) assert.equal(cs.classifyConfigResponse(200, { ...okBody, [k]: "" }).status, "error", k);
  assert.equal(cs.classifyConfigResponse(200, { ...okBody, environment: "staging" }).status, "error");
  assert.equal(cs.classifyConfigResponse(200, { ...okBody, email: undefined }).status, "error");
});
test("a signed-out visitor returns to the pricing page with checkout set to open", () => {
  assert.equal(cs.loginUrlForUpgrade(), "/login?next=%2Fpricing%3Fupgrade%3D1");
});

console.log(`\n${passed} test(s) passed${process.exitCode ? ", with failures" : ""}`);
