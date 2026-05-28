// Auth Permission Engine — TypeScript SDK
// Public API surface

// ─── Vercel AI SDK integration ────────────────────────────────────────────────
export { secureTool } from "./vercel/index.js";
export type { SecureToolOptions, LeluDeniedResult, VercelTool } from "./vercel/index.js";

// ─── Enhanced Observability ───────────────────────────────────────────────────
export { AgentTracer, agentTracer, AI_AGENT_ATTRIBUTES, AGENT_TYPES, DECISION_TYPES } from "./observability/tracer.js";
export type { AgentSpanOptions, DecisionMetrics, LatencyMetrics } from "./observability/tracer.js";

export { LeluClient } from "./client.js";
export const LELU_CLOUD_URL = "https://lelu-ai.com";
export { LocalStorage } from "./storage.js";

export type {
  AuthorizeRequest,
  AuthRequest,
  AgentAuthRequest,
  AgentContext,
  MintTokenRequest,
  DelegateScopeRequest,
  AuthDecision,
  AgentAuthDecision,
  MintTokenResult,
  DelegateScopeResult,
  RevokeTokenResult,
  ClientConfig,
  AuditEvent,
  ListAuditEventsRequest,
  ListAuditEventsResult,
  Policy,
  PolicyRule,
  ListPoliciesRequest,
  ListPoliciesResult,
  GetPolicyRequest,
  UpsertPolicyRequest,
  DeletePolicyRequest,
  DeletePolicyResult,
} from "./types.js";

export {
  AuthEngineError,
  AuthorizeRequestSchema,
  AuthRequestSchema,
  AgentAuthRequestSchema,
  AgentContextSchema,
  MintTokenRequestSchema,
  DelegateScopeRequestSchema,
} from "./types.js";

// ─── Convenience factory ──────────────────────────────────────────────────────

import { LeluClient } from "./client.js";
import type { ClientConfig } from "./types.js";

/**
 * Creates a LeluClient with the given configuration.
 *
 * @example
 * ```ts
 * import { createClient } from "lelu-agent-auth";
 *
 * const lelu = createClient({ apiKey: process.env.LELU_API_KEY });
 * const { decision, reason } = await lelu.authorize({ tool: "delete_file" });
 * ```
 */
export function createClient(config?: ClientConfig): LeluClient {
  return new LeluClient(config);
}
