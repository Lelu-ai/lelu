import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { validateApiKey } from "@/lib/apikeys";
import { logAuditEvent } from "@/lib/audit";
import { buildEngineAuthorizeBody, ENGINE_TIMEOUT_MS, engineDecision } from "@/lib/engine-proxy";
import { checkQuota } from "@/lib/quota";

// Engine-compatible authorize endpoint on the hosted cloud.
//
// The SDKs call the engine's API shape at {baseUrl}/v1/agent/authorize, so
// before this route existed `lelu({ baseUrl: "https://lelu-ai.com", apiKey })`
// hit a path the cloud did not serve and every authorize() call failed, while
// the cloud's own REST shape at /api/v1/authorize worked. This route accepts
// the engine's request body, applies the same API-key check, quota and audit
// logging as /api/v1/authorize, forwards the request to the real engine and
// returns the engine's response unchanged.
//
// Only authorize is proxied. The review-queue endpoints (/v1/queue/...) are
// not served by the cloud yet.

const ENGINE_URL = (process.env.LELU_ENGINE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const ENGINE_API_KEY = process.env.LELU_API_KEY;
const SANDBOX_KEY_PREFIX = "lelu_sk_sandbox_";

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function error(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  // --- Auth ---
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return error(401, "Missing or invalid Authorization header. Use: Bearer <api_key>");
  }
  const apiKey = authHeader.slice(7).trim();
  if (apiKey.startsWith(SANDBOX_KEY_PREFIX)) {
    return error(
      403,
      "Sandbox keys only work with POST /api/v1/authorize. Create an API key in the dashboard to use the SDK against the cloud.",
    );
  }
  const key = await validateApiKey(apiKey);
  if (!key) return error(401, "Invalid or revoked API key.");
  const { userId, keyId } = key;

  // --- Parse and shape the body ---
  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return error(400, "Invalid JSON body.");
  }
  const built = buildEngineAuthorizeBody(input, userId);
  if (!built.ok) return error(400, built.error);
  const engineBody = built.body;

  // --- Quota (before any engine load) ---
  const quota = await checkQuota(userId);
  if (!quota.allowed) {
    return error(
      429,
      `Monthly quota exceeded (${quota.used}/${quota.limit} on the ${quota.plan} plan). Starter ($20/month) includes 100,000 calls and never stops at its limit: see https://lelu-ai.com/pricing. Or self-host the engine for no limit.`,
      { plan: quota.plan, used: quota.used, limit: quota.limit },
    );
  }

  // --- Forward to the engine ---
  const start = Date.now();
  let engineRes: Response;
  try {
    engineRes = await fetch(`${ENGINE_URL}/v1/agent/authorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ENGINE_API_KEY ? { Authorization: `Bearer ${ENGINE_API_KEY}` } : {}),
      },
      body: JSON.stringify(engineBody),
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("[v1/agent/authorize] engine unreachable:", err);
    return error(503, "The authorization engine is temporarily unavailable. Please retry.");
  }

  const data = (await engineRes.json().catch(() => null)) as
    | ({
        allowed?: boolean;
        reason?: string;
        trace_id?: string;
        requires_human_review?: boolean;
        compute?: boolean;
        confidence_used?: number;
        policy_digest?: string;
        error?: string;
      } & Record<string, unknown>)
    | null;

  // The engine rejects a malformed request with 400 and a busy tenant with
  // 429; both are the caller's to see. Anything else unexpected is ours.
  if (!engineRes.ok || !data) {
    if (data && (engineRes.status === 400 || engineRes.status === 429)) {
      return error(engineRes.status, data.error ?? "The authorization engine rejected the request.");
    }
    console.error("[v1/agent/authorize] engine returned", engineRes.status);
    return error(502, "The authorization engine returned an unexpected response.");
  }

  // --- Audit (also what the monthly quota counts: mode 'live') ---
  const decision = engineDecision(data);
  const reason = data.reason ?? "";
  const traceId = data.trace_id || `req_${randomBytes(8).toString("hex")}`;
  // The agent name the caller sent (e.g. "billing-agent") is shown in the
  // audit log so customers can tell their agents apart. It is a label only:
  // the engine evaluates every cloud call as cloud_customer, and the key that
  // made the call is recorded separately in key_id.
  const claimedActor =
    typeof (input as Record<string, unknown>).actor === "string"
      ? ((input as Record<string, unknown>).actor as string).trim().slice(0, 128)
      : "";
  void logAuditEvent({
    traceId,
    userId,
    keyId,
    actor: claimedActor || keyId,
    action: engineBody.action,
    decision:
      decision === "allow" ? "allowed" : decision === "deny" ? "denied" : decision,
    reason,
    rule: "engine",
    confidence: typeof data.confidence_used === "number" ? data.confidence_used : 0,
    latencyMs: Date.now() - start,
    mode: "live",
    inputHash: sha256({ tool: engineBody.action, args: engineBody.args }),
    outputHash: sha256({ traceId, decision, reason }),
    ...(data.policy_digest ? { policyDigest: data.policy_digest } : {}),
  });

  return NextResponse.json(data);
}
