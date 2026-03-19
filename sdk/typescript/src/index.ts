// Auth Permission Engine — TypeScript SDK
// Public API surface

// ─── Vercel AI SDK integration ────────────────────────────────────────────────
// Import via: import { secureTool } from 'lelu/vercel'
// (tree-shakeable — does not add weight to non-Vercel users)
export { secureTool } from "./vercel/index.js";
export type { SecureToolOptions, LeluDeniedResult, VercelTool } from "./vercel/index.js";

// ─── Enhanced Observability (Phase 1) ─────────────────────────────────────────
// Import via: import { AgentTracer, agentTracer } from '@lelu-auth/lelu/observability'
export { AgentTracer, agentTracer, AI_AGENT_ATTRIBUTES, AGENT_TYPES, DECISION_TYPES } from "./observability/tracer.js";
export type { AgentSpanOptions, DecisionMetrics, LatencyMetrics } from "./observability/tracer.js";

export { LeluClient } from "./client.js";
export { LocalStorage } from "./storage.js";

export type {
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
  ListPoliciesRequest,
  ListPoliciesResult,
  GetPolicyRequest,
  UpsertPolicyRequest,
  DeletePolicyRequest,
  DeletePolicyResult,
} from "./types.js";

export {
  AuthEngineError,
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
 * Equivalent to `new LeluClient(config)`.
 *
 * @example
 * ```ts
 * import { createClient } from "@lelu-auth/lelu";
 *
 * const lelu = createClient({ baseUrl: "http://localhost:8080" });
 * const { allowed } = await lelu.agentAuthorize({ ... });
 * ```
 */
export function createClient(config?: ClientConfig): LeluClient {
  return new LeluClient(config);
}
