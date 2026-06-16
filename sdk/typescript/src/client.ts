import {
  AuthEngineError,
  AuthorizeRequestSchema,
  AgentAuthRequestSchema,
  MintTokenRequestSchema,
  DelegateScopeRequestSchema,
  type AuthDecision,
  type AgentAuthDecision,
  type MintTokenResult,
  type DelegateScopeResult,
  type DelegateScopeRequest,
  type RevokeTokenResult,
  type AgentAuthRequest,
  type MintTokenRequest,
  type ClientConfig,
  type AuthorizeRequest,
  type AuditEvent,
  type ListAuditEventsRequest,
  type ListAuditEventsResult,
  type Policy,
  type ListPoliciesRequest,
  type ListPoliciesResult,
  type GetPolicyRequest,
  type UpsertPolicyRequest,
  type DeletePolicyRequest,
  type DeletePolicyResult,
  type AgentReputation,
  type AnomaliesResponse,
  type BaselineResponse,
  type AlertsResponse,
  type ReputationListResponse,
  type AcknowledgeAlertRequest,
  type VaultStoreRequest,
  type VaultStoreResult,
  type VaultTokenResult,
  type VaultCredentialSummary,
  type ShadowSummaryResponse,
  type ReviewQueueItem,
  type SimulatorReplayRequest,
  type SimulatorReplayResponse,
  type RegisterAgentRequest,
  type RegisteredAgent,
  type ListAgentsResult,
  type AgentWorkloadToken,
  type AgentStatusResult,
  type RegisterOAuthClientRequest,
  type OAuthClient,
  type NHIListResult,
  type NHIEntry,
  type NHITopRisksResult,
  type NHIScanResult,
  type NHIStats,
  type ToolOutputScanResult,
} from "./types.js";
import { agentTracer } from "./observability/tracer.js";

// ─── Client ───────────────────────────────────────────────────────────────────

/**
 * LeluClient — authorization engine for AI agents.
 *
 * @example
 * ```ts
 * import { createClient } from "lelu-agent-auth";
 *
 * const lelu = createClient({ apiKey: process.env.LELU_API_KEY });
 *
 * const { decision, reason } = await lelu.authorize({ tool: "delete_file" });
 * if (decision === "deny") throw new Error(reason);
 * ```
 */
export class LeluClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly apiKey: string | undefined;

  /** Lelu cloud — no self-hosting required. */
  static readonly CLOUD_URL = "https://lelu-ai.com";

  /**
   * Derives a verified confidence score from an LLM provider response.
   * Use the result as `confidence_signal` in agent authorize calls — never
   * let the agent supply its own confidence value.
   *
   * @example
   * ```ts
   * const resp = await openai.chat.completions.create({ logprobs: true, ... });
   * const score = LeluClient.confidenceFrom.openai(resp);  // null if no logprobs
   * ```
   */
  static readonly confidenceFrom = {
    /**
     * Derives confidence from OpenAI logprobs (requires `logprobs: true` in the
     * API call). Returns `null` when logprobs are absent — never returns a
     * fabricated default.
     */
    openai(
      response: {
        choices?: Array<{
          logprobs?: { content?: Array<{ logprob: number }> | null } | null;
        }>;
      }
    ): number | null {
      const tokens = response?.choices?.[0]?.logprobs?.content;
      if (!tokens?.length) return null;
      const avg = tokens.reduce((s, t) => s + t.logprob, 0) / tokens.length;
      return Math.max(0, Math.min(1, Math.exp(avg)));
    },

    /**
     * Anthropic does not expose token-level log-probs.
     * Always returns `null` — use a judge-model scorer instead.
     */
    anthropic(_response: unknown): null {
      return null;
    },

    /**
     * Derives confidence from an Amazon Bedrock model response, for the model
     * families that expose token-level data — e.g. Cohere `token_likelihoods`,
     * or any log-prob array you pass through as `logprobs`. Returns `null` when
     * no token signal is present (notably Anthropic Claude on Bedrock, which has
     * no log-probs): omit the signal and let the engine's MissingSignalMode
     * decide rather than fabricating a value.
     *
     * @example
     * ```ts
     * // Cohere Command on Bedrock (InvokeModel response body)
     * const score = LeluClient.confidenceFrom.bedrock(JSON.parse(body)); // null for Claude
     * ```
     */
    bedrock(
      response: {
        generations?: Array<{
          token_likelihoods?: Array<{ likelihood: number }> | null;
        } | null> | null;
        logprobs?: number[];
      }
    ): number | null {
      const logprobs =
        response?.logprobs ??
        response?.generations?.[0]?.token_likelihoods?.map((t) => t.likelihood);
      if (!logprobs?.length) return null;
      const avg = logprobs.reduce((s, lp) => s + lp, 0) / logprobs.length;
      return Math.max(0, Math.min(1, Math.exp(avg)));
    },
  } as const;

  constructor(cfg: ClientConfig = {}) {
    const envBaseUrl =
      typeof process !== "undefined" && process.env
        ? process.env["LELU_BASE_URL"]
        : undefined;

    const defaultUrl = cfg.apiKey ? LeluClient.CLOUD_URL : "http://localhost:8080";

    this.baseUrl = (cfg.baseUrl ?? envBaseUrl ?? defaultUrl).replace(/\/$/, "");
    this.timeoutMs = cfg.timeoutMs ?? 5_000;
    this.apiKey = cfg.apiKey;
  }

  // ── Authorization ──────────────────────────────────────────────────────────

  /**
   * Checks whether an AI agent is permitted to call a tool.
   *
   * @example
   * ```ts
   * const { decision, reason, requestId } = await lelu.authorize({ tool: "send_email" });
   * if (decision === "deny") return `Blocked: ${reason}`;
   * if (decision === "human_review") return `Awaiting approval (id: ${requestId})`;
   * ```
   */
  async authorize(req: AuthorizeRequest): Promise<AuthDecision> {
    const validated = AuthorizeRequestSchema.parse(req);
    const ctx = validated.context;

    const body: Record<string, unknown> = { action: validated.tool };
    if (ctx?.confidence !== undefined) body.confidence = ctx.confidence;
    if (ctx?.actingFor)                body.acting_for = ctx.actingFor;
    if (ctx?.scope)                    body.scope       = ctx.scope;
    if (validated.args)                body.args        = validated.args;

    const data = await this.post<{
      allowed: boolean;
      reason: string;
      trace_id: string;
      requires_human_review: boolean;
      compute?: boolean;
      safe_tool?: string;
      safe_args?: Record<string, unknown>;
      input_hash?: string;
      output_hash?: string;
      policy_digest?: string;
    }>("/v1/agent/authorize", body);

    const decision: "allow" | "deny" | "human_review" | "compute" =
      data.compute              ? "compute"      :
      data.requires_human_review ? "human_review" :
      data.allowed               ? "allow"        :
                                   "deny";

    return {
      requestId: data.trace_id,
      tool:      validated.tool,
      decision,
      reason:    data.reason,
      rule:      "",
      latencyMs: 0,
      mode:      "live",
      timestamp: new Date().toISOString(),
      allowed:   data.allowed,
      computed:  !!data.compute,
      ...(data.safe_tool     !== undefined ? { safeTool:     data.safe_tool     } : {}),
      ...(data.safe_args     !== undefined ? { safeArgs:     data.safe_args     } : {}),
      ...(data.input_hash    !== undefined ? { inputHash:    data.input_hash    } : {}),
      ...(data.output_hash   !== undefined ? { outputHash:   data.output_hash   } : {}),
      ...(data.policy_digest !== undefined ? { policyDigest: data.policy_digest } : {}),
    };
  }

  // ── Agent authorization (backward compat) ──────────────────────────────────

  /**
   * @deprecated Use authorize() instead.
   * Kept for backward compatibility — maps agentAuthorize inputs to authorize().
   */
  async agentAuthorize(req: AgentAuthRequest): Promise<AgentAuthDecision> {
    const validated = AgentAuthRequestSchema.parse(req);

    return await agentTracer.withAgentSpan(
      "ai.agent.authorize",
      {
        agentId: validated.actor,
        action: validated.action,
        ...(validated.context.confidence !== undefined ? { confidence: validated.context.confidence } : {}),
        ...(validated.context.actingFor && { actingFor: validated.context.actingFor }),
        ...(validated.context.scope && { scope: validated.context.scope }),
      },
      async () => {
        const decision = await this.authorize({
          tool: validated.action,
          context: validated.context,
        });
        return {
          ...decision,
          requiresHumanReview: decision.decision === "human_review",
          confidenceUsed: validated.context.confidence ?? 0,
          traceId: decision.requestId,
          downgradedScope: undefined,
        };
      }
    );
  }

  // ── JIT Token minting ──────────────────────────────────────────────────────

  async mintToken(req: MintTokenRequest): Promise<MintTokenResult> {
    const validated = MintTokenRequestSchema.parse(req);
    const body = {
      scope: validated.scope,
      acting_for: validated.actingFor,
      ttl_seconds: validated.ttlSeconds ?? 60,
    };
    const data = await this.post<{
      token: string;
      token_id: string;
      expires_at: number;
    }>("/v1/tokens/mint", body);

    return {
      token: data.token,
      tokenId: data.token_id,
      expiresAt: new Date(data.expires_at * 1000),
    };
  }

  // ── Token revocation ───────────────────────────────────────────────────────

  async revokeToken(tokenId: string): Promise<RevokeTokenResult> {
    const data = await this.delete<{ success: boolean }>(
      `/v1/tokens/${encodeURIComponent(tokenId)}`
    );
    return { success: data.success };
  }

  // ── Multi-agent delegation ─────────────────────────────────────────────────

  async delegateScope(req: DelegateScopeRequest): Promise<DelegateScopeResult> {
    const validated = DelegateScopeRequestSchema.parse(req);

    return await agentTracer.withAgentSpan(
      "ai.agent.delegate",
      {
        agentId: validated.delegator,
        action: "delegate",
        ...(validated.confidence !== undefined && { confidence: validated.confidence }),
        ...(validated.actingFor && { actingFor: validated.actingFor }),
      },
      async () => {
        const body = {
          delegator: validated.delegator,
          delegatee: validated.delegatee,
          scoped_to: validated.scopedTo ?? [],
          ttl_seconds: validated.ttlSeconds ?? 60,
          confidence: validated.confidence ?? 0.0,
          acting_for: validated.actingFor ?? "",
          tenant_id: validated.tenantId ?? "",
        };

        const data = await this.post<{
          token: string;
          token_id: string;
          expires_at: number;
          delegator: string;
          delegatee: string;
          granted_scopes: string[];
          trace_id: string;
        }>("/v1/agent/delegate", body);

        return {
          token: data.token,
          tokenId: data.token_id,
          expiresAt: new Date(data.expires_at * 1000),
          delegator: data.delegator,
          delegatee: data.delegatee,
          grantedScopes: data.granted_scopes,
          traceId: data.trace_id,
        };
      }
    );
  }

  // ── Health check ───────────────────────────────────────────────────────────

  async isHealthy(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await fetch(`${this.baseUrl}/healthz`, {
          method: "GET",
          headers: this.headers(),
          signal: ctrl.signal,
        });
        return res.ok;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return false;
    }
  }

  // ── Shadow mode summary ────────────────────────────────────────────────────

  async getShadowSummary(windowMinutes = 60): Promise<ShadowSummaryResponse> {
    return this.get<ShadowSummaryResponse>(
      `/v1/shadow/summary?window_minutes=${windowMinutes}`
    );
  }

  // ── Human review queue ─────────────────────────────────────────────────────

  async listQueue(): Promise<{ items: ReviewQueueItem[]; count: number }> {
    return this.get<{ items: ReviewQueueItem[]; count: number }>("/v1/queue/pending");
  }

  async getQueueItem(id: string): Promise<ReviewQueueItem> {
    return this.get<ReviewQueueItem>(`/v1/queue/${encodeURIComponent(id)}`);
  }

  async approveQueueItem(id: string, resolvedBy: string, note = ""): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>(
      `/v1/queue/${encodeURIComponent(id)}/approve`,
      { resolved_by: resolvedBy, note }
    );
  }

  async denyQueueItem(id: string, resolvedBy: string, note = ""): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>(
      `/v1/queue/${encodeURIComponent(id)}/deny`,
      { resolved_by: resolvedBy, note }
    );
  }

  /**
   * Blocks until a human-review request is resolved (approved or denied) or the
   * caller's timeout elapses. Re-polls the server automatically — callers may
   * pass any `timeoutMs` regardless of the server-side 60 s cap per long-poll.
   *
   * Returns the item with `status === "approved" | "denied"` on resolution, or
   * with `status === "pending"` when the caller's deadline passes first.
   *
   * @example
   * ```ts
   * const { decision, requestId } = await lelu.authorize({ tool: "wire_transfer" });
   * if (decision === "human_review") {
   *   const item = await lelu.waitForApproval(requestId, { timeoutMs: 5 * 60_000 });
   *   if (item.status !== "approved") throw new Error("Not approved");
   * }
   * ```
   */
  async waitForApproval(
    requestId: string,
    opts?: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<ReviewQueueItem> {
    // Server caps each individual long-poll at 60 s. We loop, issuing back-to-back
    // long-polls with ≤30 s each (plus ≤2 s jitter to stagger reconnects), until
    // the item resolves or the caller's deadline passes.
    const POLL_CAP_MS = 30_000;
    const totalMs = opts?.timeoutMs ?? 30_000;
    const deadline = Date.now() + totalMs;

    const ctrl = new AbortController();
    // Hard abort at deadline + 5 s network headroom.
    const hardTimer = setTimeout(() => ctrl.abort(), totalMs + 5_000);
    opts?.signal?.addEventListener("abort", () => ctrl.abort(), { once: true });

    try {
      while (true) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          // Deadline passed — one quick point-in-time GET to return current state.
          return this.get<ReviewQueueItem>(`/v1/queue/${encodeURIComponent(requestId)}`);
        }

        // Add up to 2 s jitter; cap each poll at 30 s or the remaining window.
        const jitter = Math.floor(Math.random() * 2_000);
        const pollMs = Math.min(remaining + jitter, POLL_CAP_MS);
        const params = new URLSearchParams({ timeout_ms: pollMs.toString() });

        const res = await fetch(
          `${this.baseUrl}/v1/queue/${encodeURIComponent(requestId)}/wait?${params}`,
          { method: "GET", headers: this.headers(), signal: ctrl.signal }
        );

        // parseResponse handles 408 (still pending) the same as 200 here.
        const item = await this.parseResponse<ReviewQueueItem>(res);
        if (item.status !== "pending") return item;
        // Still pending — loop and issue the next long-poll.
      }
    } finally {
      clearTimeout(hardTimer);
    }
  }

  /**
   * Scans tool output for indirect prompt-injection attempts before the agent
   * acts on the result. Returns { safe: true } when clean.
   *
   * @example
   * ```ts
   * const raw = await callExternalTool();
   * const scan = await lelu.scanToolResult(raw);
   * if (!scan.safe) throw new Error(`Injection detected: ${scan.pattern}`);
   * ```
   */
  async scanToolResult(
    output: string,
    meta?: { actor?: string; action?: string; resource?: Record<string, string> }
  ): Promise<ToolOutputScanResult> {
    return this.post<ToolOutputScanResult>("/v1/scan/output", {
      output,
      ...(meta?.actor    !== undefined ? { actor:    meta.actor    } : {}),
      ...(meta?.action   !== undefined ? { action:   meta.action   } : {}),
      ...(meta?.resource !== undefined ? { resource: meta.resource } : {}),
    });
  }

  // ── Policy simulator ───────────────────────────────────────────────────────

  async simulatorReplay(req: SimulatorReplayRequest): Promise<SimulatorReplayResponse> {
    return this.post<SimulatorReplayResponse>("/v1/simulator/replay", req);
  }

  // ── Fallback status ────────────────────────────────────────────────────────

  async getFallbackStatus(): Promise<{ status: string }> {
    return this.get<{ status: string }>("/v1/fallback/status");
  }

  // ── Audit log (platform API — only available via lelu-ai.com) ─────────────

  async listAuditEvents(req: ListAuditEventsRequest = {}): Promise<ListAuditEventsResult> {
    const params = new URLSearchParams();
    if (req.limit !== undefined) params.set("limit", req.limit.toString());
    if (req.cursor !== undefined) params.set("cursor", req.cursor.toString());
    if (req.actor) params.set("actor", req.actor);
    if (req.action) params.set("action", req.action);
    if (req.decision) params.set("decision", req.decision);
    if (req.traceId) params.set("trace_id", req.traceId);
    if (req.from) params.set("from", req.from);
    if (req.to) params.set("to", req.to);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const url = `${this.baseUrl}/api/v1/audit${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { method: "GET", headers: this.headers(), signal: ctrl.signal });

      const data = await this.parseResponse<{
        events: AuditEvent[];
        count: number;
        limit: number;
        cursor: number;
        next_cursor: number;
      }>(res);

      return {
        events: data.events || [],
        count: data.count,
        limit: data.limit,
        cursor: data.cursor,
        nextCursor: data.next_cursor,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Policy management (platform API — only available via lelu-ai.com) ──────

  async listPolicies(_req: ListPoliciesRequest = {}): Promise<ListPoliciesResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/policies`, {
        method: "GET",
        headers: this.headers(),
        signal: ctrl.signal,
      });
      const data = await this.parseResponse<{ policies: Policy[]; count: number }>(res);
      return { policies: data.policies || [], count: data.count };
    } finally {
      clearTimeout(timer);
    }
  }

  async getPolicy(req: GetPolicyRequest): Promise<Policy> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/policies/${encodeURIComponent(req.id)}`, {
        method: "GET",
        headers: this.headers(),
        signal: ctrl.signal,
      });
      const data = await this.parseResponse<{ policy: Policy }>(res);
      return data.policy;
    } finally {
      clearTimeout(timer);
    }
  }

  async upsertPolicy(req: UpsertPolicyRequest): Promise<Policy> {
    const body = {
      name: req.name,
      description: req.description ?? "",
      rules: req.rules,
      isActive: req.isActive ?? true,
    };
    const data = await this.post<{ policy: Policy }>("/api/policies", body);
    return data.policy;
  }

  async deletePolicy(req: DeletePolicyRequest): Promise<DeletePolicyResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/policies/${encodeURIComponent(req.id)}`, {
        method: "DELETE",
        headers: this.headers(),
        signal: ctrl.signal,
      });
      return await this.parseResponse<DeletePolicyResult>(res);
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Phase 2: Behavioral Analytics ─────────────────────────────────────────

  async getAgentReputation(agentId: string): Promise<AgentReputation> {
    return await this.get<AgentReputation>(`/v1/analytics/reputation/${encodeURIComponent(agentId)}`);
  }

  async listAgentReputations(options: {
    sort: "top" | "problematic";
    limit?: number;
    threshold?: number;
  }): Promise<ReputationListResponse> {
    const params = new URLSearchParams();
    params.set("sort", options.sort);
    if (options.limit) params.set("limit", options.limit.toString());
    if (options.threshold) params.set("threshold", options.threshold.toString());
    return await this.get<ReputationListResponse>(`/v1/analytics/reputation?${params.toString()}`);
  }

  async getAgentAnomalies(agentId: string, since?: Date): Promise<AnomaliesResponse> {
    const params = new URLSearchParams();
    if (since) params.set("since", since.toISOString());
    const path = `/v1/analytics/anomalies/${encodeURIComponent(agentId)}${params.toString() ? `?${params.toString()}` : ""}`;
    return await this.get<AnomaliesResponse>(path);
  }

  async getAgentBaseline(agentId: string): Promise<BaselineResponse> {
    return await this.get<BaselineResponse>(`/v1/analytics/baseline/${encodeURIComponent(agentId)}`);
  }

  async refreshAgentBaseline(agentId: string): Promise<{ agent_id: string; status: string }> {
    return await this.post<{ agent_id: string; status: string }>(
      `/v1/analytics/baseline/${encodeURIComponent(agentId)}/refresh`,
      {}
    );
  }

  async getAlerts(agentId?: string): Promise<AlertsResponse> {
    const params = new URLSearchParams();
    if (agentId) params.set("agent_id", agentId);
    const path = `/v1/analytics/alerts${params.toString() ? `?${params.toString()}` : ""}`;
    return await this.get<AlertsResponse>(path);
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<{ alert_id: string; status: string }> {
    const body: AcknowledgeAlertRequest = { acknowledged_by: acknowledgedBy };
    return await this.post<{ alert_id: string; status: string }>(
      `/v1/analytics/alerts/${encodeURIComponent(alertId)}/acknowledge`,
      body
    );
  }

  async resolveAlert(alertId: string): Promise<{ alert_id: string; status: string }> {
    return await this.post<{ alert_id: string; status: string }>(
      `/v1/analytics/alerts/${encodeURIComponent(alertId)}/resolve`,
      {}
    );
  }

  // ── OAuth Token Vault ──────────────────────────────────────────────────────

  /**
   * Stores an OAuth credential (access token + optional refresh token) in the
   * encrypted vault, bound to the given agent and user.
   */
  async vaultStore(req: VaultStoreRequest): Promise<VaultStoreResult> {
    const body: Record<string, unknown> = {
      agent_id: req.agentId,
      user_id: req.userId,
      provider: req.provider,
      access_token: req.accessToken,
    };
    if (req.refreshToken) body.refresh_token = req.refreshToken;
    if (req.scopes?.length) body.scopes = req.scopes;
    if (req.expiresIn) body.expires_in = req.expiresIn;
    const d = await this.post<{
      id: string; agent_id: string; user_id: string; provider: string;
      scopes: string[]; expires_at: string; created_at: string;
    }>("/v1/vault/store", body);
    return { id: d.id, agentId: d.agent_id, userId: d.user_id, provider: d.provider,
      scopes: d.scopes, expiresAt: d.expires_at, createdAt: d.created_at };
  }

  /**
   * Retrieves a stored access token for (agentId, userId, provider).
   * The vault transparently refreshes expiring tokens when a refresh token
   * and provider config are available.
   */
  async vaultGetToken(agentId: string, userId: string, provider: string): Promise<VaultTokenResult> {
    const params = new URLSearchParams({ agent_id: agentId, user_id: userId, provider });
    const d = await this.get<{
      agent_id: string; user_id: string; provider: string; access_token: string;
      scopes: string[]; expires_at: string; refreshed: boolean;
    }>(`/v1/vault/token?${params}`);
    return { agentId: d.agent_id, userId: d.user_id, provider: d.provider,
      accessToken: d.access_token, scopes: d.scopes, expiresAt: d.expires_at,
      refreshed: d.refreshed };
  }

  /**
   * Revokes and deletes a stored credential for (agentId, userId, provider).
   */
  async vaultRevoke(agentId: string, userId: string, provider: string): Promise<{ success: boolean }> {
    const params = new URLSearchParams({ agent_id: agentId, user_id: userId, provider });
    return await this.delete<{ success: boolean }>(`/v1/vault/credential?${params}`);
  }

  /**
   * Lists all stored credential summaries (no tokens exposed) for an agent.
   */
  async vaultList(agentId: string): Promise<VaultCredentialSummary[]> {
    const d = await this.get<{
      credentials: Array<{
        id: string; agent_id: string; user_id: string; provider: string;
        scopes: string[]; expires_at?: string; expired: boolean;
        created_at: string; updated_at: string;
      }>
    }>(`/v1/vault/list?agent_id=${encodeURIComponent(agentId)}`);
    return (d.credentials ?? []).map(c => ({
      id: c.id, agentId: c.agent_id, userId: c.user_id, provider: c.provider,
      scopes: c.scopes, expiresAt: c.expires_at, expired: c.expired,
      createdAt: c.created_at, updatedAt: c.updated_at,
    }));
  }

  /**
   * Returns the names of all OAuth providers configured in the engine vault.
   */
  async vaultProviders(): Promise<string[]> {
    const d = await this.get<{ providers: string[] }>("/v1/vault/providers");
    return d.providers ?? [];
  }

  // ── Agent Identity Registry ────────────────────────────────────────────────

  /**
   * Registers a new agent identity in Lelu's durable registry.
   * The returned `id` is stable across deployments and API key rotations.
   */
  async registerAgent(req: RegisterAgentRequest): Promise<RegisteredAgent> {
    const body: Record<string, unknown> = { name: req.name };
    if (req.description !== undefined) body.description = req.description;
    if (req.agentType !== undefined) body.agent_type = req.agentType;
    if (req.ownerEmail !== undefined) body.owner_email = req.ownerEmail;
    if (req.scopes !== undefined) body.scopes = req.scopes;
    if (req.metadata !== undefined) body.metadata = req.metadata;
    return this.post<RegisteredAgent>("/v1/agents", body);
  }

  /** Lists all registered agents, optionally filtered by tenant. */
  async listAgents(tenantId?: string): Promise<ListAgentsResult> {
    const path = tenantId
      ? `/v1/agents?tenant_id=${encodeURIComponent(tenantId)}`
      : "/v1/agents";
    return this.get<ListAgentsResult>(path);
  }

  /** Gets a single registered agent by its stable ID. */
  async getAgent(agentId: string): Promise<RegisteredAgent> {
    return this.get<RegisteredAgent>(`/v1/agents/${encodeURIComponent(agentId)}`);
  }

  /**
   * Permanently revokes an agent identity — all future token issuances for
   * this agent will be rejected.
   */
  async revokeAgent(agentId: string): Promise<AgentStatusResult> {
    const d = await this.delete<{ agent_id: string; status: string }>(
      `/v1/agents/${encodeURIComponent(agentId)}`
    );
    return { agentId: d.agent_id, status: d.status as "revoked" };
  }

  /** Suspends an agent (reversible; use revokeAgent for permanent revocation). */
  async suspendAgent(agentId: string): Promise<AgentStatusResult> {
    const d = await this.post<{ agent_id: string; status: string }>(
      `/v1/agents/${encodeURIComponent(agentId)}/suspend`,
      {}
    );
    return { agentId: d.agent_id, status: d.status as "suspended" };
  }

  /**
   * Issues a short-lived OIDC-compatible RS256 JWT for a registered agent.
   * Third-party services can verify it offline via `/.well-known/jwks.json`.
   */
  async issueAgentToken(agentId: string): Promise<AgentWorkloadToken> {
    const d = await this.post<{
      token: string;
      agent_id: string;
      scopes: string[];
      expires_at: string;
      issued_at: string;
    }>(`/v1/agents/${encodeURIComponent(agentId)}/token`, {});
    return {
      token: d.token,
      agentId: d.agent_id,
      scopes: d.scopes,
      expiresAt: d.expires_at,
      issuedAt: d.issued_at,
    };
  }

  // ── MCP OAuth 2.1 ─────────────────────────────────────────────────────────

  /**
   * Dynamically registers an OAuth 2.1 client with Lelu's MCP authorization
   * server (RFC 7591). Returns client credentials for use in the token flow.
   */
  async registerOAuthClient(req: RegisterOAuthClientRequest): Promise<OAuthClient> {
    const body: Record<string, unknown> = {};
    if (req.clientName !== undefined) body.client_name = req.clientName;
    if (req.redirectUris !== undefined) body.redirect_uris = req.redirectUris;
    if (req.grantTypes !== undefined) body.grant_types = req.grantTypes;
    if (req.scope !== undefined) body.scope = req.scope;
    if (req.tokenEndpointAuthMethod !== undefined)
      body.token_endpoint_auth_method = req.tokenEndpointAuthMethod;

    const d = await this.post<{
      client_id: string;
      client_secret?: string;
      client_name: string;
      redirect_uris: string[];
      grant_types: string[];
      scope: string;
      token_endpoint_auth_method: string;
      client_id_issued_at: number;
    }>("/oauth/clients", body);

    return {
      clientId: d.client_id,
      clientSecret: d.client_secret,
      clientName: d.client_name,
      redirectUris: d.redirect_uris,
      grantTypes: d.grant_types,
      scope: d.scope,
      tokenEndpointAuthMethod: d.token_endpoint_auth_method,
      clientIdIssuedAt: d.client_id_issued_at,
    };
  }

  // ── NHI Discovery + ISPM ──────────────────────────────────────────────────

  /**
   * Returns all non-human identities (registered agents, shadow agents, OAuth
   * credentials) with OWASP NHI risk findings and scores, sorted by risk desc.
   */
  async listNHI(tenantId?: string): Promise<NHIListResult> {
    const path = tenantId
      ? `/v1/nhi/inventory?tenant_id=${encodeURIComponent(tenantId)}`
      : "/v1/nhi/inventory";
    const d = await this.get<{ nhis: NHIEntry[]; count: number }>(path);
    return { nhis: d.nhis ?? [], count: d.count };
  }

  /** Returns a single NHI by ID with full OWASP findings and remediation. */
  async getNHI(id: string): Promise<NHIEntry> {
    return this.get<NHIEntry>(`/v1/nhi/inventory/${encodeURIComponent(id)}`);
  }

  /** Returns the top-N highest-risk NHIs (default 10). */
  async getTopRisks(options: { tenantId?: string; limit?: number } = {}): Promise<NHITopRisksResult> {
    const params = new URLSearchParams();
    if (options.tenantId) params.set("tenant_id", options.tenantId);
    if (options.limit) params.set("limit", String(options.limit));
    const path = `/v1/nhi/risks${params.size ? "?" + params.toString() : ""}`;
    const d = await this.get<{ top_risks: NHIEntry[]; count: number }>(path);
    return { topRisks: d.top_risks ?? [], count: d.count };
  }

  /**
   * Triggers a full NHI scan across all data sources for a tenant.
   * Returns aggregate counts by type, status, risk level, and top risks.
   */
  async triggerNHIScan(tenantId?: string): Promise<NHIScanResult> {
    const path = tenantId
      ? `/v1/nhi/scan?tenant_id=${encodeURIComponent(tenantId)}`
      : "/v1/nhi/scan";
    const d = await this.post<{
      tenant_id: string;
      scanned_at: string;
      total_nhis: number;
      by_type: Record<string, number>;
      by_status: Record<string, number>;
      by_risk_level: Record<string, number>;
      top_risks: NHIEntry[];
      finding_counts: Record<string, number>;
    }>(path, {});
    return {
      tenantId: d.tenant_id,
      scannedAt: d.scanned_at,
      totalNhis: d.total_nhis,
      byType: d.by_type,
      byStatus: d.by_status,
      byRiskLevel: d.by_risk_level,
      topRisks: d.top_risks ?? [],
      findingCounts: d.finding_counts,
    };
  }

  /** Returns lightweight aggregate NHI counts without running full checks. */
  async getNHIStats(tenantId?: string): Promise<NHIStats> {
    const path = tenantId
      ? `/v1/nhi/stats?tenant_id=${encodeURIComponent(tenantId)}`
      : "/v1/nhi/stats";
    const d = await this.get<{
      tenant_id: string;
      total_nhis: number;
      by_type: Record<string, number>;
      by_status: Record<string, number>;
      by_risk_level: Record<string, number>;
      generated_at: string;
    }>(path);
    return {
      tenantId: d.tenant_id,
      totalNhis: d.total_nhis,
      byType: d.by_type,
      byStatus: d.by_status,
      byRiskLevel: d.by_risk_level,
      generatedAt: d.generated_at,
    };
  }

  // ── HTTP helpers ───────────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h["Authorization"] = `Bearer ${this.apiKey}`;
    return h;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      return this.parseResponse<T>(res);
    } finally {
      clearTimeout(timer);
    }
  }

  private async delete<T>(path: string): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "DELETE",
        headers: this.headers(),
        signal: ctrl.signal,
      });
      return this.parseResponse<T>(res);
    } finally {
      clearTimeout(timer);
    }
  }

  private async get<T>(path: string): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: this.headers(),
        signal: ctrl.signal,
      });
      return this.parseResponse<T>(res);
    } finally {
      clearTimeout(timer);
    }
  }

  private async parseResponse<T>(res: Response): Promise<T> {
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new AuthEngineError(
        (json["error"] as string) ?? "engine error",
        res.status,
        json
      );
    }
    return json as T;
  }
}
