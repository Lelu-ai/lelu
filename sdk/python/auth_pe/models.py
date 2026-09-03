"""Lelu Python SDK — Pydantic v2 models."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


# ─── Requests ─────────────────────────────────────────────────────────────────


class AgentContext(BaseModel):
    """LLM agent context, including an optional confidence score.

    Defined above ``AuthorizeRequest`` so the forward reference in
    ``AuthorizeRequest.context`` resolves cleanly under
    ``from __future__ import annotations``.
    """

    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description=(
            "LLM confidence score (0–1). Omit to let the engine apply its "
            "MissingSignalMode policy (default: deny) — never pass a hardcoded "
            "default; derive it from your provider's response."
        ),
    )
    acting_for: str | None = Field(default=None, description="User the agent acts on behalf of")
    scope: str | None = Field(default=None, description="Requested agent scope")

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v: float | None) -> float | None:
        if v is not None and not 0.0 <= v <= 1.0:
            raise ValueError(f"confidence must be between 0 and 1, got {v}")
        return v


class AuthorizeRequest(BaseModel):
    """Primary authorization request — used for both human users and AI agents."""

    tool: str = Field(..., min_length=1, max_length=128, description="Tool name to authorize")
    actor: str | None = Field(
        default=None,
        description="Agent identity — selects the agent_scopes policy. Omit for the default scope.",
    )
    context: AgentContext | None = Field(
        default=None,
        description="Structured agent context (confidence, acting_for, scope)",
    )
    args: dict[str, Any] | None = Field(default=None, description="Optional tool arguments")
    resource: dict[str, str] | None = Field(
        default=None, description="Target resource attributes forwarded to the policy"
    )
    tenant_id: str | None = Field(default=None, description="Tenant identifier for multi-tenant engines")


class AuthRequest(BaseModel):
    """Legacy human authorization request. Use AuthorizeRequest instead."""

    user_id: str = Field(..., min_length=1, description="Requesting user ID")
    action: str = Field(..., min_length=1, description="Action to authorize")
    resource: dict[str, str] | None = Field(default=None, description="Target resource")


class AgentAuthRequest(BaseModel):
    """Legacy agent authorization request. Use AuthorizeRequest instead."""

    actor: str = Field(..., min_length=1, description="Agent identifier")
    action: str = Field(..., min_length=1, description="Action to authorize")
    resource: dict[str, str] | None = Field(default=None)
    context: AgentContext


class MintTokenRequest(BaseModel):
    """JIT token minting request."""

    scope: str = Field(..., min_length=1)
    acting_for: str | None = None
    ttl_seconds: int | None = Field(default=None, gt=0)


class DelegateScopeRequest(BaseModel):
    """Agent-to-agent delegation request."""

    delegator: str = Field(..., min_length=1, description="Agent delegating the scope")
    delegatee: str = Field(..., min_length=1, description="Agent receiving the scope")
    scoped_to: list[str] = Field(default_factory=list, description="Actions to grant")
    ttl_seconds: int | None = Field(default=None, gt=0, description="Token TTL (capped by policy)")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    acting_for: str | None = None
    tenant_id: str | None = None


# ─── Decisions ────────────────────────────────────────────────────────────────


class AuthDecision(BaseModel):
    """Result of an authorization check."""

    request_id: str = Field(..., description="Unique request identifier")
    tool: str = Field(..., description="Tool name that was evaluated")
    decision: str = Field(..., description="allow | deny | human_review | compute")
    reason: str = Field(..., description="Human-readable explanation")
    rule: str = Field(..., description="Rule that matched")
    policy_name: str | None = Field(default=None, description="Policy that matched, if any")
    latency_ms: float = Field(..., description="Evaluation latency in milliseconds")
    mode: str = Field(..., description="live | sandbox")
    key_id: str | None = Field(default=None, description="API key ID, if authenticated")
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    safe_tool: str | None = Field(default=None, description="Safe alternative tool (present when decision == 'compute')")
    safe_args: dict[str, object] | None = Field(default=None, description="Replacement args for safe_tool (present when decision == 'compute')")
    input_hash: str | None = Field(default=None, description="SHA-256 of the request payload — tamper-proof record of what was asked")
    output_hash: str | None = Field(default=None, description="SHA-256 of the decision response — tamper-proof record of what was decided")
    policy_digest: str | None = Field(default=None, description="SHA-256 of the policy bytes active at evaluation time")
    confidence_used: float = Field(default=0.0, description="Confidence value the engine evaluated with")
    effective_scope: str | None = Field(default=None, description="Scope the engine actually granted")
    downgraded_scope: str | None = Field(default=None, description="Set when the requested scope was downgraded")
    review_id: str | None = Field(
        default=None,
        description=(
            "Queue item ID when decision == 'human_review' — needed to poll "
            "get_review()/wait_review() or resolve via approve_review()/deny_review(). "
            "Without this a human_review decision is unaddressable."
        ),
    )
    risk_score: float | None = Field(default=None, description="Composite risk score, when risk evaluation ran")
    risk_criticality: float | None = Field(default=None)
    risk_reliability: float | None = Field(default=None)
    risk_anomaly_factor: float | None = Field(default=None)
    shadow_mode: bool = Field(default=False, description="True when the engine evaluated in shadow mode")
    would_have_allowed: bool | None = Field(default=None, description="Shadow mode: the decision that would have applied")
    would_have_reason: str | None = Field(default=None)
    would_have_requires_human_review: bool | None = Field(default=None)

    @property
    def allowed(self) -> bool:
        """Convenience shorthand — True when decision == 'allow'."""
        return self.decision == "allow"

    @property
    def requires_human_review(self) -> bool:
        """Convenience shorthand — True when decision == 'human_review'."""
        return self.decision == "human_review"

    @property
    def computed(self) -> bool:
        """True when decision == 'compute' — agent should use safe_tool/safe_args."""
        return self.decision == "compute"


class AgentAuthDecision(AuthDecision):
    """
    Backward-compatible agent authorization result.
    Extends AuthDecision with legacy fields.
    """

    confidence_used: float = Field(default=0.0, description="Confidence score passed in the request")
    trace_id: str = Field(default="", description="Alias for request_id — kept for backward compat")
    downgraded_scope: str | None = Field(default=None)


class MintTokenResult(BaseModel):
    """JIT token minting result."""

    token: str
    token_id: str
    expires_at: datetime


class DelegateScopeResult(BaseModel):
    """Result of a successful agent-to-agent delegation."""

    token: str
    token_id: str
    expires_at: datetime
    delegator: str
    delegatee: str
    granted_scopes: list[str]
    trace_id: str


class RevokeTokenResult(BaseModel):
    """Token revocation result."""

    success: bool


# ─── Human review queue (engine /v1/queue) ────────────────────────────────────


class ReviewItem(BaseModel):
    """A human-review queue item, as returned by the engine."""

    id: str
    tenant_id: str | None = None
    actor: str = ""
    action: str = ""
    resource: dict[str, str] | None = None
    confidence_score: float = 0.0
    reason: str = ""
    acting_for: str | None = None
    enqueued_at: datetime | None = None
    status: str = "pending"
    resolved_at: datetime | None = None
    resolved_by: str | None = None
    resolution_note: str | None = None

    @property
    def pending(self) -> bool:
        return self.status == "pending"

    @property
    def approved(self) -> bool:
        return self.status == "approved"


class ListReviewsResult(BaseModel):
    """Pending review items."""

    items: list[ReviewItem]
    count: int = 0


class RedeemResult(BaseModel):
    """
    The engine's answer to "may I execute *this* payload against that
    approval, right now?"

    An approval on its own only says a reviewer said yes to something. It
    doesn't say yes to whatever the agent happens to run next. Redeeming
    re-checks the payload against the one that was actually approved, so a
    request mutated in between fails instead of riding a valid approval.

    ``allowed`` is false for every failure — mismatched payload, still
    pending, denied, expired, or an approval that was never bound to a
    payload at all. ``reason`` says which, without echoing the approved
    payload back (it would otherwise be an oracle for discovering it).
    """

    allowed: bool = False
    reason: str = ""
    review_id: str = ""
    trace_id: str = ""


# ─── Output scanning (engine /v1/scan/output) ─────────────────────────────────


class ScanOutputResult(BaseModel):
    """Indirect prompt-injection scan verdict for a tool output."""

    safe: bool
    detected: bool
    pattern: str | None = None
    source: str | None = None
    method: str | None = None
    score: float = 0.0


# ─── Engine policy (engine /v1/policy) ────────────────────────────────────────


class EnginePolicyInfo(BaseModel):
    """Metadata about the policy currently loaded in the engine."""

    digest: str
    policy_path: str | None = None
    source: str = "engine"


class PolicyValidationResult(BaseModel):
    """Result of validating policy bytes against a throwaway evaluator."""

    valid: bool
    digest: str | None = None


class PolicyUpdateResult(BaseModel):
    """Result of replacing the engine's active policy."""

    digest: str
    previous_digest: str | None = None
    loaded_at: str | None = None


# ─── Policy simulator (engine /v1/simulator/replay) ───────────────────────────


class SimulatorTraceItem(BaseModel):
    """One historical trace replayed against a proposed policy."""

    id: str | None = None
    kind: Literal["human", "agent"]
    tenant_id: str
    user_id: str | None = None
    actor: str | None = None
    action: str
    resource: dict[str, str] | None = None
    acting_for: str | None = None
    scope: str | None = None
    confidence: float | None = None


class SimulatorDecision(BaseModel):
    """A single before/after decision within a replayed trace."""

    allowed: bool
    requires_human_review: bool
    downgraded_scope: str | None = None
    reason: str
    outcome: Literal["allow", "review", "deny"]
    confidence_used: float | None = None


class SimulatorReplayDelta(BaseModel):
    """Before/after decision pair for one replayed trace."""

    id: str | None = None
    index: int
    kind: str
    action: str
    actor: str | None = None
    user_id: str | None = None
    changed: bool
    before: SimulatorDecision
    after: SimulatorDecision


class SimulatorReplaySummary(BaseModel):
    """Aggregate counts across all replayed traces."""

    total: int
    changed: int
    allow_to_deny: int
    allow_to_review: int
    review_to_deny: int
    deny_to_allow: int
    review_to_allow: int
    deny_to_review: int
    other_changes: int


class SimulatorReplayRequest(BaseModel):
    """Replay historical traces against a proposed policy before promoting it."""

    proposed_policy_yaml: str
    traces: list[SimulatorTraceItem]


class SimulatorReplayResponse(BaseModel):
    """Result of a policy simulator replay."""

    summary: SimulatorReplaySummary
    items: list[SimulatorReplayDelta]


# ─── Audit ────────────────────────────────────────────────────────────────────


class AuditEvent(BaseModel):
    """A single audit event from the platform."""

    id: int
    trace_id: str
    user_id: str | None = None
    key_id: str | None = None
    actor: str
    action: str
    decision: str = Field(..., description="allowed | denied | human_review | compute")
    reason: str
    rule: str
    policy_name: str | None = None
    confidence: float
    latency_ms: float
    mode: str
    input_hash: str | None = None
    output_hash: str | None = None
    policy_digest: str | None = None
    created_at: str


class ListAuditEventsRequest(BaseModel):
    """Request for listing audit events."""

    limit: int = Field(default=20, ge=1, le=500)
    cursor: int = Field(default=0, ge=0)
    actor: str | None = None
    action: str | None = None
    decision: str | None = None
    trace_id: str | None = None
    from_time: str | None = None
    to_time: str | None = None


class ListAuditEventsResult(BaseModel):
    """Result of listing audit events."""

    events: list[AuditEvent]
    count: int
    limit: int
    cursor: int
    next_cursor: int


# ─── Policies ─────────────────────────────────────────────────────────────────


class PolicyRule(BaseModel):
    """A single rule within a policy."""

    id: str
    pattern: str = Field(..., description="Regex matched against the tool name (case-insensitive)")
    decision: str = Field(..., description="allow | deny | human_review")
    reason: str


class Policy(BaseModel):
    """A policy stored in the platform."""

    id: str
    user_id: str
    name: str
    description: str
    rules: list[PolicyRule]
    is_active: bool
    created_at: str
    updated_at: str


class ListPoliciesRequest(BaseModel):
    """Request for listing policies."""

    limit: int | None = None


class ListPoliciesResult(BaseModel):
    """Result of listing policies."""

    policies: list[Policy]
    count: int


class GetPolicyRequest(BaseModel):
    """Request for getting a specific policy."""

    id: str = Field(..., min_length=1, description="Policy ID")


class UpsertPolicyRequest(BaseModel):
    """Request for creating or updating a policy."""

    name: str = Field(..., min_length=1)
    description: str = Field(default="")
    rules: list[PolicyRule]
    is_active: bool = Field(default=True)


class DeletePolicyRequest(BaseModel):
    """Request for deleting a policy."""

    id: str = Field(..., min_length=1, description="Policy ID")


class DeletePolicyResult(BaseModel):
    """Result of deleting a policy."""

    deleted: bool


# ─── Errors ───────────────────────────────────────────────────────────────────


class AuthEngineError(Exception):
    """Raised when the Lelu platform returns an error response."""

    def __init__(self, message: str, status: int | None = None, details: Any = None) -> None:
        super().__init__(message)
        self.status = status
        self.details = details

    def __repr__(self) -> str:
        return f"AuthEngineError(message={str(self)!r}, status={self.status})"


# ─── Phase 2: Behavioral Analytics ───────────────────────────────────────────


class AgentReputation(BaseModel):
    agent_id: str
    reputation_score: float = Field(..., ge=0.0, le=1.0)
    decision_count: int = Field(..., ge=0)
    accuracy_rate: float = Field(..., ge=0.0, le=1.0)
    calibration_score: float = Field(..., ge=0.0, le=1.0)
    last_updated: str
    confidence_sum: float
    correct_decisions: int = Field(..., ge=0)
    high_conf_errors: int = Field(..., ge=0)
    low_conf_correct: int = Field(..., ge=0)


class AnomalyResult(BaseModel):
    agent_id: str
    timestamp: str
    anomaly_score: float = Field(..., ge=0.0, le=1.0)
    is_anomaly: bool
    severity: str
    features: dict[str, float]
    explanation: str
    action: str
    confidence: float
    latency: float
    outcome: str


class BaselineHealth(BaseModel):
    agent_id: str
    overall_health: float = Field(..., ge=0.0, le=1.0)
    sample_count: int = Field(..., ge=0)
    age: float
    last_updated: str
    confidence_variance: float
    latency_variance: float
    action_diversity: int = Field(..., ge=0)
    temporal_coverage: float = Field(..., ge=0.0, le=1.0)
    confidence_drift: float
    latency_drift: float
    pattern_drift: float
    needs_refresh: bool
    recommended_actions: list[str]


class DriftAnalysis(BaseModel):
    agent_id: str
    detected_at: str
    drift_score: float = Field(..., ge=0.0, le=1.0)
    drift_type: str
    severity: str
    baseline_age: float
    recent_samples: int = Field(..., ge=0)
    explanation: str
    recommendations: list[str]


class Alert(BaseModel):
    id: str
    rule_id: str
    agent_id: str
    timestamp: str
    title: str
    description: str
    severity: str
    priority: int = Field(..., ge=1, le=5)
    trigger_data: dict[str, Any]
    context: dict[str, Any]
    status: str
    acked_by: str | None = None
    acked_at: str | None = None
    resolved_at: str | None = None
    group_id: str | None = None
    group_count: int = Field(default=1)
    tags: dict[str, str]
    channels: list[str]


class ReputationListResponse(BaseModel):
    agents: list[AgentReputation]
    total: int
    sort: str
    threshold: float | None = None


class AnomaliesResponse(BaseModel):
    agent_id: str
    anomalies: list[AnomalyResult]
    total: int
    since: str


class BaselineResponse(BaseModel):
    agent_id: str
    health: BaselineHealth
    drift: DriftAnalysis


class AlertsResponse(BaseModel):
    alerts: list[Alert]
    total: int


class AcknowledgeAlertRequest(BaseModel):
    acknowledged_by: str = Field(..., min_length=1)


# ─── Vault ────────────────────────────────────────────────────────────────────


class VaultStoreRequest(BaseModel):
    """Request to store an OAuth credential in the vault."""

    agent_id: str = Field(..., description="Agent identifier")
    user_id: str = Field(..., description="User the credential belongs to")
    provider: str = Field(..., description="OAuth provider name, e.g. 'google', 'github'")
    access_token: str = Field(..., description="OAuth access token")
    refresh_token: str | None = Field(default=None, description="OAuth refresh token")
    scopes: list[str] | None = Field(default=None, description="Granted OAuth scopes")
    expires_in: int | None = Field(default=None, description="Seconds until access token expires; 0 = non-expiring")


class VaultStoreResult(BaseModel):
    """Result of a vault store operation."""

    id: str
    agent_id: str
    user_id: str
    provider: str
    scopes: list[str]
    expires_at: datetime | None = None
    created_at: datetime


class VaultTokenResult(BaseModel):
    """Decrypted access token retrieved from the vault."""

    agent_id: str
    user_id: str
    provider: str
    access_token: str = Field(..., description="Decrypted OAuth access token")
    scopes: list[str]
    expires_at: datetime | None = None
    refreshed: bool = Field(default=False, description="True when token was transparently refreshed")


class VaultCredentialSummary(BaseModel):
    """Redacted credential metadata — no tokens exposed."""

    id: str
    agent_id: str
    user_id: str
    provider: str
    scopes: list[str]
    expires_at: datetime | None = None
    expired: bool = False
    created_at: datetime
    updated_at: datetime


# ── Agent Identity Registry ───────────────────────────────────────────────────

class RegisterAgentRequest(BaseModel):
    """Request to register a new agent identity."""

    name: str = Field(..., description="Human-readable agent name")
    description: str | None = Field(default=None, description="What the agent does")
    agent_type: str | None = Field(default="autonomous", description="autonomous | assistant | workflow")
    owner_email: str | None = Field(default=None, description="Email of the team or person owning this agent")
    scopes: list[str] | None = Field(default=None, description="OAuth-style scopes this agent is permitted")
    metadata: dict[str, Any] | None = Field(default=None, description="Arbitrary key-value metadata")


class RegisteredAgent(BaseModel):
    """A registered agent identity with stable ID."""

    id: str
    tenant_id: str
    name: str
    description: str
    agent_type: str
    owner_email: str
    status: str  # "active" | "suspended" | "revoked"
    scopes: list[str]
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class AgentWorkloadToken(BaseModel):
    """Short-lived OIDC-compatible RS256 JWT for a registered agent."""

    token: str
    agent_id: str
    scopes: list[str]
    expires_at: datetime
    issued_at: datetime


class AgentStatusResult(BaseModel):
    """Result of a suspend or revoke operation."""

    agent_id: str
    status: str  # "suspended" | "revoked"


# ── NHI Discovery + ISPM ─────────────────────────────────────────────────────

class OWASPFinding(BaseModel):
    """A single OWASP NHI top-10 risk finding."""

    check_id: str = Field(..., description="OWASP check identifier, e.g. NHI-05")
    title: str
    severity: str  # "critical" | "high" | "medium" | "low"
    description: str
    remediation: str


class NHIEntry(BaseModel):
    """A non-human identity with OWASP risk posture."""

    id: str
    tenant_id: str
    type: str  # "registered_agent" | "shadow_agent" | "credential"
    name: str
    status: str
    scopes: list[str]
    risk_score: float = Field(..., description="0.0 to 1.0")
    risk_level: str  # "critical" | "high" | "medium" | "low" | "none"
    findings: list[OWASPFinding]
    last_seen: datetime | None = None
    created_at: datetime
    agent_type: str | None = None
    owner_email: str | None = None
    provider: str | None = None
    request_count: int | None = None
    expires_at: datetime | None = None


class NHIScanResult(BaseModel):
    """Aggregate summary of a full NHI scan."""

    tenant_id: str
    scanned_at: datetime
    total_nhis: int
    by_type: dict[str, int]
    by_status: dict[str, int]
    by_risk_level: dict[str, int]
    top_risks: list[NHIEntry]
    finding_counts: dict[str, int]


class NHIStats(BaseModel):
    """Lightweight aggregate NHI counts."""

    tenant_id: str
    total_nhis: int
    by_type: dict[str, int]
    by_status: dict[str, int]
    by_risk_level: dict[str, int]
    generated_at: datetime


class RegisterOAuthClientRequest(BaseModel):
    """Request to register an MCP OAuth 2.1 client."""

    client_name: str | None = None
    redirect_uris: list[str] | None = None
    grant_types: list[str] | None = None
    scope: str | None = None
    token_endpoint_auth_method: str | None = None


class OAuthClient(BaseModel):
    """A registered MCP OAuth 2.1 client."""

    client_id: str
    client_secret: str | None = None
    client_name: str
    redirect_uris: list[str]
    grant_types: list[str]
    scope: str
    token_endpoint_auth_method: str
    client_id_issued_at: int
