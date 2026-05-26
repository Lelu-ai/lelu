import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

type Decision = "allow" | "deny" | "human_review";

interface PolicyRule {
  pattern: RegExp;
  decision: Decision;
  reason: string;
  rule: string;
}

const RULES: PolicyRule[] = [
  {
    pattern: /delete|drop|truncate|destroy|wipe|purge|erase|remove_all|bulk_delete/i,
    decision: "deny",
    reason: "Destructive operations are blocked by the default safety policy.",
    rule: "deny:destructive-ops",
  },
  {
    pattern: /exec|shell|bash|cmd|spawn|run_code|eval|system_call|subprocess/i,
    decision: "deny",
    reason: "Shell and code execution require explicit policy allowance — denied by default.",
    rule: "deny:shell-execution",
  },
  {
    pattern: /sudo|escalate|override_policy|bypass|disable_audit/i,
    decision: "deny",
    reason: "Privilege escalation attempts are always denied.",
    rule: "deny:privilege-escalation",
  },
  {
    pattern: /transfer_funds|wire_transfer|payment|charge|refund|billing|withdraw/i,
    decision: "human_review",
    reason: "Financial operations require a human to approve before execution.",
    rule: "review:financial-ops",
  },
  {
    pattern: /send_email|send_message|post_tweet|publish|notify|broadcast|alert_user/i,
    decision: "human_review",
    reason: "Outbound communications require human sign-off to prevent misuse.",
    rule: "review:outbound-comms",
  },
  {
    pattern: /update_config|modify_policy|change_permission|set_role|grant_access/i,
    decision: "human_review",
    reason: "Configuration changes affecting security boundaries require manual review.",
    rule: "review:config-change",
  },
  {
    pattern: /read|get|fetch|list|search|query|find|view|show|describe|inspect/i,
    decision: "allow",
    reason: "Read-only operations are permitted by the default policy.",
    rule: "allow:read-ops",
  },
  {
    pattern: /create|insert|add|upload|write|save|store/i,
    decision: "allow",
    reason: "Non-destructive write operations are allowed by default.",
    rule: "allow:write-ops",
  },
];

const DEFAULT: Omit<PolicyRule, "pattern"> = {
  decision: "allow",
  reason: "No matching deny or review rule found. Operation permitted by default.",
  rule: "allow:default-fallthrough",
};

function evaluate(tool: string): { decision: Decision; reason: string; rule: string } {
  for (const r of RULES) {
    if (r.pattern.test(tool)) {
      return { decision: r.decision, reason: r.reason, rule: r.rule };
    }
  }
  return DEFAULT;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tool, context, args } = (body as Record<string, unknown>) ?? {};

  if (typeof tool !== "string" || !tool.trim()) {
    return NextResponse.json({ error: "tool is required" }, { status: 400 });
  }
  if (tool.length > 128) {
    return NextResponse.json({ error: "tool name too long (max 128 chars)" }, { status: 400 });
  }

  const start = Date.now();
  const result = evaluate(tool.trim());
  const latencyMs = Date.now() - start + Math.floor(Math.random() * 8 + 2); // realistic latency

  return NextResponse.json({
    requestId: `req_${randomBytes(8).toString("hex")}`,
    tool: tool.trim(),
    context: typeof context === "string" ? context : undefined,
    args: args && typeof args === "object" ? args : undefined,
    decision: result.decision,
    reason: result.reason,
    rule: result.rule,
    latencyMs,
    timestamp: new Date().toISOString(),
  });
}
