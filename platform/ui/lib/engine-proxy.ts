// Request shaping for the cloud's engine-compatible endpoint,
// POST /v1/agent/authorize (app/v1/agent/authorize/route.ts).
//
// The SDKs (TypeScript, Python, Go) call the engine's own API shape at
// {baseUrl}/v1/agent/authorize. The cloud proxies that path to the real
// engine so `lelu({ baseUrl: "https://lelu-ai.com", apiKey })` works. The
// caller's body is untrusted: only the fields below are forwarded, and the
// identity fields (actor, tenant_id, acting_for) are always set by the cloud
// from the API key, never taken from the request.
//
// Kept free of Next.js and database imports so it can be unit tested
// (scripts/engine-proxy.test.mjs).

/** Policy scope every cloud customer runs under (see config/auth.yaml). */
export const CLOUD_ACTOR = "cloud_customer";

const MAX_ACTION_LEN = 128;
const MAX_SCOPE_LEN = 128;

export type EngineAuthorizeBody = {
  actor: string;
  action: string;
  tenant_id: string;
  acting_for: string;
  confidence?: number;
  confidence_signal?: Record<string, unknown>;
  scope?: string;
  args?: Record<string, unknown>;
  resource?: Record<string, string>;
};

export type BuildResult = { ok: true; body: EngineAuthorizeBody } | { ok: false; error: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function numberArray(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  return v.every(isFiniteNumber) ? (v as number[]) : null;
}

// Copies only the fields of confidence.Signal (engine/internal/confidence/
// extract.go). The engine does the real validation and scoring; this only
// stops unexpected keys and types from being forwarded.
function cleanSignal(v: unknown): { ok: true; signal: Record<string, unknown> } | { ok: false; error: string } {
  if (!isPlainObject(v)) return { ok: false, error: "'confidence_signal' must be an object." };
  if (typeof v.provider !== "string" || !v.provider) {
    return { ok: false, error: "'confidence_signal.provider' is required." };
  }
  const signal: Record<string, unknown> = { provider: v.provider };
  for (const key of ["token_logprobs", "token_probabilities"] as const) {
    if (v[key] === undefined || v[key] === null) continue;
    const arr = numberArray(v[key]);
    if (!arr) return { ok: false, error: `'confidence_signal.${key}' must be a non-empty array of numbers.` };
    signal[key] = arr;
  }
  for (const key of ["entropy", "entropy_max"] as const) {
    if (v[key] === undefined || v[key] === null) continue;
    if (!isFiniteNumber(v[key])) return { ok: false, error: `'confidence_signal.${key}' must be a number.` };
    signal[key] = v[key];
  }
  return { ok: true, signal };
}

/**
 * Validates an engine-shaped authorize request from a cloud customer and
 * builds the body forwarded to the engine. `userId` is the owner of the API
 * key that authenticated the request.
 */
export function buildEngineAuthorizeBody(input: unknown, userId: string): BuildResult {
  if (!isPlainObject(input)) return { ok: false, error: "Request body must be a JSON object." };

  const action = typeof input.action === "string" ? input.action.trim() : "";
  if (!action) return { ok: false, error: "'action' is required and must be a non-empty string." };
  if (action.length > MAX_ACTION_LEN) {
    return { ok: false, error: `'action' must be ${MAX_ACTION_LEN} characters or less.` };
  }

  const body: EngineAuthorizeBody = {
    actor: CLOUD_ACTOR,
    action,
    tenant_id: userId,
    acting_for: userId,
  };

  if (input.confidence !== undefined && input.confidence !== null) {
    const c = input.confidence;
    if (!isFiniteNumber(c) || c < 0 || c > 1) {
      return { ok: false, error: "'confidence' must be a number between 0 and 1." };
    }
    body.confidence = c;
  }

  if (input.confidence_signal !== undefined && input.confidence_signal !== null) {
    const sig = cleanSignal(input.confidence_signal);
    if (!sig.ok) return sig;
    body.confidence_signal = sig.signal;
  }

  if (input.scope !== undefined && input.scope !== null && input.scope !== "") {
    if (typeof input.scope !== "string" || input.scope.length > MAX_SCOPE_LEN) {
      return { ok: false, error: `'scope' must be a string of ${MAX_SCOPE_LEN} characters or less.` };
    }
    body.scope = input.scope;
  }

  if (input.args !== undefined && input.args !== null) {
    if (!isPlainObject(input.args)) return { ok: false, error: "'args' must be an object." };
    body.args = input.args;
  }

  if (input.resource !== undefined && input.resource !== null) {
    const r = input.resource;
    if (!isPlainObject(r) || !Object.values(r).every((x) => typeof x === "string")) {
      return { ok: false, error: "'resource' must be an object of string values." };
    }
    body.resource = r as Record<string, string>;
  }

  return { ok: true, body };
}

export type EngineDecision = "allow" | "deny" | "human_review" | "compute";

/** Same precedence the SDKs use: compute, then human review, then allow. */
export function engineDecision(data: {
  allowed?: boolean;
  requires_human_review?: boolean;
  compute?: boolean;
}): EngineDecision {
  if (data.compute) return "compute";
  if (data.requires_human_review) return "human_review";
  if (data.allowed) return "allow";
  return "deny";
}
