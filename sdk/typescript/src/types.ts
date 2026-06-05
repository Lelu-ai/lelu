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
  decision: "allow" | "deny" | "human_review" | "compute";
  reason: string;
  rule: string;
  policyName?: string;
  latencyMs: number;
  mode: "live" | "sandbox";
  keyId?: string;
  timestamp: string;
  /** Convenience shorthand — true when decision === "allow" */
  allowed: boolean;
  /**
   * Present when decision === "compute".
   * The safe alternative tool the agent should call instead.
   */
  safeTool?: string;
  /**
   * Present when decision === "compute".
   * Replacement args the agent should use with safeTool.
   */
  safeArgs?: Record<string, unknown>;
  /** True when decision === "compute" — agent should use safeTool/safeArgs. */
  computed: boolean;
  /** SHA-256 of the request payload — tamper-proof record of what was asked. */
  inputHash?: string;
  /** SHA-256 of the decision response — tamper-proof record of what was decided. */
  outputHash?: string;
  /** SHA-256 of the policy bytes active at evaluation time. */
  policyDigest?: string;
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
  decision: "allowed" | "denied" | "human_review" | "compute";
  reason: string;
  rule: string;
  policyName?: string;
  confidence: number;
  latencyMs: number;
  mode: string;
  inputHash?: string;
  outputHash?: string;
  policyDigest?: string;
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

// ─── Vault types ─────────────────────────────────────────────────────────────

export interface VaultStoreRequest {
  agentId: string;
  userId: string;
  provider: string;
  accessToken: string;
  refreshToken?: string;
  scopes?: string[];
  /** Seconds until the access token expires. 0 = non-expiring. */
  expiresIn?: number;
}

export interface VaultStoreResult {
  id: string;
  agentId: string;
  userId: string;
  provider: string;
  scopes: string[];
  expiresAt: string;
  createdAt: string;
}

export interface VaultTokenResult {
  agentId: string;
  userId: string;
  provider: string;
  accessToken: string;
  scopes: string[];
  expiresAt: string;
  /** True when the token was transparently refreshed before returning. */
  refreshed: boolean;
}

export interface VaultCredentialSummary {
  id: string;
  agentId: string;
  userId: string;
  provider: string;
  scopes: string[];
  /** ISO timestamp or undefined when non-expiring. */
  expiresAt: string | undefined;
  /** True when the stored access token is already past its expiry. */
  expired: boolean;
  createdAt: string;
  updatedAt: string;
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

// ─── Agent Identity Registry ──────────────────────────────────────────────────

export type AgentType = "autonomous" | "assistant" | "workflow";
export type AgentStatus = "active" | "suspended" | "revoked";

export interface RegisterAgentRequest {
  name: string;
  description?: string;
  agentType?: AgentType;
  ownerEmail?: string;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

export interface RegisteredAgent {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  agentType: AgentType;
  ownerEmail: string;
  status: AgentStatus;
  scopes: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ListAgentsResult {
  agents: RegisteredAgent[];
  count: number;
}

export interface AgentWorkloadToken {
  token: string;
  agentId: string;
  scopes: string[];
  expiresAt: string;
  issuedAt: string;
}

export interface AgentStatusResult {
  agentId: string;
  status: AgentStatus;
}

// ─── MCP OAuth 2.1 ───────────────────────────────────────────────────────────

export interface RegisterOAuthClientRequest {
  clientName?: string;
  redirectUris?: string[];
  grantTypes?: string[];
  scope?: string;
  tokenEndpointAuthMethod?: "client_secret_basic" | "client_secret_post" | "none";
}

export interface OAuthClient {
  clientId: string;
  clientSecret: string | undefined;
  clientName: string;
  redirectUris: string[];
  grantTypes: string[];
  scope: string;
  tokenEndpointAuthMethod: string;
  clientIdIssuedAt: number;
}

// ─── NHI Discovery + ISPM ────────────────────────────────────────────────────

export type NHIType = "registered_agent" | "shadow_agent" | "credential";
export type NHIStatus = "active" | "shadow" | "suspended" | "revoked" | "stale";
export type NHIRiskLevel = "critical" | "high" | "medium" | "low" | "none";

export interface OWASPFinding {
  checkId: string;       // e.g. "NHI-05"
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  remediation: string;
}

export interface NHIEntry {
  id: string;
  tenantId: string;
  type: NHIType;
  name: string;
  status: NHIStatus;
  scopes: string[];
  riskScore: number;      // 0.0–1.0
  riskLevel: NHIRiskLevel;
  findings: OWASPFinding[];
  lastSeen: string;
  createdAt: string;
  // type-specific
  agentType?: string;
  ownerEmail?: string;
  provider?: string;
  requestCount?: number;
  expiresAt?: string;
}

export interface NHIListResult {
  nhis: NHIEntry[];
  count: number;
}

export interface NHITopRisksResult {
  topRisks: NHIEntry[];
  count: number;
}

export interface NHIScanResult {
  tenantId: string;
  scannedAt: string;
  totalNhis: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byRiskLevel: Record<string, number>;
  topRisks: NHIEntry[];
  findingCounts: Record<string, number>;
}

export interface NHIStats {
  tenantId: string;
  totalNhis: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byRiskLevel: Record<string, number>;
  generatedAt: string;
}

// ─── Shadow Mode ──────────────────────────────────────────────────────────────

export interface ShadowBucket {
  allow: number;
  review: number;
  deny: number;
}

export interface ShadowSummaryBucket extends ShadowBucket {
  minute: string;
}

export interface ShadowSummaryResponse {
  mode: string;
  window_minutes: number;
  generated_at: string;
  totals: ShadowBucket;
  buckets: ShadowSummaryBucket[];
}

// ─── Human Review Queue ───────────────────────────────────────────────────────

export type QueueItemStatus = "pending" | "approved" | "denied";

export interface ReviewQueueItem {
  id: string;
  tenant_id: string;
  actor: string;
  action: string;
  resource?: Record<string, string>;
  confidence_score: number;
  reason: string;
  acting_for?: string;
  enqueued_at: string;
  status: QueueItemStatus;
  resolved_at?: string;
  resolved_by?: string;
  resolution_note?: string;
}

// ─── Policy Simulator ─────────────────────────────────────────────────────────

export interface SimulatorTraceItem {
  id?: string;
  kind: "human" | "agent";
  tenant_id: string;
  user_id?: string;
  actor?: string;
  action: string;
  resource?: Record<string, string>;
  acting_for?: string;
  scope?: string;
  confidence?: number;
}

export interface SimulatorDecision {
  allowed: boolean;
  requires_human_review: boolean;
  downgraded_scope?: string;
  reason: string;
  outcome: "allow" | "human_review" | "deny";
  confidence_used?: number;
}

export interface SimulatorReplayDelta {
  id?: string;
  index: number;
  kind: string;
  action: string;
  actor?: string;
  user_id?: string;
  changed: boolean;
  before: SimulatorDecision;
  after: SimulatorDecision;
}

export interface SimulatorReplaySummary {
  total: number;
  changed: number;
  allow_to_deny: number;
  allow_to_review: number;
  review_to_deny: number;
  deny_to_allow: number;
  review_to_allow: number;
  deny_to_review: number;
  other_changes: number;
}

export interface SimulatorReplayRequest {
  proposed_policy_yaml: string;
  traces: SimulatorTraceItem[];
}

export interface SimulatorReplayResponse {
  summary: SimulatorReplaySummary;
  items: SimulatorReplayDelta[];
}
