// Unit tests for lib/oauth-link.ts (what a Google/GitHub sign-in may do with an account).
// Run: node scripts/oauth-link.test.mjs   (or: npm run test:oauth-link)
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
const m = await load("../lib/oauth-link.ts");

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log("PASS  " + name); }
  catch (e) { console.error("FAIL  " + name + "\n      " + e.message); process.exitCode = 1; }
};
const decide = (o) => m.decideOAuthLink({ alreadyLinked: false, providerEmailVerified: true, existing: null, ...o });
const verifiedPw = { emailVerified: true, hasPassword: true };
const unverifiedPw = { emailVerified: false, hasPassword: true };

// ── the takeover this fixes ──
test("an unverified provider email never signs in to an existing account", () => {
  assert.deepEqual(decide({ providerEmailVerified: false, existing: verifiedPw }), { kind: "reject-unverified" });
  assert.deepEqual(decide({ providerEmailVerified: false, existing: unverifiedPw }), { kind: "reject-unverified" });
});
test("an unverified provider email never creates an account", () => {
  assert.deepEqual(decide({ providerEmailVerified: false }), { kind: "reject-unverified" });
});

// ── allowed paths ──
test("an already-linked provider account signs in, whatever the email state", () => {
  assert.deepEqual(decide({ alreadyLinked: true, providerEmailVerified: false }), { kind: "use-linked" });
  assert.deepEqual(decide({ alreadyLinked: true }), { kind: "use-linked" });
});
test("a verified email links to a verified account and keeps its password", () => {
  assert.deepEqual(decide({ existing: verifiedPw }), { kind: "link-existing", clearPassword: false, markVerified: false });
});
test("a verified email takes over an unverified account: password cleared, email verified", () => {
  assert.deepEqual(decide({ existing: unverifiedPw }), { kind: "link-existing", clearPassword: true, markVerified: true });
});
test("an unverified OAuth-only account is marked verified, nothing to clear", () => {
  assert.deepEqual(decide({ existing: { emailVerified: false, hasPassword: false } }), {
    kind: "link-existing",
    clearPassword: false,
    markVerified: true,
  });
});
test("a verified email with no account creates one", () => {
  assert.deepEqual(decide({}), { kind: "create" });
});

console.log(`\n${passed} passed`);
