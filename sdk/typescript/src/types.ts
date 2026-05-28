import { z } from "zod";

// ─── Request schemas ──────────────────────────────────────────────────────────

/** Primary authorization request — send this to lelu.authorize(). */
export const AuthorizeRequestSchema = z.object({
  tool: z.string().min(1, "tool is required").max(128),
  context: z.string().optional(),
  args: z.record(z.unknown()).optional(),
});

// Legacy schemas kept for backward compatibility
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
  requestId: string;
  tool: string;
  decision: "allow" | "deny" | "human_review";
  reason: string;
  rule: string;
  policyName?: string;
  latencyMs: number;
  mode: "live" | "sandbox";
  keyId?: string;
  timestamp: string;
  /** Convenience shorthand — true when decision === "allow" */
  allowed: boolean;
}

/** @deprecated Use AuthDecision. Kept for backward compatibility. */
export interface AgentAuthDecision extends AuthDecision {
  requiresHumanReview: boolean;
  confidenceUsed: number;
  traceId: string;
  downgradedScope: string | undefined;
}

export interface MintTokenResult {
  token: string;
  tokenId: string;
  expiresAt: Date;
}

export interface DelegateScopeRequest {
  delegator: string;
  delegatee: string;
  scopedTo?: string[];
  ttlSeconds?: number;
  confidence?: number;
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
  traceId: string;
  userId?: string;
  keyId?: string;
  actor: string;
  action: string;
  decision: "allowed" | "denied" | "human_review";
  reason: string;
  rule: string;
  policyName?: string;
  confidence: number;
  latencyMs: number;
  mode: string;
  createdAt: string;
}

export interface ListAuditEventsRequest {
  limit?: number;
  cursor?: number;
  actor?: string;
  action?: string;
  decision?: string;
  traceId?: string;
  from?: string;
  to?: string;
}

export interface ListAuditEventsResult {
  events: AuditEvent[];
  count: number;
  limit: number;
  cursor: number;
  nextCursor: number;
}

// ─── Typed input types ────────────────────────────────────────────────────────

export type AuthorizeRequest = z.infer<typeof AuthorizeRequestSchema>;
export type AuthRequest = z.infer<typeof AuthRequestSchema>;
export type AgentAuthRequest = z.infer<typeof AgentAuthRequestSchema>;
export type AgentContext = z.infer<typeof AgentContextSchema>;
export type MintTokenRequest = z.infer<typeof MintTokenRequestSchema>;

// ─── Client config ────────────────────────────────────────────────────────────

export interface ClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
  apiKey?: string;
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

// ─── Policy types ────────────────────────────────────────────────────────────

export interface PolicyRule {
  id: string;
  pattern: string;
  decision: "allow" | "deny" | "human_review";
  reason: string;
}

export interface Policy {
  id: string;
  userId: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListPoliciesRequest {
  limit?: number;
}

export interface ListPoliciesResult {
  policies: Policy[];
  count: number;
}

export interface GetPolicyRequest {
  id: string;
}

export interface UpsertPolicyRequest {
  name: string;
  description?: string;
  rules: PolicyRule[];
  isActive?: boolean;
}

export interface DeletePolicyRequest {
  id: string;
}

export interface DeletePolicyResult {
  deleted: boolean;
}

// ─── Phase 2: Behavioral Analytics Types ─────────────────────────────────────

export interface AgentReputation {
  agent_id: string;
  reputation_score: number;
  decision_count: number;
  accuracy_rate: number;
  calibration_score: number;
  last_updated: string;
  confidence_sum: number;
  correct_decisions: number;
  high_conf_errors: number;
  low_conf_correct: number;
}

export interface AnomalyResult {
  agent_id: string;
  timestamp: string;
  anomaly_score: number;
  is_anomaly: boolean;
  severity: "none" | "low" | "medium" | "high" | "severe";
  features: Record<string, number>;
  explanation: string;
  action: string;
  confidence: number;
  latency: number;
  outcome: string;
}

export interface BaselineHealth {
  agent_id: string;
  overall_health: number;
  sample_count: number;
  age: number;
  last_updated: string;
  confidence_variance: number;
  latency_variance: number;
  action_diversity: number;
  temporal_coverage: number;
  confidence_drift: number;
  latency_drift: number;
  pattern_drift: number;
  needs_refresh: boolean;
  recommended_actions: string[];
}

export interface DriftAnalysis {
  agent_id: string;
  detected_at: string;
  drift_score: number;
  drift_type: "none" | "confidence" | "latency" | "pattern" | "combined";
  severity: "none" | "low" | "medium" | "high" | "critical";
  baseline_age: number;
  recent_samples: number;
  explanation: string;
  recommendations: string[];
}

export interface Alert {
  id: string;
  rule_id: string;
  agent_id: string;
  timestamp: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  priority: number;
  trigger_data: Record<string, unknown>;
  context: Record<string, unknown>;
  status: "active" | "acknowledged" | "resolved";
  acked_by?: string;
  acked_at?: string;
  resolved_at?: string;
  group_id?: string;
  group_count: number;
  tags: Record<string, string>;
  channels: string[];
}

export interface ReputationListResponse {
  agents: AgentReputation[];
  total: number;
  sort: "top" | "problematic";
  threshold?: number;
}

export interface AnomaliesResponse {
  agent_id: string;
  anomalies: AnomalyResult[];
  total: number;
  since: string;
}

export interface BaselineResponse {
  agent_id: string;
  health: BaselineHealth;
  drift: DriftAnalysis;
}

export interface AlertsResponse {
  alerts: Alert[];
  total: number;
}

export interface AcknowledgeAlertRequest {
  acknowledged_by: string;
}
