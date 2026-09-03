"""Lelu Python SDK — async HTTP client (httpx-backed)."""

from __future__ import annotations

import math
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
    RegisterAgentRequest,
    RegisteredAgent,
    AgentWorkloadToken,
    AgentStatusResult,
    NHIEntry,
    NHIScanResult,
    NHIStats,
    RegisterOAuthClientRequest,
    OAuthClient,
    ReviewItem,
    ListReviewsResult,
    RedeemResult,
    ScanOutputResult,
    EnginePolicyInfo,
    PolicyValidationResult,
    PolicyUpdateResult,
    SimulatorReplayRequest,
    SimulatorReplayResponse,
)
from .local import discover_local_engine
from .observability import (
    agent_tracer,
    DecisionMetrics,
    LatencyMetrics,
    AgentTypes,
)

LELU_CLOUD_URL = "https://lelu-ai.com"


class ConfidenceFrom:
    """Derives a verified confidence score from an LLM provider response.

    Use the result as ``context.confidence`` in authorize calls — never let
    the agent supply its own confidence value. Mirrors the TypeScript SDK's
    ``LeluClient.confidenceFrom``.
    """

    @staticmethod
    def openai(response: Any) -> float | None:
        """Derive confidence from OpenAI chat-completion logprobs (requires
        ``logprobs=True`` in the API call). Returns ``None`` when logprobs are
        absent — never returns a fabricated default."""
        try:
            tokens = response.choices[0].logprobs.content
        except (AttributeError, IndexError, TypeError):
            return None
        if not tokens:
            return None
        avg = sum(t.logprob for t in tokens) / len(tokens)
        return max(0.0, min(1.0, math.exp(avg)))

    @staticmethod
    def anthropic(_response: Any) -> None:
        """Anthropic does not expose token-level log-probs.
        Always returns ``None`` — use a judge-model scorer instead."""
        return None

    @staticmethod
    def bedrock(response: Any) -> float | None:
        """Derive confidence from an Amazon Bedrock model response, for model
        families that expose token-level data — e.g. Cohere
        ``token_likelihoods``, or a raw ``logprobs`` list. Returns ``None``
        when no token signal is present (notably Anthropic Claude on Bedrock,
        which has no log-probs): omit the signal and let the engine's
        ``MissingSignalMode`` decide rather than fabricating a value."""
        logprobs: list[float] | None = None
        if isinstance(response, dict):
            logprobs = response.get("logprobs")
            if not logprobs:
                generations = response.get("generations") or []
                first = generations[0] if generations else None
                likelihoods = (first or {}).get("token_likelihoods")
                if likelihoods:
                    logprobs = [t["likelihood"] for t in likelihoods]
        else:
            logprobs = getattr(response, "logprobs", None)
            if not logprobs:
                try:
                    generations = response.generations
                    likelihoods = generations[0].token_likelihoods
                    logprobs = [t.likelihood for t in likelihoods] if likelihoods else None
                except (AttributeError, IndexError, TypeError):
                    logprobs = None
        if not logprobs:
            return None
        avg = sum(logprobs) / len(logprobs)
        return max(0.0, min(1.0, math.exp(avg)))


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

    #: Derives a verified confidence score from an LLM provider response —
    #: e.g. ``LeluClient.confidence_from.openai(response)``.
    confidence_from = ConfidenceFrom

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = 5.0,
        api_key: str | None = None,
    ) -> None:
        resolved_key = api_key or os.environ.get("LELU_API_KEY")
        resolved_url = base_url or os.environ.get("LELU_BASE_URL")

        if resolved_url is None:
            if resolved_key:
                # Default to cloud when any lelu_sk_* key is provided
                resolved_url = LELU_CLOUD_URL
            else:
                # Zero-config: with no explicit target, connect to the engine
                # `lelu-mcp` is already running here (recorded in ~/.lelu).
                local = discover_local_engine()
                if local.base_url:
                    resolved_url = local.base_url
                    resolved_key = local.api_key
                else:
                    resolved_url = "http://localhost:8080"
        resolved_url = resolved_url.rstrip("/")

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

    @staticmethod
    def _authorize_body(req: AuthorizeRequest) -> dict[str, Any]:
        """
        Build the engine's agent-authorize body. `tool` maps to `action`;
        confidence is sent only when present so the engine's
        MissingSignalMode decides on absence rather than a fabricated
        perfect score.

        Shared by authorize() and redeem_review() on purpose. The engine
        fingerprints the effect-determining fields of this body to bind an
        approval to a payload; if the two call sites built the body even
        slightly differently, an unmodified request would fail redemption
        for no reason the caller could see.
        """
        body: dict[str, Any] = {"action": req.tool}
        if req.actor:
            body["actor"] = req.actor
        ctx = req.context
        if ctx is not None:
            if ctx.confidence is not None:
                body["confidence"] = ctx.confidence
            if ctx.acting_for:
                body["acting_for"] = ctx.acting_for
            if ctx.scope:
                body["scope"] = ctx.scope
        if req.args is not None:
            body["args"] = req.args
        if req.resource:
            body["resource"] = req.resource
        if req.tenant_id:
            body["tenant_id"] = req.tenant_id
        return body

    async def authorize(self, req: AuthorizeRequest) -> AuthDecision:
        """
        Check whether an AI agent is permitted to call a tool.

        Example::

            req = AuthorizeRequest(tool="send_email")
            result = await lelu.authorize(req)
            if result.decision == "allow":
                pass  # proceed
            elif result.decision == "compute":
                call_tool(result.safe_tool, result.safe_args)  # use safe alternative
            elif result.decision == "human_review":
                # Don't just wait for "approved" and then act — an approval
                # is bound to the payload it approved. wait_and_redeem()
                # waits, then re-checks this exact request against it.
                outcome = await lelu.wait_and_redeem(result, req)
                if not outcome.allowed:
                    return f"Not approved for this action: {outcome.reason}"
            else:
                return f"Blocked: {result.reason}"
        """
        data = await self._post("/v1/agent/authorize", self._authorize_body(req))

        # Derive the decision from the engine's boolean flags.
        if data.get("compute"):
            decision = "compute"
        elif data.get("requires_human_review"):
            decision = "human_review"
        elif data.get("allowed"):
            decision = "allow"
        else:
            decision = "deny"

        return AuthDecision(
            request_id=data.get("trace_id", ""),
            tool=req.tool,
            decision=decision,
            reason=data.get("reason", ""),
            rule="",
            policy_name=None,
            latency_ms=0.0,
            mode="live",
            key_id=None,
            timestamp=datetime.now(timezone.utc).isoformat(),
            safe_tool=data.get("safe_tool"),
            safe_args=data.get("safe_args"),
            input_hash=data.get("input_hash"),
            output_hash=data.get("output_hash"),
            policy_digest=data.get("policy_digest"),
            confidence_used=data.get("confidence_used", 0.0),
            effective_scope=data.get("effective_scope"),
            downgraded_scope=data.get("downgraded_scope"),
            review_id=data.get("review_id"),
            risk_score=data.get("risk_score"),
            risk_criticality=data.get("risk_criticality"),
            risk_reliability=data.get("risk_reliability"),
            risk_anomaly_factor=data.get("risk_anomaly_factor"),
            shadow_mode=data.get("shadow_mode", False),
            would_have_allowed=data.get("would_have_allowed"),
            would_have_reason=data.get("would_have_reason"),
            would_have_requires_human_review=data.get("would_have_requires_human_review"),
        )

    async def authorize_tool(self, req: AuthorizeRequest) -> AuthDecision:
        """Alias for :meth:`authorize` kept for tool-wrapper integrations."""
        return await self.authorize(req)

    # ── Agent authorization (backward compat) ─────────────────────────────────

    async def agent_authorize(self, req: AgentAuthRequest) -> AgentAuthDecision:
        """
        Deprecated. Use authorize() instead.
        Kept for backward compatibility — maps AgentAuthRequest to authorize().
        """
        confidence_used = req.context.confidence if req.context.confidence is not None else 0.0
        with agent_tracer.agent_span(
            "ai.agent.authorize",
            req.actor,
            agent_type=AgentTypes.AUTONOMOUS,
            **{
                "ai.request.intent": req.action,
                "ai.request.confidence": confidence_used,
                "ai.request.acting_for": req.context.acting_for or "",
            },
        ) as _span:
            # Pass the full context through — confidence, acting_for and scope
            # must reach the engine, not be dropped on the floor.
            auth_req = AuthorizeRequest(tool=req.action, actor=req.actor, context=req.context)
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
                confidence_used=confidence_used,
                trace_id=decision.request_id,
                downgraded_scope=decision.downgraded_scope,
                safe_tool=decision.safe_tool,
                safe_args=decision.safe_args,
                review_id=decision.review_id,
            )

    # ── Human review queue (engine /v1/queue) ─────────────────────────────────

    async def list_pending_reviews(self) -> ListReviewsResult:
        """List actions currently paused for human review."""
        resp = await self._client.get("/v1/queue/pending")
        await self._raise_for_status(resp)
        data = resp.json()
        items = [ReviewItem(**i) for i in (data.get("items") or [])]
        return ListReviewsResult(items=items, count=data.get("count", len(items)))

    async def get_review(self, review_id: str) -> ReviewItem:
        """Fetch one review item by ID."""
        resp = await self._client.get(f"/v1/queue/{review_id}")
        await self._raise_for_status(resp)
        return ReviewItem(**resp.json())

    async def wait_review(self, review_id: str, timeout_ms: int = 30_000) -> ReviewItem:
        """
        Long-poll until the review is resolved or `timeout_ms` elapses
        (engine caps the wait at 60s per call). Returns the item either way —
        check `.pending` to see whether it resolved.
        """
        resp = await self._client.get(
            f"/v1/queue/{review_id}/wait",
            params={"timeout_ms": str(timeout_ms)},
            timeout=(timeout_ms / 1000) + 10,
        )
        if resp.status_code not in (200, 408):
            await self._raise_for_status(resp)
        return ReviewItem(**resp.json())

    async def approve_review(self, review_id: str, resolved_by: str = "", note: str = "") -> bool:
        """Approve a paused action; the waiting agent resumes."""
        data = await self._post(
            f"/v1/queue/{review_id}/approve", {"resolved_by": resolved_by, "note": note}
        )
        return bool(data.get("success"))

    async def deny_review(self, review_id: str, resolved_by: str = "", note: str = "") -> bool:
        """Deny a paused action; the waiting agent receives the denial."""
        data = await self._post(
            f"/v1/queue/{review_id}/deny", {"resolved_by": resolved_by, "note": note}
        )
        return bool(data.get("success"))

    @staticmethod
    def _review_id_of(review: str | AuthDecision) -> str:
        """
        Resolve a review handle from either the decision itself or a raw ID.

        Prefer passing the :class:`AuthDecision`. A decision carries two IDs
        — ``request_id`` (trace/correlation) and ``review_id`` (the queue
        key) — and reaching for "the request's ID" gets you the wrong one,
        with no visible symptom until redemption fails. Taking the decision
        object removes the choice.

        A raw string is still accepted for callers that only stored the ID,
        but an ``AuthDecision`` with no ``review_id`` raises here rather
        than sending an empty path segment to the engine.
        """
        if isinstance(review, str):
            return review
        if not review.review_id:
            raise ValueError(
                "this decision has no review_id — only a human_review decision "
                "can be redeemed (this one was: "
                f"{review.decision!r}). Note request_id is the trace ID, not a "
                "review handle."
            )
        return review.review_id

    async def redeem_review(
        self, review: str | AuthDecision, req: AuthorizeRequest
    ) -> RedeemResult:
        """
        Check an approval against the request you are about to execute.

        Pass the :class:`AuthDecision` you got back from :meth:`authorize`
        (or its ``review_id``), plus the same :class:`AuthorizeRequest` you
        passed in. The engine fingerprinted that request's
        effect-determining fields — action, resource, args, acting_for,
        scope — when it paused for review, and compares them again here.
        A request altered in between is refused rather than executing under
        an approval that was granted for something else.

        Confidence is deliberately outside that comparison: a reviewer
        approves an effect, not the model's confidence in it, so an agent
        that recomputed confidence in the meantime still redeems fine.

        Returns a :class:`RedeemResult` rather than raising on refusal —
        "not allowed" is an answer, not an error.
        """
        review_id = self._review_id_of(review)
        resp = await self._client.post(
            f"/v1/queue/{review_id}/redeem", json=self._authorize_body(req)
        )
        # 403 is the engine's refusal, and carries the reason in its body.
        # Anything else unexpected is a genuine transport/server fault.
        if resp.status_code not in (200, 403):
            await self._raise_for_status(resp)
        return RedeemResult(**resp.json())

    async def wait_and_redeem(
        self,
        review: str | AuthDecision,
        req: AuthorizeRequest,
        timeout_ms: int = 30_000,
    ) -> RedeemResult:
        """
        Wait for a human decision, then redeem the approval against `req`.

        This is the path you want after a ``human_review`` decision.
        Waiting alone only tells you a reviewer said yes to *something*;
        it doesn't bind that yes to what you then execute. This waits, and
        on approval re-checks this exact request against what was approved.

        Pass the :class:`AuthDecision` itself rather than an ID where you
        can — see :meth:`_review_id_of` for why that's the safer call.

        Returns ``allowed=False`` with a reason when the wait times out
        while still pending, when the review was denied, or when the
        payload no longer matches — the caller has one thing to check
        rather than three.
        """
        review_id = self._review_id_of(review)
        item = await self.wait_review(review_id, timeout_ms=timeout_ms)
        if item.pending:
            return RedeemResult(
                allowed=False,
                reason=f"still pending after {timeout_ms}ms",
                review_id=review_id,
            )
        if not item.approved:
            return RedeemResult(
                allowed=False,
                reason=f"review was {item.status}",
                review_id=review_id,
            )
        return await self.redeem_review(review_id, req)

    # ── Output scanning (indirect injection defense) ──────────────────────────

    async def scan_output(
        self,
        output: str,
        actor: str | None = None,
        action: str | None = None,
        resource: dict[str, str] | None = None,
    ) -> ScanOutputResult:
        """Scan a tool output for injected instructions before the agent reads it."""
        body: dict[str, Any] = {"output": output}
        if actor:
            body["actor"] = actor
        if action:
            body["action"] = action
        if resource:
            body["resource"] = resource
        data = await self._post("/v1/scan/output", body)
        return ScanOutputResult(**data)

    # ── Engine policy (engine /v1/policy) ─────────────────────────────────────

    async def get_engine_policy(self) -> EnginePolicyInfo:
        """Digest and source of the policy currently loaded in the engine."""
        resp = await self._client.get("/v1/policy")
        await self._raise_for_status(resp)
        return EnginePolicyInfo(**resp.json())

    async def validate_policy(self, policy: str | bytes) -> PolicyValidationResult:
        """Validate policy bytes without touching the live policy."""
        content = policy.encode() if isinstance(policy, str) else policy
        resp = await self._client.post(
            "/v1/policy/validate", content=content,
            headers={"Content-Type": "application/x-yaml"},
        )
        await self._raise_for_status(resp)
        return PolicyValidationResult(**resp.json())

    async def put_engine_policy(
        self, policy: str | bytes, if_match: str | None = None
    ) -> PolicyUpdateResult:
        """
        Replace the engine's active policy (requires the admin API key).
        Pass `if_match` (the digest from get_engine_policy) for optimistic
        concurrency — the engine rejects the write if the policy changed.
        """
        content = policy.encode() if isinstance(policy, str) else policy
        headers = {"Content-Type": "application/x-yaml"}
        if if_match:
            headers["If-Match"] = if_match
        resp = await self._client.put("/v1/policy", content=content, headers=headers)
        await self._raise_for_status(resp)
        return PolicyUpdateResult(**resp.json())

    # ── Policy simulator (engine /v1/simulator/replay) ────────────────────────

    async def simulator_replay(self, req: SimulatorReplayRequest) -> SimulatorReplayResponse:
        """Replay historical traces against a proposed policy to preview its
        impact before promoting it live."""
        data = await self._post("/v1/simulator/replay", req.model_dump())
        return SimulatorReplayResponse(**data)

    # ── Engine status ──────────────────────────────────────────────────────────

    async def fallback_status(self) -> dict[str, Any]:
        """Status of the engine's fallback layer (returns the raw engine payload)."""
        resp = await self._client.get("/v1/fallback/status")
        await self._raise_for_status(resp)
        return resp.json()  # type: ignore[no-any-return]

    async def shadow_summary(self) -> dict[str, Any]:
        """Shadow-mode evaluation summary (returns the raw engine payload)."""
        resp = await self._client.get("/v1/shadow/summary")
        await self._raise_for_status(resp)
        return resp.json()  # type: ignore[no-any-return]

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
        """Return True if the engine is reachable."""
        try:
            resp = await self._client.get("/healthz")
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
        return bool(resp.json().get("success", False))

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

    # ── Agent Identity Registry ───────────────────────────────────────────────

    async def register_agent(self, req: RegisterAgentRequest) -> RegisteredAgent:
        """Register a new agent identity with a stable UUID."""
        payload: dict[str, Any] = {"name": req.name}
        if req.description is not None:
            payload["description"] = req.description
        if req.agent_type is not None:
            payload["agent_type"] = req.agent_type
        if req.owner_email is not None:
            payload["owner_email"] = req.owner_email
        if req.scopes is not None:
            payload["scopes"] = req.scopes
        if req.metadata is not None:
            payload["metadata"] = req.metadata
        data = await self._post("/v1/agents", payload)
        return RegisteredAgent(**data)

    async def list_agents(self, tenant_id: str | None = None) -> list[RegisteredAgent]:
        """List all registered agents, optionally filtered by tenant."""
        params = {"tenant_id": tenant_id} if tenant_id else {}
        resp = await self._client.get("/v1/agents", params=params)
        await self._raise_for_status(resp)
        return [RegisteredAgent(**a) for a in resp.json().get("agents") or []]

    async def get_agent(self, agent_id: str) -> RegisteredAgent:
        """Get a single registered agent by its stable ID."""
        resp = await self._client.get(f"/v1/agents/{agent_id}")
        await self._raise_for_status(resp)
        return RegisteredAgent(**resp.json())

    async def revoke_agent(self, agent_id: str) -> AgentStatusResult:
        """Permanently revoke an agent — all future token issuances are rejected."""
        resp = await self._client.delete(f"/v1/agents/{agent_id}")
        await self._raise_for_status(resp)
        d = resp.json()
        return AgentStatusResult(agent_id=d["agent_id"], status=d["status"])

    async def suspend_agent(self, agent_id: str) -> AgentStatusResult:
        """Suspend an agent (reversible). Use revoke_agent for permanent revocation."""
        data = await self._post(f"/v1/agents/{agent_id}/suspend", {})
        return AgentStatusResult(agent_id=data["agent_id"], status=data["status"])

    async def issue_agent_token(self, agent_id: str) -> AgentWorkloadToken:
        """Issue a short-lived OIDC-compatible RS256 JWT for a registered agent."""
        data = await self._post(f"/v1/agents/{agent_id}/token", {})
        return AgentWorkloadToken(
            token=data["token"],
            agent_id=data["agent_id"],
            scopes=data.get("scopes") or [],
            expires_at=data["expires_at"],
            issued_at=data["issued_at"],
        )

    # ── NHI Discovery + ISPM ──────────────────────────────────────────────────

    async def list_nhi(self, tenant_id: str | None = None) -> list[NHIEntry]:
        """List all NHIs (registered agents + shadow agents + credentials) with risk scores."""
        params = {"tenant_id": tenant_id} if tenant_id else {}
        resp = await self._client.get("/v1/nhi/inventory", params=params)
        await self._raise_for_status(resp)
        return [NHIEntry(**e) for e in resp.json().get("nhis") or []]

    async def get_nhi(self, nhi_id: str) -> NHIEntry:
        """Get a single NHI by ID with full OWASP findings and remediation."""
        resp = await self._client.get(f"/v1/nhi/inventory/{nhi_id}")
        await self._raise_for_status(resp)
        return NHIEntry(**resp.json())

    async def get_top_risks(
        self, tenant_id: str | None = None, limit: int = 10
    ) -> list[NHIEntry]:
        """Return the top-N highest-risk NHIs."""
        params: dict[str, Any] = {"limit": limit}
        if tenant_id:
            params["tenant_id"] = tenant_id
        resp = await self._client.get("/v1/nhi/risks", params=params)
        await self._raise_for_status(resp)
        return [NHIEntry(**e) for e in resp.json().get("top_risks") or []]

    async def trigger_nhi_scan(self, tenant_id: str | None = None) -> NHIScanResult:
        """Trigger a full NHI scan and return an aggregate posture summary."""
        params = {"tenant_id": tenant_id} if tenant_id else {}
        resp = await self._client.post("/v1/nhi/scan", params=params)
        await self._raise_for_status(resp)
        return NHIScanResult(**resp.json())

    async def get_nhi_stats(self, tenant_id: str | None = None) -> NHIStats:
        """Return lightweight aggregate NHI counts without running full checks."""
        params = {"tenant_id": tenant_id} if tenant_id else {}
        resp = await self._client.get("/v1/nhi/stats", params=params)
        await self._raise_for_status(resp)
        return NHIStats(**resp.json())

    # ── MCP OAuth 2.1 ────────────────────────────────────────────────────────

    async def register_oauth_client(
        self, req: RegisterOAuthClientRequest
    ) -> OAuthClient:
        """Dynamically register an MCP OAuth 2.1 client (RFC 7591)."""
        payload: dict[str, Any] = {}
        if req.client_name is not None:
            payload["client_name"] = req.client_name
        if req.redirect_uris is not None:
            payload["redirect_uris"] = req.redirect_uris
        if req.grant_types is not None:
            payload["grant_types"] = req.grant_types
        if req.scope is not None:
            payload["scope"] = req.scope
        if req.token_endpoint_auth_method is not None:
            payload["token_endpoint_auth_method"] = req.token_endpoint_auth_method
        data = await self._post("/oauth/clients", payload)
        return OAuthClient(
            client_id=data["client_id"],
            client_secret=data.get("client_secret"),
            client_name=data.get("client_name", ""),
            redirect_uris=data.get("redirect_uris") or [],
            grant_types=data.get("grant_types") or [],
            scope=data.get("scope", ""),
            token_endpoint_auth_method=data.get("token_endpoint_auth_method", ""),
            client_id_issued_at=data.get("client_id_issued_at", 0),
        )

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
