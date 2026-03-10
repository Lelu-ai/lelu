"""Auth Permission Engine — async Python client (httpx-backed)."""

from __future__ import annotations

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
        """
        payload = {
            "actor": req.actor,
            "action": req.action,
            "resource": req.resource,
            "confidence": req.context.confidence,
            "acting_for": req.context.acting_for,
            "scope": req.context.scope,
        }
        data = await self._post("/v1/agent/authorize", payload)
        return AgentAuthDecision(
            allowed=data["allowed"],
            reason=data["reason"],
            trace_id=data["trace_id"],
            downgraded_scope=data.get("downgraded_scope"),
            requires_human_review=data.get("requires_human_review", False),
            confidence_used=data.get("confidence_used", 0.0),
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

    # ── Multi-agent delegation ────────────────────────────────────────

    async def delegate_scope(self, req: DelegateScopeRequest) -> DelegateScopeResult:
        """
        Delegate a constrained sub-scope from one agent to another.

        Validates the delegation rule in the policy, caps the TTL, and mints a
        child JIT token scoped to the granted actions.

        Confidence-Aware: the delegator's confidence score is checked against
        ``require_confidence_above`` in the policy before delegation is granted.
        """
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

        return ListAuditEventsResult(
            events=[AuditEvent(**event) for event in data["events"]],
            count=data["count"],
            limit=data["limit"],
            cursor=data["cursor"],
            next_cursor=data["next_cursor"],
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

        return ListPoliciesResult(
            policies=[Policy(**policy) for policy in data["policies"]],
            count=data["count"],
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
