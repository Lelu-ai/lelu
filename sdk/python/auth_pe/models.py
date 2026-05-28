"""Lelu Python SDK — Pydantic v2 models."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


# ─── Requests ─────────────────────────────────────────────────────────────────


class AuthorizeRequest(BaseModel):
    """Primary authorization request — used for both human users and AI agents."""

    tool: str = Field(..., min_length=1, max_length=128, description="Tool name to authorize")
    context: str | None = Field(default=None, description="Optional context string")
    args: dict[str, Any] | None = Field(default=None, description="Optional tool arguments")


class AuthRequest(BaseModel):
    """Legacy human authorization request. Use AuthorizeRequest instead."""

    user_id: str = Field(..., min_length=1, description="Requesting user ID")
    action: str = Field(..., min_length=1, description="Action to authorize")
    resource: dict[str, str] | None = Field(default=None, description="Target resource")


class AgentContext(BaseModel):
    """LLM agent context, including confidence score."""

    confidence: float = Field(..., ge=0.0, le=1.0, description="LLM confidence score (0–1)")
    acting_for: str | None = Field(default=None, description="User the agent acts on behalf of")
    scope: str | None = Field(default=None, description="Requested agent scope")

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError(f"confidence must be between 0 and 1, got {v}")
        return v


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
    decision: str = Field(..., description="allow | deny | human_review")
    reason: str = Field(..., description="Human-readable explanation")
    rule: str = Field(..., description="Rule that matched")
    policy_name: str | None = Field(default=None, description="Policy that matched, if any")
    latency_ms: int = Field(..., description="Evaluation latency in milliseconds")
    mode: str = Field(..., description="live | sandbox")
    key_id: str | None = Field(default=None, description="API key ID, if authenticated")
    timestamp: str = Field(..., description="ISO 8601 timestamp")

    @property
    def allowed(self) -> bool:
        """Convenience shorthand — True when decision == 'allow'."""
        return self.decision == "allow"

    @property
    def requires_human_review(self) -> bool:
        """Convenience shorthand — True when decision == 'human_review'."""
        return self.decision == "human_review"


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


# ─── Audit ────────────────────────────────────────────────────────────────────


class AuditEvent(BaseModel):
    """A single audit event from the platform."""

    id: int
    trace_id: str
    user_id: str | None = None
    key_id: str | None = None
    actor: str
    action: str
    decision: str = Field(..., description="allowed | denied | human_review")
    reason: str
    rule: str
    policy_name: str | None = None
    confidence: float
    latency_ms: int
    mode: str
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
