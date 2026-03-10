"""Auth Permission Engine — Python SDK models (Pydantic v2)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


# ─── Requests ─────────────────────────────────────────────────────────────────


class AuthRequest(BaseModel):
    """Human authorization check."""

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
    """Agent authorization check with confidence-aware gate."""

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
    """Result of a human authorization check."""

    allowed: bool
    reason: str
    trace_id: str


class AgentAuthDecision(BaseModel):
    """Result of an agent authorization check."""

    allowed: bool
    reason: str
    trace_id: str
    downgraded_scope: str | None = None
    requires_human_review: bool = False
    confidence_used: float = 0.0


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
    tenant_id: str
    trace_id: str
    timestamp: str
    actor: str
    action: str
    resource: dict[str, str] | None = None
    confidence_score: float | None = None
    decision: str  # "allowed" | "denied" | "human_review"
    reason: str | None = None
    downgraded_scope: str | None = None
    latency_ms: float
    engine_version: str | None = None
    policy_version: str | None = None
    created_at: str


class ListAuditEventsRequest(BaseModel):
    """Request for listing audit events."""

    limit: int = Field(default=20, ge=1, le=500, description="Maximum number of events")
    cursor: int = Field(default=0, ge=0, description="Pagination cursor (offset)")
    actor: str | None = Field(default=None, description="Filter by actor")
    action: str | None = Field(default=None, description="Filter by action")
    decision: str | None = Field(default=None, description="Filter by decision")
    trace_id: str | None = Field(default=None, description="Filter by trace ID")
    from_time: str | None = Field(default=None, description="Filter from timestamp (ISO 8601)")
    to_time: str | None = Field(default=None, description="Filter to timestamp (ISO 8601)")
    tenant_id: str | None = Field(default=None, description="Tenant ID")


class ListAuditEventsResult(BaseModel):
    """Result of listing audit events."""

    events: list[AuditEvent]
    count: int
    limit: int
    cursor: int
    next_cursor: int


# ─── Policies ─────────────────────────────────────────────────────────────────


class Policy(BaseModel):
    """A policy stored in the platform."""

    id: str
    tenant_id: str
    name: str
    content: str
    version: str
    hmac_sha256: str
    created_at: str
    updated_at: str


class ListPoliciesRequest(BaseModel):
    """Request for listing policies."""

    tenant_id: str | None = Field(default=None, description="Tenant ID")


class ListPoliciesResult(BaseModel):
    """Result of listing policies."""

    policies: list[Policy]
    count: int


class GetPolicyRequest(BaseModel):
    """Request for getting a specific policy."""

    name: str = Field(..., min_length=1, description="Policy name")
    tenant_id: str | None = Field(default=None, description="Tenant ID")


class UpsertPolicyRequest(BaseModel):
    """Request for creating or updating a policy."""

    name: str = Field(..., min_length=1, description="Policy name")
    content: str = Field(..., min_length=1, description="Policy content (Rego code)")
    version: str = Field(default="1.0", description="Policy version")
    tenant_id: str | None = Field(default=None, description="Tenant ID")


class DeletePolicyRequest(BaseModel):
    """Request for deleting a policy."""

    name: str = Field(..., min_length=1, description="Policy name")
    tenant_id: str | None = Field(default=None, description="Tenant ID")


class DeletePolicyResult(BaseModel):
    """Result of deleting a policy."""

    deleted: bool


# ─── Errors ───────────────────────────────────────────────────────────────────


class AuthEngineError(Exception):
    """Raised when the Auth Permission Engine returns an error response."""

    def __init__(self, message: str, status: int | None = None, details: Any = None) -> None:
        super().__init__(message)
        self.status = status
        self.details = details

    def __repr__(self) -> str:
        return f"AuthEngineError(message={str(self)!r}, status={self.status})"
