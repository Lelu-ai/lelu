import { z } from "zod";

// ─── Request / Response schemas ───────────────────────────────────────────────

export const AuthRequestSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  action: z.string().min(1, "action is required"),
  resource: z.record(z.string()).optional(),
});

export const AgentContextSchema = z.object({
  /** LLM confidence score — 0.0 to 1.0 */
  confidence: z.number().min(0).max(1),
  /** User the agent is acting on behalf of */
  actingFor: z.string().optional(),
  /** Requested agent scope */
  scope: z.string().optional(),
});

export const AgentAuthRequestSchema = z.object({
  actor: z.string().min(1, "actor is required"),
  action: z.string().min(1, "action is required"),
  resource: z.record(z.string()).optional(),
  context: AgentContextSchema,
});

export const MintTokenRequestSchema = z.object({
  scope: z.string().min(1),
  actingFor: z.string().optional(),
  ttlSeconds: z.number().int().positive().optional(),
});

export const DelegateScopeRequestSchema = z.object({
  delegator: z.string().min(1, "delegator is required"),
  delegatee: z.string().min(1, "delegatee is required"),
  scopedTo: z.array(z.string().min(1)).optional(),
  ttlSeconds: z.number().int().positive().optional(),
  confidence: z.number().min(0).max(1).optional(),
  actingFor: z.string().optional(),
  tenantId: z.string().optional(),
});

// ─── Decision types ───────────────────────────────────────────────────────────

export interface AuthDecision {
  allowed: boolean;
  reason: string;
  traceId: string;
}

export interface AgentAuthDecision {
  allowed: boolean;
  reason: string;
  traceId: string;
  downgradedScope: string | undefined;
  requiresHumanReview: boolean;
  confidenceUsed: number;
}

export interface MintTokenResult {
  token: string;
  tokenId: string;
  expiresAt: Date;
}

export interface DelegateScopeRequest {
  /** Agent delegating the scope */
  delegator: string;
  /** Agent receiving the constrained sub-scope */
  delegatee: string;
  /** Actions to grant (must be subset of policy's can_delegate.scoped_to) */
  scopedTo?: string[];
  /** Token TTL in seconds — capped by the policy's max_ttl_seconds */
  ttlSeconds?: number;
  /** Delegator's confidence score — checked against require_confidence_above */
  confidence?: number;
  /** User the delegated agent acts on behalf of */
  actingFor?: string;
  tenantId?: string;
}

export interface DelegateScopeResult {
  token: string;
  tokenId: string;
  expiresAt: Date;
  delegator: string;
  delegatee: string;
  grantedScopes: string[];
  traceId: string;
}

export interface RevokeTokenResult {
  success: boolean;
}

// ─── Audit types ──────────────────────────────────────────────────────────────

export interface AuditEvent {
  id: number;
  tenantId: string;
  traceId: string;
  timestamp: string;
  actor: string;
  action: string;
  resource?: Record<string, string>;
  confidenceScore?: number;
  decision: string; // "allowed" | "denied" | "human_review"
  reason?: string;
  downgradedScope?: string;
  latencyMs: number;
  engineVersion?: string;
  policyVersion?: string;
  createdAt: string;
}

export interface ListAuditEventsRequest {
  /** Maximum number of events to return (default: 20, max: 500) */
  limit?: number;
  /** Pagination cursor (offset) */
  cursor?: number;
  /** Filter by actor */
  actor?: string;
  /** Filter by action */
  action?: string;
  /** Filter by decision */
  decision?: string;
  /** Filter by trace ID */
  traceId?: string;
  /** Filter events from this timestamp (ISO 8601) */
  from?: string;
  /** Filter events to this timestamp (ISO 8601) */
  to?: string;
  /** Tenant ID (defaults to "default") */
  tenantId?: string;
}

export interface ListAuditEventsResult {
  events: AuditEvent[];
  count: number;
  limit: number;
  cursor: number;
  nextCursor: number;
}

// ─── Typed Input types ───────────────────────────────────────────────────────

export type AuthRequest = z.infer<typeof AuthRequestSchema>;
export type AgentAuthRequest = z.infer<typeof AgentAuthRequestSchema>;
export type AgentContext = z.infer<typeof AgentContextSchema>;
export type MintTokenRequest = z.infer<typeof MintTokenRequestSchema>;

// ─── Client config ────────────────────────────────────────────────────────────

export interface ClientConfig {
  /** Base URL of the Auth Permission Engine (defaults to LELU_BASE_URL env var, else http://localhost:8080) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 5000) */
  timeoutMs?: number;
  /** Optional bearer token for authenticating with the engine */
  apiKey?: string;
}

// ─── Error type ───────────────────────────────────────────────────────────────

// ─── Policy types ─────────────────────────────────────────────────────────────

export interface Policy {
  id: string;
  tenantId: string;
  name: string;
  content: string;
  version: string;
  hmacSha256: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListPoliciesRequest {
  /** Tenant ID (defaults to "default") */
  tenantId?: string;
}

export interface ListPoliciesResult {
  policies: Policy[];
  count: number;
}

export interface GetPolicyRequest {
  /** Policy name */
  name: string;
  /** Tenant ID (defaults to "default") */
  tenantId?: string;
}

export interface UpsertPolicyRequest {
  /** Policy name */
  name: string;
  /** Policy content (Rego code) */
  content: string;
  /** Policy version (defaults to "1.0") */
  version?: string;
  /** Tenant ID (defaults to "default") */
  tenantId?: string;
}

export interface DeletePolicyRequest {
  /** Policy name */
  name: string;
  /** Tenant ID (defaults to "default") */
  tenantId?: string;
}

export interface DeletePolicyResult {
  deleted: boolean;
}

// ─── Error type ───────────────────────────────────────────────────────────────

export class AuthEngineError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AuthEngineError";
  }
}
// ─── Policy types ─────────────────────────────────────────────────────────────

export interface Policy {
  id: string;
  tenantId: string;
  name: string;
  content: string;
  version: string;
  hmacSha256: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListPoliciesRequest {
  /** Tenant ID (defaults to "default") */
  tenantId?: string;
}

export interface ListPoliciesResult {
  policies: Policy[];
  count: number;
}

export interface GetPolicyRequest {
  /** Policy name */
  name: string;
  /** Tenant ID (defaults to "default") */
  tenantId?: string;
}

export interface UpsertPolicyRequest {
  /** Policy name */
  name: string;
  /** Policy content (Rego code) */
  content: string;
  /** Policy version (defaults to "1.0") */
  version?: string;
  /** Tenant ID (defaults to "default") */
  tenantId?: string;
}

export interface DeletePolicyRequest {
  /** Policy name */
  name: string;
  /** Tenant ID (defaults to "default") */
  tenantId?: string;
}

export interface DeletePolicyResult {
  deleted: boolean;
}
