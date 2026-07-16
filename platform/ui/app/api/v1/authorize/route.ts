import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { validateApiKey } from "@/lib/apikeys";
// Dashboard-editable custom policies (lib/policies.ts) aren't bridged to the
// real engine yet — cloud customers run on the engine's shared default policy
// for now. Left in place as the natural hook for per-tenant policy sync
// (engine/internal/sync polls a control-plane URL per tenant) once that's built.
import { logAuditEvent } from "@/lib/audit";
import { detectInjection } from "@/lib/injection";
import { checkQuota } from "@/lib/quota";

// Matches the ui service's actual env vars in docker-compose.production.yml —
// NOT the same names the (separately, pre-existingly, incorrectly) named
// ENGINE_URL in api/sandbox/authorize/route.ts uses.
const ENGINE_URL = (process.env.LELU_ENGINE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const ENGINE_API_KEY = process.env.LELU_API_KEY;

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

  const { tool, context, args, confidence } = (body as Record<string, unknown>) ?? {};

  if (typeof tool !== "string" || !tool.trim()) {
    return NextResponse.json({ error: "'tool' is required and must be a non-empty string." }, { status: 400 });
  }
  if (tool.length > 128) {
    return NextResponse.json({ error: "'tool' must be 128 characters or less." }, { status: 400 });
  }
  if (confidence !== undefined && (typeof confidence !== "number" || confidence < 0 || confidence > 1)) {
    return NextResponse.json({ error: "'confidence' must be a number between 0 and 1." }, { status: 400 });
  }

  // --- Evaluate ---
  const start = Date.now();

  let result: { decision: Decision; reason: string; rule: string; safeTool?: string; safeArgs?: Record<string, unknown> };
  let confidenceUsed = 0;
  let confidenceVerified: boolean | undefined;
  let riskScore: number | undefined;
  let quotaInfo: { plan: string; used: number; limit: number } | undefined;

  if (isSandbox) {
    // Sandbox keys never reach the real engine or count against any quota —
    // same local demo evaluation as always.
    const injection = detectInjection({ tool: tool.trim(), context, args });
    if (injection.detected) {
      result = {
        decision: "deny",
        reason: `prompt injection detected in ${injection.source}: "${injection.pattern}"`,
        rule: "deny:prompt-injection",
      };
    } else {
      result = evaluateTool(tool.trim());
    }
    confidenceUsed =
      result.decision === "allow" ? 0.95 :
      result.decision === "compute" ? 0.85 :
      result.decision === "human_review" ? 0.7 : 0.3;
  } else {
    // Real cloud API key — check quota, then run the actual engine pipeline.
    const quota = await checkQuota(userId!);
    quotaInfo = { plan: quota.plan, used: quota.used, limit: quota.limit };
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Monthly quota exceeded (${quota.used}/${quota.limit} on the ${quota.plan} plan). Upgrade for a higher limit.`,
          plan: quota.plan,
          used: quota.used,
          limit: quota.limit,
        },
        { status: 429 }
      );
    }

    let engineRes: Response;
    try {
      engineRes = await fetch(`${ENGINE_URL}/v1/agent/authorize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ENGINE_API_KEY ? { Authorization: `Bearer ${ENGINE_API_KEY}` } : {}),
        },
        // actor is fixed to the shared cloud_customer policy scope (see
        // config/auth.yaml) — per-tenant custom policy isn't wired up yet.
        // acting_for + tenant_id carry the real customer identity through for
        // the engine's own per-tenant audit/rate-limit/reliability tracking.
        body: JSON.stringify({
          actor: "cloud_customer",
          action: tool.trim(),
          acting_for: userId,
          tenant_id: userId,
          // Self-reported only — honored by the engine only when it's
          // configured with AllowUnverifiedConfidence (dev/demo mode, same as
          // the MCP zero-config path). Real deployments should eventually
          // accept a confidence_signal derived from provider logprobs instead.
          ...(typeof confidence === "number" ? { confidence } : {}),
          ...(typeof context === "string" && context ? { resource: { context } } : {}),
          ...(args && typeof args === "object" ? { args } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      console.error("[v1/authorize] engine unreachable:", err);
      return NextResponse.json(
        { error: "The authorization engine is temporarily unavailable. Please retry." },
        { status: 503 }
      );
    }

    const engineData = (await engineRes.json().catch(() => null)) as {
      allowed?: boolean;
      reason?: string;
      requires_human_review?: boolean;
      compute?: boolean;
      safe_tool?: string;
      safe_args?: Record<string, unknown>;
      confidence_used?: number;
      confidence_verified?: boolean;
      risk_score?: number;
    } | null;

    if (!engineRes.ok || !engineData) {
      return NextResponse.json(
        { error: "The authorization engine returned an unexpected response." },
        { status: 502 }
      );
    }

    const decision: Decision = engineData.compute
      ? "compute"
      : engineData.requires_human_review
      ? "human_review"
      : engineData.allowed
      ? "allow"
      : "deny";

    result = {
      decision,
      reason: engineData.reason ?? "",
      rule: "engine",
      safeTool: engineData.safe_tool,
      safeArgs: engineData.safe_args,
    };
    confidenceUsed = engineData.confidence_used ?? 0;
    confidenceVerified = engineData.confidence_verified;
    riskScore = engineData.risk_score;
  }

  const latencyMs = Date.now() - start;
  const requestId = `req_${randomBytes(8).toString("hex")}`;
  const mode = isSandbox ? "sandbox" : "live";
  const inputHash = sha256({ tool: tool.trim(), context, args });

  const decisionMapped =
    result.decision === "allow" ? "allowed" :
    result.decision === "deny" ? "denied" :
    result.decision === "compute" ? "compute" : "human_review";

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
    confidence: confidenceUsed,
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
    ...(result.safeTool ? { safeTool: result.safeTool } : {}),
    ...(result.safeArgs ? { safeArgs: result.safeArgs } : {}),
    ...(confidenceVerified !== undefined ? { confidenceVerified } : {}),
    ...(riskScore !== undefined ? { riskScore } : {}),
    ...(quotaInfo ? { quota: quotaInfo } : {}),
    latencyMs,
    mode,
    ...(keyId ? { keyId } : {}),
    timestamp: new Date().toISOString(),
    inputHash,
    outputHash,
  };

  return NextResponse.json(response);
}
