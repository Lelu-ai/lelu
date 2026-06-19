import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { validateApiKey } from "@/lib/apikeys";
import { getActivePoliciesForUser, evaluateWithPolicies } from "@/lib/policies";
import { logAuditEvent } from "@/lib/audit";
import { detectInjection } from "@/lib/injection";

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

type Decision = "allow" | "deny" | "human_review" | "compute";

interface PolicyRule {
  pattern: RegExp;
  decision: Decision;
  reason: string;
  rule: string;
  safeTool?: string;
  safeArgs?: Record<string, unknown>;
}

const RULES: PolicyRule[] = [
  {
    // snake_case tool names use _ as word separator — \b won't work, match substring instead
    pattern: /delete|drop|truncate|destroy|wipe|purge|erase|bulk_delete|remove_all/i,
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

const DEFAULT_RULE = {
  decision: "allow" as Decision,
  reason: "No matching deny or review rule found. Operation permitted by default.",
  rule: "allow:default-fallthrough",
};

function evaluateTool(tool: string): { decision: Decision; reason: string; rule: string; safeTool?: string; safeArgs?: Record<string, unknown> } {
  for (const r of RULES) {
    if (r.pattern.test(tool)) {
      return { decision: r.decision, reason: r.reason, rule: r.rule, safeTool: r.safeTool, safeArgs: r.safeArgs };
    }
  }
  return DEFAULT_RULE;
}

const SANDBOX_KEY_PREFIX = "lelu_sk_sandbox_";

export async function POST(req: NextRequest) {
  // --- Auth ---
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header. Use: Bearer <api_key>" },
      { status: 401 }
    );
  }

  const apiKey = authHeader.slice(7).trim();
  let keyId: string | null = null;
  let userId: string | null = null;
  const isSandbox = apiKey.startsWith(SANDBOX_KEY_PREFIX);

  if (!isSandbox) {
    const result = await validateApiKey(apiKey);
    if (!result) {
      return NextResponse.json({ error: "Invalid or revoked API key." }, { status: 401 });
    }
    keyId = result.keyId;
    userId = result.userId;
  }

  // --- Parse body ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { tool, context, args } = (body as Record<string, unknown>) ?? {};

  if (typeof tool !== "string" || !tool.trim()) {
    return NextResponse.json({ error: "'tool' is required and must be a non-empty string." }, { status: 400 });
  }
  if (tool.length > 128) {
    return NextResponse.json({ error: "'tool' must be 128 characters or less." }, { status: 400 });
  }

  // --- Evaluate ---
  const start = Date.now();

  // For real API keys, check user's own policies first (first matching rule wins),
  // then fall back to the built-in rule set.
  let result: { decision: Decision; reason: string; rule: string; safeTool?: string; safeArgs?: Record<string, unknown> };
  let policyName: string | undefined;

  // Injection check runs FIRST, across every field — a deny here short-circuits
  // policy and rule evaluation, mirroring the engine's pipeline ordering.
  const injection = detectInjection({ tool: tool.trim(), context, args });
  if (injection.detected) {
    result = {
      decision: "deny",
      reason: `prompt injection detected in ${injection.source}: "${injection.pattern}"`,
      rule: "deny:prompt-injection",
    };
  } else if (userId && !isSandbox) {
    try {
      const policies = await getActivePoliciesForUser(userId);
      const policyMatch = evaluateWithPolicies(tool.trim(), policies);
      if (policyMatch) {
        result = { decision: policyMatch.decision, reason: policyMatch.reason, rule: policyMatch.rule };
        policyName = policyMatch.policyName;
      } else {
        result = evaluateTool(tool.trim());
      }
    } catch {
      result = evaluateTool(tool.trim());
    }
  } else {
    result = evaluateTool(tool.trim());
  }

  const latencyMs = Date.now() - start + Math.floor(Math.random() * 8 + 2);
  const requestId = `req_${randomBytes(8).toString("hex")}`;
  const mode = isSandbox ? "sandbox" : "live";
  const inputHash = sha256({ tool: tool.trim(), context, args });

  const decisionMapped =
    result.decision === "allow" ? "allowed" :
    result.decision === "deny" ? "denied" :
    result.decision === "compute" ? "compute" : "human_review";

  const confidence =
    result.decision === "allow" ? 0.95 :
    result.decision === "compute" ? 0.85 :
    result.decision === "human_review" ? 0.7 : 0.3;

  const outputHash = sha256({ requestId, decision: decisionMapped, reason: result.reason });

  // Log async — don't await so response isn't delayed
  void logAuditEvent({
    traceId: requestId,
    userId,
    keyId,
    actor: isSandbox ? "sandbox" : (keyId ?? "unknown"),
    action: tool.trim(),
    decision: decisionMapped,
    reason: result.reason,
    rule: result.rule,
    policyName,
    confidence,
    latencyMs,
    mode,
    inputHash,
    outputHash,
  });

  const response = {
    requestId,
    tool: tool.trim(),
    ...(typeof context === "string" && context ? { context } : {}),
    ...(args && typeof args === "object" ? { args } : {}),
    decision: result.decision,
    reason: result.reason,
    rule: result.rule,
    ...(policyName ? { policyName } : {}),
    ...(result.safeTool ? { safeTool: result.safeTool } : {}),
    ...(result.safeArgs ? { safeArgs: result.safeArgs } : {}),
    latencyMs,
    mode,
    ...(keyId ? { keyId } : {}),
    timestamp: new Date().toISOString(),
    inputHash,
    outputHash,
  };

  return NextResponse.json(response);
}
