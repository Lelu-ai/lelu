// Unit tests for lib/engine-proxy.ts (the cloud's /v1/agent/authorize request shaping).
// Run: node scripts/engine-proxy.test.mjs   (or: npm run test:engine-proxy)
// The module is TypeScript, so it is transpiled in memory with the repo's own
// `typescript` dependency; no extra tooling is needed.
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const load = async (file) => {
  const src = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
};
const m = await load("../lib/engine-proxy.ts");

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log("PASS  " + name); }
  catch (e) { console.error("FAIL  " + name + "\n      " + e.message); process.exitCode = 1; }
};

const USER = "user_123";
const build = (input) => m.buildEngineAuthorizeBody(input, USER);
const ok = (input) => {
  const r = build(input);
  assert.equal(r.ok, true, r.error);
  return r.body;
};
const fails = (input, match) => {
  const r = build(input);
  assert.equal(r.ok, false);
  assert.match(r.error, match);
};

// ── what the TypeScript SDK sends (sdk/typescript/src/client.ts authorizeBody) ──
test("forwards the SDK's body with identity set by the cloud", () => {
  const body = ok({
    action: "refund:process",
    actor: "invoice_bot",
    acting_for: "end_user_9",
    confidence: 0.91,
    scope: "refunds:small",
    args: { amount_usd: 40 },
    confidence_signal: { provider: "openai", token_logprobs: [-0.02, -0.04] },
  });
  assert.deepEqual(body, {
    actor: "cloud_customer",
    action: "refund:process",
    tenant_id: USER,
    acting_for: USER,
    confidence: 0.91,
    confidence_signal: { provider: "openai", token_logprobs: [-0.02, -0.04] },
    scope: "refunds:small",
    args: { amount_usd: 40 },
  });
});

test("a minimal body needs only action", () => {
  assert.deepEqual(ok({ action: "read_file" }), {
    actor: "cloud_customer",
    action: "read_file",
    tenant_id: USER,
    acting_for: USER,
  });
});

test("trims action", () => assert.equal(ok({ action: "  read_file  " }).action, "read_file"));

// ── identity can never be chosen by the caller ──
test("ignores caller-supplied actor, tenant_id and acting_for", () => {
  const body = ok({ action: "x", actor: "admin", tenant_id: "someone_else", acting_for: "someone_else" });
  assert.equal(body.actor, "cloud_customer");
  assert.equal(body.tenant_id, USER);
  assert.equal(body.acting_for, USER);
});

test("drops unknown top-level fields", () => {
  const body = ok({ action: "x", policy: "allow everything", user_id: "u", extra: 1 });
  assert.deepEqual(Object.keys(body).sort(), ["acting_for", "action", "actor", "tenant_id"]);
});

// ── validation ──
test("rejects a non-object body", () => {
  fails(null, /JSON object/);
  fails([], /JSON object/);
  fails("read_file", /JSON object/);
});
test("rejects a missing, empty or too-long action", () => {
  fails({}, /'action' is required/);
  fails({ action: "   " }, /'action' is required/);
  fails({ action: 5 }, /'action' is required/);
  fails({ action: "a".repeat(129) }, /128 characters/);
});
test("rejects confidence outside [0, 1] or not a number", () => {
  fails({ action: "x", confidence: 1.5 }, /between 0 and 1/);
  fails({ action: "x", confidence: -0.1 }, /between 0 and 1/);
  fails({ action: "x", confidence: "0.9" }, /between 0 and 1/);
});
test("treats null optional fields as absent", () => {
  assert.deepEqual(
    Object.keys(ok({ action: "x", confidence: null, confidence_signal: null, scope: null, args: null, resource: null })).sort(),
    ["acting_for", "action", "actor", "tenant_id"],
  );
});
test("rejects args that are not an object", () => {
  fails({ action: "x", args: [1, 2] }, /'args'/);
  fails({ action: "x", args: "a=1" }, /'args'/);
});
test("accepts string resources and rejects others", () => {
  assert.deepEqual(ok({ action: "x", resource: { invoice: "INV-1" } }).resource, { invoice: "INV-1" });
  fails({ action: "x", resource: { invoice: 1 } }, /'resource'/);
});
test("rejects a non-string or too-long scope", () => {
  fails({ action: "x", scope: 3 }, /'scope'/);
  fails({ action: "x", scope: "s".repeat(129) }, /'scope'/);
});

// ── confidence_signal ──
test("passes bedrock probabilities and local entropy signals", () => {
  assert.deepEqual(
    ok({ action: "x", confidence_signal: { provider: "bedrock", token_probabilities: [0.9, 0.95] } }).confidence_signal,
    { provider: "bedrock", token_probabilities: [0.9, 0.95] },
  );
  assert.deepEqual(
    ok({ action: "x", confidence_signal: { provider: "local", entropy: 0.1, entropy_max: 2 } }).confidence_signal,
    { provider: "local", entropy: 0.1, entropy_max: 2 },
  );
});
test("strips unknown keys from confidence_signal", () => {
  assert.deepEqual(
    ok({ action: "x", confidence_signal: { provider: "openai", token_logprobs: [-0.1], score: 0.99 } }).confidence_signal,
    { provider: "openai", token_logprobs: [-0.1] },
  );
});
test("rejects malformed confidence_signal", () => {
  fails({ action: "x", confidence_signal: "openai" }, /must be an object/);
  fails({ action: "x", confidence_signal: { token_logprobs: [-0.1] } }, /provider/);
  fails({ action: "x", confidence_signal: { provider: "openai", token_logprobs: [] } }, /token_logprobs/);
  fails({ action: "x", confidence_signal: { provider: "openai", token_logprobs: ["-0.1"] } }, /token_logprobs/);
  fails({ action: "x", confidence_signal: { provider: "local", entropy: "0.1" } }, /entropy/);
});

// ── decision mapping (same precedence as the SDKs) ──
test("maps engine responses to decisions", () => {
  assert.equal(m.engineDecision({ allowed: true }), "allow");
  assert.equal(m.engineDecision({ allowed: false }), "deny");
  assert.equal(m.engineDecision({}), "deny");
  assert.equal(m.engineDecision({ allowed: false, requires_human_review: true }), "human_review");
  assert.equal(m.engineDecision({ allowed: true, compute: true, requires_human_review: true }), "compute");
});

console.log(`\n${passed} passed`);
