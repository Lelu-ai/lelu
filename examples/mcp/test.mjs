import assert from "node:assert/strict";
import http from "node:http";
import { authorizeToolCall } from "./server.mjs";

console.log("Running Lelu MCP Authorization tests...");

// 1. Test Fail-Closed behavior when Lelu is unreachable
{
  const result = await authorizeToolCall("delete_production_database", { table_name: "users" });
  assert.equal(result.allowed, false, "Must fail closed when Lelu is offline");
  assert.equal(result.decision, "deny");
  assert.ok(result.reason.includes("Fail-Closed"));
  console.log("✔ Fail-Closed offline test passed");
}

// 2. Test mock Lelu server responses (Allow, Human Review, Deny)
{
  let mockDecision = { allowed: true };
  const mockServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(mockDecision));
  });

  await new Promise((resolve) => mockServer.listen(18088, resolve));
  process.env.LELU_URL = "http://localhost:18088";

  try {
    // 2a. Allow scenario
    mockDecision = { allowed: true, reason: "Read permission granted" };
    const allowRes = await authorizeToolCall("read_customer_data", { customer_id: "c_123" });
    assert.equal(allowRes.allowed, true);
    assert.equal(allowRes.decision, "allow");
    console.log("✔ Lelu ALLOW scenario passed");

    // 2b. Human Review scenario
    mockDecision = { allowed: true, requires_human_review: true, reason: "Refund over $500 requires approval", trace_id: "tr_999" };
    const reviewRes = await authorizeToolCall("issue_refund", { customer_id: "c_123", amount_usd: 1000 });
    assert.equal(reviewRes.allowed, false);
    assert.equal(reviewRes.decision, "human_review");
    assert.equal(reviewRes.requires_human_review, true);
    console.log("✔ Lelu HUMAN REVIEW scenario passed");

    // 2c. Deny scenario
    mockDecision = { allowed: false, reason: "Dangerous production database deletion forbidden" };
    const denyRes = await authorizeToolCall("delete_production_database", { table_name: "users" });
    assert.equal(denyRes.allowed, false);
    assert.equal(denyRes.decision, "deny");
    console.log("✔ Lelu DENY scenario passed");
  } finally {
    mockServer.close();
  }
}

console.log("All Lelu MCP authorization tests passed successfully!");
