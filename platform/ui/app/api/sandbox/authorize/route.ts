import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { detectInjection } from "@/lib/injection";

type Decision = "allow" | "deny" | "human_review" | "compute";

interface PolicyRule {
  pattern: RegExp;
  decision: Decision;
  reason: string;
  rule: string;
  safeTool?: string;
  safeArgs?: Record<string, unknown>;
}

// ── Fallback rule set (used only when engine is unreachable) ──────────────────
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
    pattern: /transfer|payment|charge|refund|billing|withdraw|wire/i,
    decision: "human_review",
    reason: "Financial operations require a human to approve before execution.",
    rule: "review:financial-ops",
  },
  {
    pattern: /send_email|send_message|post_tweet|publish|notify|broadcast|alert/i,
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
    pattern: /write_file|save_file|overwrite_file|update_file/i,
    decision: "compute",
    reason: "File writes are redirected to the sandbox environment for safety.",
    rule: "compute:sandbox-file-write",
    safeTool: "write_file",
    safeArgs: { path: "/tmp/sandbox/{original}", sandboxed: true },
  },
  {
    pattern: /deploy|release|push_to_prod|rollout|go_live/i,
    decision: "compute",
    reason: "Deployments are redirected to the staging environment for validation.",
    rule: "compute:staging-deploy",
    safeTool: "deploy",
    safeArgs: { environment: "staging", sandboxed: true },
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

const DEFAULT_RULE: Omit<PolicyRule, "pattern"> = {
  decision: "allow",
  reason: "No matching deny or review rule found. Operation permitted by default.",
  rule: "allow:default-fallthrough",
};

function localEvaluate(tool: string) {
  for (const r of RULES) {
    if (r.pattern.test(tool)) {
      return { decision: r.decision, reason: r.reason, rule: r.rule, safeTool: r.safeTool, safeArgs: r.safeArgs };
    }
  }
  return DEFAULT_RULE;
}

// ── Real engine proxy ─────────────────────────────────────────────────────────

const ENGINE_URL = (process.env.ENGINE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const ENGINE_API_KEY = process.env.ENGINE_API_KEY ?? "";

async function callEngine(
  tool: string,
  context?: string,
  args?: Record<string, unknown>
): Promise<{ data: Record<string, unknown>; usedEngine: true } | null> {
  try {
    const body: Record<string, unknown> = { tool };
    if (context) body.context = context;
    if (args && Object.keys(args).length > 0) body.args = args;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (ENGINE_API_KEY) headers["Authorization"] = `Bearer ${ENGINE_API_KEY}`;

    const res = await fetch(`${ENGINE_URL}/v1/authorize`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    return { data, usedEngine: true };
  } catch {
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tool, context, args, resource } = (body as Record<string, unknown>) ?? {};

  if (typeof tool !== "string" || !tool.trim()) {
    return NextResponse.json({ error: "tool is required" }, { status: 400 });
  }
  if (tool.length > 128) {
    return NextResponse.json({ error: "tool name too long (max 128 chars)" }, { status: 400 });
  }

  const toolName = tool.trim();
  const contextStr = typeof context === "string" ? context : undefined;
  const argsObj = args && typeof args === "object" ? (args as Record<string, unknown>) : undefined;
  const resourceObj = resource && typeof resource === "object" ? (resource as Record<string, unknown>) : undefined;

  const start = Date.now();

  // Try the real engine first — fall back to local rules if unreachable
  const engineResult = await callEngine(toolName, contextStr, argsObj);

  if (engineResult) {
    // Engine responded — return its decision directly, tag as real engine
    const d = engineResult.data;
    return NextResponse.json({
      ...d,
      mode: "sandbox",
      engineUsed: true,
    });
  }

  // Fallback path (engine unreachable): run the injection check FIRST, across
  // every field, so the sandbox never silently allows an obvious attack.
  const injection = detectInjection({ tool: toolName, context: contextStr, args: argsObj, resource: resourceObj });
  if (injection.detected) {
    const latencyMs = Date.now() - start + Math.floor(Math.random() * 8 + 2);
    return NextResponse.json({
      requestId: `req_${randomBytes(8).toString("hex")}`,
      tool: toolName,
      ...(contextStr ? { context: contextStr } : {}),
      ...(argsObj ? { args: argsObj } : {}),
      decision: "deny",
      reason: `prompt injection detected in ${injection.source}: "${injection.pattern}"`,
      rule: "deny:prompt-injection",
      latencyMs,
      mode: "sandbox",
      engineUsed: false,
    });
  }

  // Fallback: local rule evaluator (engine not running)
  const result = localEvaluate(toolName);
  const latencyMs = Date.now() - start + Math.floor(Math.random() * 8 + 2);

  return NextResponse.json({
    requestId: `req_${randomBytes(8).toString("hex")}`,
    tool: toolName,
    ...(contextStr ? { context: contextStr } : {}),
    ...(argsObj ? { args: argsObj } : {}),
    decision: result.decision,
    reason: result.reason,
    rule: result.rule,
    ...(result.safeTool ? { safeTool: result.safeTool } : {}),
    ...(result.safeArgs ? { safeArgs: result.safeArgs } : {}),
    latencyMs,
    mode: "sandbox",
    engineUsed: false,
  });
}
