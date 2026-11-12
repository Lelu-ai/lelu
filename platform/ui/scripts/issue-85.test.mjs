// Regression test for #85: landing page must not contain unsourced marketing
// claims or fabricated testimonials in `platform/ui/data/index.ts`.
// Run: node scripts/issue-85.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

const file = new URL("../data/index.ts", import.meta.url);
const src = fs.readFileSync(file, "utf8");

const unsourcedClaims = [
  "28k+",
  "<50ms",
  "100% Audit Coverage",
  "SOC 2 Compliant",
];

const fabricatedTestimonials = [
  "Alex River",
  "Sarah Chen",
  "David Kim",
  "V-Security",
  "AgentX",
  "SafeSwarm",
];

for (const claim of unsourcedClaims) {
  assert.ok(
    !src.includes(claim),
    `unsourced claim still present: "${claim}"`,
  );
}

for (const name of fabricatedTestimonials) {
  assert.ok(
    !src.includes(name),
    `fabricated testimonial still present: "${name}"`,
  );
}

assert.ok(src.includes("export const companies"), "companies export missing");
assert.ok(!src.includes("export const heroStats"), "heroStats export should be removed");

console.log("issue-85 test passed: no unsourced claims or fabricated testimonials.");
