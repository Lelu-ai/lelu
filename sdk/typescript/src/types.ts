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
// ─── Phase 2: Behavioral Analytics Types ─────────────────────────────────────

export interface AgentReputation {
  agent_id: string;
  reputation_score: number;        // 0-1 trust score
  decision_count: number;          // Total decisions made
  accuracy_rate: number;           // % correct decisions
  calibration_score: number;       // Confidence vs accuracy alignment
  last_updated: string;            // ISO timestamp
  confidence_sum: number;          // Sum of all confidence scores
  correct_decisions: number;       // Number of correct decisions
  high_conf_errors: number;        // High confidence but wrong
  low_conf_correct: number;        // Low confidence but correct
}

export interface AnomalyResult {
  agent_id: string;
  timestamp: string;               // ISO timestamp
  anomaly_score: number;           // 0-1, higher = more anomalous
  is_anomaly: boolean;
  severity: 'none' | 'low' | 'medium' | 'high' | 'severe';
  features: Record<string, number>; // Feature values that contributed
  explanation: string;             // Human-readable explanation
  action: string;
  confidence: number;
  latency: number;                 // milliseconds
  outcome: string;
}

export interface BaselineHealth {
  agent_id: string;
  overall_health: number;          // 0-1 health score
  sample_count: number;
  age: number;                     // milliseconds
  last_updated: string;            // ISO timestamp
  confidence_variance: number;
  latency_variance: number;
  action_diversity: number;
  temporal_coverage: number;       // How well it covers different times
  confidence_drift: number;
  latency_drift: number;
  pattern_drift: number;
  needs_refresh: boolean;
  recommended_actions: string[];
}

export interface DriftAnalysis {
  agent_id: string;
  detected_at: string;             // ISO timestamp
  drift_score: number;             // 0-1, higher = more drift
  drift_type: 'none' | 'confidence' | 'latency' | 'pattern' | 'combined';
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  baseline_age: number;            // milliseconds
  recent_samples: number;
  explanation: string;
  recommendations: string[];
}

export interface Alert {
  id: string;
  rule_id: string;
  agent_id: string;
  timestamp: string;               // ISO timestamp
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: number;                // 1-5, higher = more urgent
  trigger_data: Record<string, any>;
  context: Record<string, any>;
  status: 'active' | 'acknowledged' | 'resolved';
  acked_by?: string;
  acked_at?: string;               // ISO timestamp
  resolved_at?: string;            // ISO timestamp
  group_id?: string;
  group_count: number;
  tags: Record<string, string>;
  channels: string[];
}

// API Response types for Phase 2
export interface ReputationListResponse {
  agents: AgentReputation[];
  total: number;
  sort: 'top' | 'problematic';
  threshold?: number;
}

export interface AnomaliesResponse {
  agent_id: string;
  anomalies: AnomalyResult[];
  total: number;
  since: string;                   // ISO timestamp
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