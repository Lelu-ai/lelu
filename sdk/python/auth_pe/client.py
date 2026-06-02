"""Lelu Python SDK — async HTTP client (httpx-backed)."""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Any

import httpx

from .models import (
    AgentAuthDecision,
    AgentAuthRequest,
    AuthDecision,
    AuthEngineError,
    AuthorizeRequest,
    DelegateScopeRequest,
    DelegateScopeResult,
    MintTokenRequest,
    MintTokenResult,
    RevokeTokenResult,
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
    AgentReputation,
    AnomaliesResponse,
    BaselineResponse,
    AlertsResponse,
    ReputationListResponse,
    AcknowledgeAlertRequest,
    VaultStoreRequest,
    VaultStoreResult,
    VaultTokenResult,
    VaultCredentialSummary,
)
from .observability import (
    agent_tracer,
    DecisionMetrics,
    LatencyMetrics,
    AgentTypes,
)

LELU_CLOUD_URL = "https://lelu-ai.com"


class LeluClient:
    """
    Async client for the Lelu authorization platform.

    Usage::

        async with LeluClient(api_key=os.environ["LELU_API_KEY"]) as lelu:
            result = await lelu.authorize(AuthorizeRequest(tool="delete_file"))
            if result.decision == "deny":
                raise PermissionError(result.reason)

    Or without a context manager::

        lelu = LeluClient(api_key=os.environ["LELU_API_KEY"])
        result = await lelu.authorize(AuthorizeRequest(tool="send_email"))
        await lelu.aclose()
    """

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = 5.0,
        api_key: str | None = None,
    ) -> None:
        resolved_key = api_key or os.environ.get("LELU_API_KEY")

        # Default to cloud when any lelu_sk_* key is provided
        default_url = LELU_CLOUD_URL if resolved_key else "http://localhost:8080"
        resolved_url = (base_url or os.environ.get("LELU_BASE_URL") or default_url).rstrip("/")

        headers: dict[str, str] = {"Content-Type": "application/json"}
        if resolved_key:
            headers["Authorization"] = f"Bearer {resolved_key}"

        self._client = httpx.AsyncClient(
            base_url=resolved_url,
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

    # ── Authorization ─────────────────────────────────────────────────────────

    async def authorize(self, req: AuthorizeRequest) -> AuthDecision:
        """
        Check whether an AI agent is permitted to call a tool.

        Example::

            result = await lelu.authorize(AuthorizeRequest(tool="send_email"))
            if result.decision == "allow":
                pass  # proceed
            elif result.decision == "compute":
                call_tool(result.safe_tool, result.safe_args)  # use safe alternative
            elif result.decision == "human_review":
                return f"Awaiting approval (id: {result.request_id})"
            else:
                return f"Blocked: {result.reason}"
        """
        payload: dict[str, Any] = {"tool": req.tool}
        if req.context is not None:
            payload["context"] = req.context
        if req.args is not None:
            payload["args"] = req.args

        data = await self._post("/api/v1/authorize", payload)
        return AuthDecision(
            request_id=data["requestId"],
            tool=data["tool"],
            decision=data["decision"],
            reason=data["reason"],
            rule=data["rule"],
            policy_name=data.get("policyName"),
            latency_ms=data["latencyMs"],
            mode=data["mode"],
            key_id=data.get("keyId"),
            timestamp=data["timestamp"],
            safe_tool=data.get("safeTool"),
            safe_args=data.get("safeArgs"),
        )

    # ── Agent authorization (backward compat) ─────────────────────────────────

    async def agent_authorize(self, req: AgentAuthRequest) -> AgentAuthDecision:
        """
        Deprecated. Use authorize() instead.
        Kept for backward compatibility — maps AgentAuthRequest to authorize().
        """
        with agent_tracer.agent_span(
            "ai.agent.authorize",
            req.actor,
            agent_type=AgentTypes.AUTONOMOUS,
            **{
                "ai.request.intent": req.action,
                "ai.request.confidence": req.context.confidence,
                "ai.request.acting_for": req.context.acting_for or "",
            },
        ) as _span:
            auth_req = AuthorizeRequest(tool=req.action)
            decision = await self.authorize(auth_req)
            return AgentAuthDecision(
                request_id=decision.request_id,
                tool=decision.tool,
                decision=decision.decision,
                reason=decision.reason,
                rule=decision.rule,
                policy_name=decision.policy_name,
                latency_ms=decision.latency_ms,
                mode=decision.mode,
                key_id=decision.key_id,
                timestamp=decision.timestamp,
                confidence_used=req.context.confidence,
                trace_id=decision.request_id,
                downgraded_scope=None,
            )

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

    # ── Multi-agent delegation ─────────────────────────────────────────────────

    async def delegate_scope(self, req: DelegateScopeRequest) -> DelegateScopeResult:
        """Delegate a constrained sub-scope from one agent to another."""
        with agent_tracer.agent_span(
            "ai.agent.delegate",
            req.delegator,
            AgentTypes.AUTONOMOUS,
            **{
                "ai.parent.agent": req.delegator,
                "ai.child.agent": req.delegatee,
                "ai.request.confidence": req.confidence or 1.0,
            },
        ) as _span:
            payload = {
                "delegator": req.delegator,
                "delegatee": req.delegatee,
                "scoped_to": req.scoped_to,
                "ttl_seconds": req.ttl_seconds or 60,
                "confidence": req.confidence,
                "acting_for": req.acting_for or "",
                "tenant_id": req.tenant_id or "",
            }
            data = await self._post("/v1/agent/delegate", payload)
            return DelegateScopeResult(
                token=data["token"],
                token_id=data["token_id"],
                expires_at=datetime.fromtimestamp(data["expires_at"], tz=timezone.utc),
                delegator=data["delegator"],
                delegatee=data["delegatee"],
                granted_scopes=data["granted_scopes"],
                trace_id=data["trace_id"],
            )

    # ── Health check ──────────────────────────────────────────────────────────

    async def is_healthy(self) -> bool:
        """Return True if the platform is reachable."""
        try:
            resp = await self._client.get("/api/config-check")
            return resp.is_success
        except httpx.HTTPError:
            return False

    # ── Audit log ─────────────────────────────────────────────────────────────

    async def list_audit_events(
        self, req: ListAuditEventsRequest | None = None
    ) -> ListAuditEventsResult:
        """List audit events from the platform."""
        if req is None:
            req = ListAuditEventsRequest()

        params: dict[str, str] = {}
        if req.limit != 20:
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

        resp = await self._client.get("/api/v1/audit", params=params)
        await self._raise_for_status(resp)
        data = resp.json()

        events_raw = data.get("events", []) or []
        return ListAuditEventsResult(
            events=[AuditEvent(**e) for e in events_raw],
            count=data.get("count", 0),
            limit=data.get("limit", req.limit),
            cursor=data.get("cursor", 0),
            next_cursor=data.get("next_cursor", 0),
        )

    # ── Policy management ─────────────────────────────────────────────────────

    async def list_policies(
        self, _req: ListPoliciesRequest | None = None
    ) -> ListPoliciesResult:
        """List all policies for the authenticated user."""
        resp = await self._client.get("/api/policies")
        await self._raise_for_status(resp)
        data = resp.json()
        policies_raw = data.get("policies", []) or []
        count = len(policies_raw)
        return ListPoliciesResult(
            policies=[Policy(**p) for p in policies_raw],
            count=count,
        )

    async def get_policy(self, req: GetPolicyRequest) -> Policy:
        """Get a specific policy by ID."""
        resp = await self._client.get(f"/api/policies/{req.id}")
        await self._raise_for_status(resp)
        data = resp.json()
        return Policy(**data["policy"])

    async def upsert_policy(self, req: UpsertPolicyRequest) -> Policy:
        """Create or update a policy."""
        payload = {
            "name": req.name,
            "description": req.description,
            "rules": [r.model_dump() for r in req.rules],
            "isActive": req.is_active,
        }
        data = await self._post("/api/policies", payload)
        return Policy(**data["policy"])

    async def delete_policy(self, req: DeletePolicyRequest) -> DeletePolicyResult:
        """Delete a policy by ID."""
        resp = await self._client.delete(f"/api/policies/{req.id}")
        await self._raise_for_status(resp)
        data = resp.json()
        # Backend returns { deleted: true }
        return DeletePolicyResult(deleted=data.get("deleted", data.get("ok", False)))

    # ── Phase 2: Behavioral Analytics ─────────────────────────────────────────

    async def get_agent_reputation(self, agent_id: str) -> AgentReputation:
        resp = await self._client.get(f"/v1/analytics/reputation/{agent_id}")
        await self._raise_for_status(resp)
        return AgentReputation(**resp.json())

    async def list_agent_reputations(
        self,
        sort: str,
        limit: int | None = None,
        threshold: float | None = None,
    ) -> ReputationListResponse:
        params: dict[str, str] = {"sort": sort}
        if limit:
            params["limit"] = str(limit)
        if threshold:
            params["threshold"] = str(threshold)
        resp = await self._client.get("/v1/analytics/reputation", params=params)
        await self._raise_for_status(resp)
        return ReputationListResponse(**resp.json())

    async def get_agent_anomalies(
        self, agent_id: str, since: datetime | None = None
    ) -> AnomaliesResponse:
        params: dict[str, str] = {}
        if since:
            params["since"] = since.isoformat()
        resp = await self._client.get(f"/v1/analytics/anomalies/{agent_id}", params=params)
        await self._raise_for_status(resp)
        return AnomaliesResponse(**resp.json())

    async def get_agent_baseline(self, agent_id: str) -> BaselineResponse:
        resp = await self._client.get(f"/v1/analytics/baseline/{agent_id}")
        await self._raise_for_status(resp)
        return BaselineResponse(**resp.json())

    async def refresh_agent_baseline(self, agent_id: str) -> dict[str, Any]:
        resp = await self._client.post(f"/v1/analytics/baseline/{agent_id}/refresh", json={})
        await self._raise_for_status(resp)
        return resp.json()  # type: ignore[no-any-return]

    async def get_alerts(self, agent_id: str | None = None) -> AlertsResponse:
        params: dict[str, str] = {}
        if agent_id:
            params["agent_id"] = agent_id
        resp = await self._client.get("/v1/analytics/alerts", params=params)
        await self._raise_for_status(resp)
        return AlertsResponse(**resp.json())

    async def acknowledge_alert(
        self, alert_id: str, acknowledged_by: str
    ) -> dict[str, Any]:
        resp = await self._client.post(
            f"/v1/analytics/alerts/{alert_id}/acknowledge",
            json={"acknowledged_by": acknowledged_by},
        )
        await self._raise_for_status(resp)
        return resp.json()  # type: ignore[no-any-return]

    async def resolve_alert(self, alert_id: str) -> dict[str, Any]:
        resp = await self._client.post(f"/v1/analytics/alerts/{alert_id}/resolve", json={})
        await self._raise_for_status(resp)
        return resp.json()  # type: ignore[no-any-return]

    # ── OAuth Token Vault ──────────────────────────────────────────────────────

    async def vault_store(self, req: VaultStoreRequest) -> VaultStoreResult:
        """Store an OAuth credential in the encrypted vault."""
        payload: dict[str, Any] = {
            "agent_id": req.agent_id,
            "user_id": req.user_id,
            "provider": req.provider,
            "access_token": req.access_token,
        }
        if req.refresh_token:
            payload["refresh_token"] = req.refresh_token
        if req.scopes:
            payload["scopes"] = req.scopes
        if req.expires_in:
            payload["expires_in"] = req.expires_in
        data = await self._post("/v1/vault/store", payload)
        return VaultStoreResult(**{
            "id": data["id"],
            "agent_id": data["agent_id"],
            "user_id": data["user_id"],
            "provider": data["provider"],
            "scopes": data.get("scopes") or [],
            "expires_at": data.get("expires_at"),
            "created_at": data["created_at"],
        })

    async def vault_get_token(self, agent_id: str, user_id: str, provider: str) -> VaultTokenResult:
        """Retrieve an access token from the vault (auto-refreshes if expiring)."""
        resp = await self._client.get(
            "/v1/vault/token",
            params={"agent_id": agent_id, "user_id": user_id, "provider": provider},
        )
        await self._raise_for_status(resp)
        data = resp.json()
        return VaultTokenResult(**{
            "agent_id": data["agent_id"],
            "user_id": data["user_id"],
            "provider": data["provider"],
            "access_token": data["access_token"],
            "scopes": data.get("scopes") or [],
            "expires_at": data.get("expires_at"),
            "refreshed": data.get("refreshed", False),
        })

    async def vault_revoke(self, agent_id: str, user_id: str, provider: str) -> bool:
        """Revoke and delete a stored credential."""
        resp = await self._client.delete(
            "/v1/vault/credential",
            params={"agent_id": agent_id, "user_id": user_id, "provider": provider},
        )
        await self._raise_for_status(resp)
        return resp.json().get("success", False)

    async def vault_list(self, agent_id: str) -> list[VaultCredentialSummary]:
        """List stored credential summaries for an agent (no tokens exposed)."""
        resp = await self._client.get("/v1/vault/list", params={"agent_id": agent_id})
        await self._raise_for_status(resp)
        return [VaultCredentialSummary(**c) for c in resp.json().get("credentials") or []]

    async def vault_providers(self) -> list[str]:
        """List available OAuth provider names configured in the engine."""
        resp = await self._client.get("/v1/vault/providers")
        await self._raise_for_status(resp)
        return resp.json().get("providers") or []

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
