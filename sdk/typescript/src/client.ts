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
    const body: Record<string, unknown> = { tool: validated.tool };
    if (validated.context) body.context = validated.context;
    if (validated.args) body.args = validated.args;

    const data = await this.post<{
      requestId: string;
      tool: string;
      decision: "allow" | "deny" | "human_review";
      reason: string;
      rule: string;
      policyName?: string;
      latencyMs: number;
      mode: string;
      keyId?: string;
      timestamp: string;
    }>("/api/v1/authorize", body);

    return {
      requestId: data.requestId,
      tool: data.tool,
      decision: data.decision,
      reason: data.reason,
      rule: data.rule,
      ...(data.policyName !== undefined ? { policyName: data.policyName } : {}),
      latencyMs: data.latencyMs,
      mode: data.mode as "live" | "sandbox",
      ...(data.keyId !== undefined ? { keyId: data.keyId } : {}),
      timestamp: data.timestamp,
      allowed: data.decision === "allow",
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
        confidence: validated.context.confidence,
        ...(validated.context.actingFor && { actingFor: validated.context.actingFor }),
        ...(validated.context.scope && { scope: validated.context.scope }),
      },
      async () => {
        const decision = await this.authorize({ tool: validated.action });
        return {
          ...decision,
          requiresHumanReview: decision.decision === "human_review",
          confidenceUsed: validated.context.confidence,
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
          confidence: validated.confidence ?? 1.0,
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
        const res = await fetch(`${this.baseUrl}/api/config-check`, {
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

  // ── Audit log ──────────────────────────────────────────────────────────────

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

  // ── Policy management ──────────────────────────────────────────────────────

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
