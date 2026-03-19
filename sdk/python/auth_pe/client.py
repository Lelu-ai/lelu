"""Auth Permission Engine — async Python client (httpx-backed)."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

import httpx

from .models import (
    AgentAuthDecision,
    AgentAuthRequest,
    AuthDecision,
    AuthEngineError,
    AuthRequest,
    DelegateScopeRequest,
    DelegateScopeResult,
    MintTokenRequest,
    MintTokenResult,
    RevokeTokenResult,
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
    # Phase 2: Behavioral Analytics Types
    AgentReputation,
    AnomalyResult,
    BaselineHealth,
    DriftAnalysis,
    Alert,
    ReputationListResponse,
    AnomaliesResponse,
    BaselineResponse,
    AlertsResponse,
    AcknowledgeAlertRequest,
)
from .observability import (
    agent_tracer,
    DecisionMetrics,
    LatencyMetrics,
    AgentTypes,
)


class LeluClient:
    """
    Async client for the Auth Permission Engine HTTP API.

    Usage::

        async with LeluClient(base_url="http://localhost:8080") as lelu:
            decision = await lelu.agent_authorize(
                AgentAuthRequest(
                    actor="invoice_bot",
                    action="approve_refunds",
                    context=AgentContext(confidence=0.92, acting_for="user_123"),
                )
            )
            if not decision.allowed:
                print(decision.reason)

    Or without a context manager::

        lelu = LeluClient()
        decision = await lelu.authorize(AuthRequest(user_id="u1", action="view_invoices"))
        await lelu.aclose()
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        timeout: float = 5.0,
        api_key: str | None = None,
    ) -> None:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers=headers,
            timeout=timeout,
        )

    # ── Context manager ───────────────────────────────────────────────────────

    async def __aenter__(self) -> "LeluClient":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._client.aclose()

    # ── Human authorization ───────────────────────────────────────────────────

    async def authorize(self, req: AuthRequest) -> AuthDecision:
        """Check whether a human user is permitted to perform an action."""
        payload = {
            "user_id": req.user_id,
            "action": req.action,
            "resource": req.resource,
        }
        data = await self._post("/v1/authorize", payload)
        return AuthDecision(
            allowed=data["allowed"],
            reason=data["reason"],
            trace_id=data["trace_id"],
        )

    # ── Agent authorization ───────────────────────────────────────────────────

    async def agent_authorize(self, req: AgentAuthRequest) -> AgentAuthDecision:
        """
        Check whether an AI agent is permitted to perform an action.

        The confidence score in ``req.context`` is passed through the
        Confidence-Aware Auth gate ★ before policy evaluation.
        
        Enhanced with Phase 1 observability features.
        """
        # Start enhanced tracing span
        with agent_tracer.agent_span(
            "ai.agent.authorize",
            req.actor,
            agent_type=AgentTypes.AUTONOMOUS,
            **{
                "ai.request.intent": req.action,
                "ai.request.confidence": req.context.confidence,
                "ai.request.acting_for": req.context.acting_for or "",
                "ai.request.scope": req.context.scope or "",
            }
        ) as span:
            start_time = time.time()
            
            payload = {
                "actor": req.actor,
                "action": req.action,
                "resource": req.resource,
                "confidence": req.context.confidence,
                "acting_for": req.context.acting_for,
                "scope": req.context.scope,
            }
            
            try:
                data = await self._post("/v1/agent/authorize", payload)
                
                total_latency_ms = (time.time() - start_time) * 1000
                
                # Record decision metrics
                decision_metrics = DecisionMetrics(
                    allowed=data["allowed"],
                    requires_human_review=data.get("requires_human_review", False),
                    confidence=data.get("confidence_used", 0.0),
                    risk_score=data.get("risk_score", 0.0),
                    outcome="review" if data.get("requires_human_review") else ("allowed" if data["allowed"] else "denied")
                )
                
                latency_metrics = LatencyMetrics(total_ms=total_latency_ms)
                
                agent_tracer.record_decision(span, decision_metrics)
                agent_tracer.record_latency(span, latency_metrics)
                
                # Add trace ID and engine decision to span
                if hasattr(span, 'set_attributes'):
                    span.set_attributes({
                        "lelu.trace_id": data["trace_id"],
                        "lelu.engine_decision": data["allowed"],
                        "lelu.downgraded_scope": data.get("downgraded_scope", ""),
                    })
                
                return AgentAuthDecision(
                    allowed=data["allowed"],
                    reason=data["reason"],
                    trace_id=data["trace_id"],
                    downgraded_scope=data.get("downgraded_scope"),
                    requires_human_review=data.get("requires_human_review", False),
                    confidence_used=data.get("confidence_used", 0.0),
                )
            
            except Exception as e:
                # Error is already recorded by the context manager
                raise

    # ── JIT token minting ─────────────────────────────────────────────────────

    async def mint_token(self, req: MintTokenRequest) -> MintTokenResult:
        """Mint a scoped JIT token for an agent. Default TTL is 60 seconds."""
        payload = {
            "scope": req.scope,
            "acting_for": req.acting_for,
            "ttl_seconds": req.ttl_seconds or 60,
        }
        data = await self._post("/v1/tokens/mint", payload)
        return MintTokenResult(
            token=data["token"],
            token_id=data["token_id"],
            expires_at=datetime.fromtimestamp(data["expires_at"], tz=timezone.utc),
        )

    # ── Token revocation ──────────────────────────────────────────────────────

    async def revoke_token(self, token_id: str) -> RevokeTokenResult:
        """Immediately revoke a JIT token by its ID."""
        resp = await self._client.delete(f"/v1/tokens/{token_id}")
        await self._raise_for_status(resp)
        return RevokeTokenResult(**resp.json())

    # ── Multi-agent delegation ────────────────────────────────────────

    async def delegate_scope(self, req: DelegateScopeRequest) -> DelegateScopeResult:
        """
        Delegate a constrained sub-scope from one agent to another.

        Validates the delegation rule in the policy, caps the TTL, and mints a
        child JIT token scoped to the granted actions.

        Confidence-Aware: the delegator's confidence score is checked against
        ``require_confidence_above`` in the policy before delegation is granted.
        
        Enhanced with Phase 1 observability features.
        """
        # Start enhanced delegation tracing span
        with agent_tracer.agent_span(
            "ai.agent.delegate",
            req.delegator,
            AgentTypes.AUTONOMOUS,
            **{
                "ai.parent.agent": req.delegator,
                "ai.child.agent": req.delegatee,
                "ai.delegation.chain": f"{req.delegator}→{req.delegatee}",
                "ai.delegation.scoped_to": ",".join(req.scoped_to) if req.scoped_to else "",
                "ai.delegation.ttl_seconds": req.ttl_seconds or 60,
                "ai.request.confidence": req.confidence or 1.0,
                "ai.request.acting_for": req.acting_for or "",
            }
        ) as span:
            start_time = time.time()
            
            payload = {
                "delegator": req.delegator,
                "delegatee": req.delegatee,
                "scoped_to": req.scoped_to,
                "ttl_seconds": req.ttl_seconds or 60,
                "confidence": req.confidence,
                "acting_for": req.acting_for or "",
                "tenant_id": req.tenant_id or "",
            }
            
            try:
                data = await self._post("/v1/agent/delegate", payload)
                
                total_latency_ms = (time.time() - start_time) * 1000
                
                # Record successful delegation metrics
                decision_metrics = DecisionMetrics(
                    allowed=True,
                    requires_human_review=False,
                    confidence=req.confidence or 1.0,
                    risk_score=0.0,
                    outcome="delegation_allowed"
                )
                
                latency_metrics = LatencyMetrics(total_ms=total_latency_ms)
                
                agent_tracer.record_decision(span, decision_metrics)
                agent_tracer.record_latency(span, latency_metrics)
                
                # Add delegation result attributes
                if hasattr(span, 'set_attributes'):
                    span.set_attributes({
                        "lelu.trace_id": data["trace_id"],
                        "lelu.token_id": data["token_id"],
                        "lelu.granted_scopes": ",".join(data["granted_scopes"]),
                        "lelu.delegation_success": True,
                    })
                
                from datetime import datetime, timezone
                return DelegateScopeResult(
                    token=data["token"],
                    token_id=data["token_id"],
                    expires_at=datetime.fromtimestamp(data["expires_at"], tz=timezone.utc),
                    delegator=data["delegator"],
                    delegatee=data["delegatee"],
                    granted_scopes=data["granted_scopes"],
                    trace_id=data["trace_id"],
                )
            
            except Exception as e:
                # Record delegation failure
                decision_metrics = DecisionMetrics(
                    allowed=False,
                    requires_human_review=False,
                    confidence=req.confidence or 1.0,
                    risk_score=1.0,
                    outcome="delegation_denied"
                )
                
                agent_tracer.record_decision(span, decision_metrics)
                
                if hasattr(span, 'set_attributes'):
                    span.set_attributes({
                        "lelu.delegation_success": False,
                        "lelu.delegation_error": str(e),
                    })
                
                raise

    # ── Health check ──────────────────────────────────────────────────────────

    async def is_healthy(self) -> bool:
        """Return True if the engine sidecar is reachable and healthy."""
        try:
            resp = await self._client.get("/healthz")
            return resp.status_code == 200 and resp.json().get("status") == "ok"
        except httpx.HTTPError:
            return False

    # ── Audit log ─────────────────────────────────────────────────────────────

    async def list_audit_events(self, req: ListAuditEventsRequest | None = None) -> ListAuditEventsResult:
        """
        List audit events from the platform API.
        Requires the platform service to be running (not just the engine).
        """
        if req is None:
            req = ListAuditEventsRequest()

        params = {}
        if req.limit != 20:  # Only add if not default
            params["limit"] = str(req.limit)
        if req.cursor != 0:
            params["cursor"] = str(req.cursor)
        if req.actor:
            params["actor"] = req.actor
        if req.action:
            params["action"] = req.action
        if req.decision:
            params["decision"] = req.decision
        if req.trace_id:
            params["trace_id"] = req.trace_id
        if req.from_time:
            params["from"] = req.from_time
        if req.to_time:
            params["to"] = req.to_time

        headers = {}
        if req.tenant_id:
            headers["X-Tenant-ID"] = req.tenant_id

        resp = await self._client.get("/api/v1/audit", params=params, headers=headers)
        await self._raise_for_status(resp)
        data = resp.json()

        # Handle case where service returns empty or malformed response
        events = data.get("events", []) if data else []
        
        return ListAuditEventsResult(
            events=[AuditEvent(**event) for event in events] if events else [],
            count=data.get("count", 0) if data else 0,
            limit=data.get("limit", req.limit) if data else req.limit,
            cursor=data.get("cursor", 0) if data else 0,
            next_cursor=data.get("next_cursor", 0) if data else 0,
        )

    # ── Policy Management ─────────────────────────────────────────────────────

    async def list_policies(self, req: ListPoliciesRequest | None = None) -> ListPoliciesResult:
        """List all policies from the platform API."""
        if req is None:
            req = ListPoliciesRequest()

        headers = {}
        if req.tenant_id:
            headers["X-Tenant-ID"] = req.tenant_id

        resp = await self._client.get("/api/v1/policies", headers=headers)
        await self._raise_for_status(resp)
        data = resp.json()

        # Handle case where service returns empty or malformed response
        policies = data.get("policies", []) if data else []

        return ListPoliciesResult(
            policies=[Policy(**policy) for policy in policies] if policies else [],
            count=data.get("count", 0) if data else 0,
        )

    async def get_policy(self, req: GetPolicyRequest) -> Policy:
        """Get a specific policy by name."""
        headers = {}
        if req.tenant_id:
            headers["X-Tenant-ID"] = req.tenant_id

        resp = await self._client.get(f"/api/v1/policies/{req.name}", headers=headers)
        await self._raise_for_status(resp)
        data = resp.json()

        return Policy(**data)

    async def upsert_policy(self, req: UpsertPolicyRequest) -> Policy:
        """Create or update a policy."""
        headers = {}
        if req.tenant_id:
            headers["X-Tenant-ID"] = req.tenant_id

        payload = {
            "content": req.content,
            "version": req.version,
        }

        resp = await self._client.put(f"/api/v1/policies/{req.name}", json=payload, headers=headers)
        await self._raise_for_status(resp)
        data = resp.json()

        return Policy(**data)

    async def delete_policy(self, req: DeletePolicyRequest) -> DeletePolicyResult:
        """Delete a policy by name."""
        headers = {}
        if req.tenant_id:
            headers["X-Tenant-ID"] = req.tenant_id

        resp = await self._client.delete(f"/api/v1/policies/{req.name}", headers=headers)
        await self._raise_for_status(resp)
        data = resp.json()

        return DeletePolicyResult(**data)

    # ─── Phase 2: Behavioral Analytics ───────────────────────────────────────

    async def get_agent_reputation(self, agent_id: str) -> AgentReputation:
        """Get reputation information for a specific agent."""
        resp = await self._client.get(f"/v1/analytics/reputation/{agent_id}")
        await self._raise_for_status(resp)
        return AgentReputation(**resp.json())

    async def list_agent_reputations(
        self, 
        sort: str, 
        limit: int | None = None, 
        threshold: float | None = None
    ) -> ReputationListResponse:
        """List agent reputations sorted by performance."""
        params = {"sort": sort}
        if limit:
            params["limit"] = str(limit)
        if threshold:
            params["threshold"] = str(threshold)
        
        resp = await self._client.get("/v1/analytics/reputation", params=params)
        await self._raise_for_status(resp)
        return ReputationListResponse(**resp.json())

    async def get_agent_anomalies(self, agent_id: str, since: datetime | None = None) -> AnomaliesResponse:
        """Get recent anomalies for a specific agent."""
        params = {}
        if since:
            params["since"] = since.isoformat()
        
        resp = await self._client.get(f"/v1/analytics/anomalies/{agent_id}", params=params)
        await self._raise_for_status(resp)
        return AnomaliesResponse(**resp.json())

    async def get_agent_baseline(self, agent_id: str) -> BaselineResponse:
        """Get behavioral baseline information for a specific agent."""
        resp = await self._client.get(f"/v1/analytics/baseline/{agent_id}")
        await self._raise_for_status(resp)
        return BaselineResponse(**resp.json())

    async def refresh_agent_baseline(self, agent_id: str) -> dict[str, Any]:
        """Trigger a baseline refresh for a specific agent."""
        resp = await self._client.post(f"/v1/analytics/baseline/{agent_id}/refresh", json={})
        await self._raise_for_status(resp)
        return resp.json()  # type: ignore[no-any-return]

    async def get_alerts(self, agent_id: str | None = None) -> AlertsResponse:
        """Get active alerts, optionally filtered by agent."""
        params = {}
        if agent_id:
            params["agent_id"] = agent_id
        
        resp = await self._client.get("/v1/analytics/alerts", params=params)
        await self._raise_for_status(resp)
        return AlertsResponse(**resp.json())

    async def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> dict[str, Any]:
        """Acknowledge an alert."""
        payload = {"acknowledged_by": acknowledged_by}
        resp = await self._client.post(f"/v1/analytics/alerts/{alert_id}/acknowledge", json=payload)
        await self._raise_for_status(resp)
        return resp.json()  # type: ignore[no-any-return]

    async def resolve_alert(self, alert_id: str) -> dict[str, Any]:
        """Resolve an alert."""
        resp = await self._client.post(f"/v1/analytics/alerts/{alert_id}/resolve", json={})
        await self._raise_for_status(resp)
        return resp.json()  # type: ignore[no-any-return]

    # ── HTTP helpers ──────────────────────────────────────────────────────────

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        resp = await self._client.post(path, json=payload)
        await self._raise_for_status(resp)
        return resp.json()  # type: ignore[no-any-return]

    @staticmethod
    async def _raise_for_status(resp: httpx.Response) -> None:
        if not resp.is_error:
            return
        try:
            detail = resp.json().get("error", resp.text)
        except Exception:
            detail = resp.text
        raise AuthEngineError(
            message=str(detail),
            status=resp.status_code,
            details=resp.text,
        )


# Backward compatibility alias.
LeluClient = LeluClient
