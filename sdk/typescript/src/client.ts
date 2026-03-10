import {
  AuthEngineError,
  AuthRequestSchema,
  AgentAuthRequestSchema,
  MintTokenRequestSchema,
  DelegateScopeRequestSchema,
  type AuthDecision,
  type AgentAuthDecision,
  type MintTokenResult,
  type DelegateScopeResult,
  type DelegateScopeRequest,
  type RevokeTokenResult,
  type AuthRequest,
  type AgentAuthRequest,
  type MintTokenRequest,
  type ClientConfig,
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
} from "./types.js";

// ─── Client ───────────────────────────────────────────────────────────────────

/**
 * LeluClient is the core SDK entry-point. It communicates with the local
 * Auth Permission Engine sidecar over HTTP/JSON.
 *
 * @example
 * ```ts
 * const lelu = new LeluClient({ baseUrl: "http://localhost:8080" });
 *
 * const decision = await lelu.agentAuthorize({
 *   actor: "invoice_bot",
 *   action: "approve_refunds",
 *   context: { confidence: 0.92, actingFor: "user_123" },
 * });
 *
 * if (!decision.allowed) {
 *   console.log(decision.reason);
 * }
 * ```
 */
export class LeluClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly apiKey: string | undefined;

  constructor(cfg: ClientConfig = {}) {
    const envBaseUrl =
      typeof process !== "undefined" && process.env
        ? process.env["LELU_BASE_URL"]
        : undefined;
    this.baseUrl = (cfg.baseUrl ?? envBaseUrl ?? "http://localhost:8080").replace(/\/$/, "");
    this.timeoutMs = cfg.timeoutMs ?? 5_000;
    this.apiKey = cfg.apiKey;
  }

  // ── Human authorization ────────────────────────────────────────────────────

  /**
   * Checks whether a human user is permitted to perform an action.
   */
  async authorize(req: AuthRequest): Promise<AuthDecision> {
    const validated = AuthRequestSchema.parse(req);
    const body = {
      user_id: validated.userId,
      action: validated.action,
      resource: validated.resource,
    };
    const data = await this.post<{
      allowed: boolean;
      reason: string;
      trace_id: string;
    }>("/v1/authorize", body);

    return {
      allowed: data.allowed,
      reason: data.reason,
      traceId: data.trace_id,
    };
  }

  // ── Agent authorization ────────────────────────────────────────────────────

  /**
   * Checks whether an AI agent is permitted to perform an action, taking the
   * confidence score into account (Confidence-Aware Auth ★).
   */
  async agentAuthorize(req: AgentAuthRequest): Promise<AgentAuthDecision> {
    const validated = AgentAuthRequestSchema.parse(req);
    const body = {
      actor: validated.actor,
      action: validated.action,
      resource: validated.resource,
      confidence: validated.context.confidence,
      acting_for: validated.context.actingFor,
      scope: validated.context.scope,
    };
    const data = await this.post<{
      allowed: boolean;
      reason: string;
      trace_id: string;
      downgraded_scope?: string;
      requires_human_review: boolean;
      confidence_used: number;
    }>("/v1/agent/authorize", body);

    return {
      allowed: data.allowed,
      reason: data.reason,
      traceId: data.trace_id,
      downgradedScope: data.downgraded_scope,
      requiresHumanReview: data.requires_human_review,
      confidenceUsed: data.confidence_used,
    };
  }

  // ── JIT Token minting ──────────────────────────────────────────────────────

  /**
   * Mints a scoped JWT for an agent with an optional TTL.
   * Default TTL is 60 seconds.
   */
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

  /**
   * Immediately revokes a JIT token by its ID.
   */
  async revokeToken(tokenId: string): Promise<RevokeTokenResult> {
    const data = await this.delete<{ success: boolean }>(
      `/v1/tokens/${encodeURIComponent(tokenId)}`
    );
    return { success: data.success };
  }

  // ── Multi-agent delegation ─────────────────────────────────────────────────

  /**
   * Delegates a constrained sub-scope from one agent to another.
   *
   * Validates the delegation rule in the loaded policy, caps the TTL to the
   * policy maximum, and mints a child JIT token scoped to the granted actions.
   *
   * The delegator's `confidence` score is checked against the policy's
   * `require_confidence_above` before delegation is granted.
   */
  async delegateScope(req: DelegateScopeRequest): Promise<DelegateScopeResult> {
    const validated = DelegateScopeRequestSchema.parse(req);
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

  // ── Health check ───────────────────────────────────────────────────────────

  /**
   * Returns true if the engine is reachable and healthy.
   */
  async isHealthy(): Promise<boolean> {
    try {
      const data = await this.get<{ status: string }>("/healthz");
      return data.status === "ok";
    } catch {
      return false;
    }
  }

  // ── Audit log ──────────────────────────────────────────────────────────────

  /**
   * Lists audit events from the platform API.
   * Requires the platform service to be running (not just the engine).
   */
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

    const headers = this.headers();
    if (req.tenantId) {
      headers["X-Tenant-ID"] = req.tenantId;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const url = `${this.baseUrl}/api/v1/audit${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: ctrl.signal,
      });
      
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

  // ─── Policy Management ────────────────────────────────────────────────────────

  async listPolicies(req: ListPoliciesRequest = {}): Promise<ListPoliciesResult> {
    const headers = this.headers();
    if (req.tenantId) {
      headers["X-Tenant-ID"] = req.tenantId;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/policies`, {
        method: "GET",
        headers,
        signal: ctrl.signal,
      });
      
      const data = await this.parseResponse<{
        policies: Policy[];
        count: number;
      }>(res);

      return {
        policies: data.policies || [],
        count: data.count,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async getPolicy(req: GetPolicyRequest): Promise<Policy> {
    const headers = this.headers();
    if (req.tenantId) {
      headers["X-Tenant-ID"] = req.tenantId;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/policies/${encodeURIComponent(req.name)}`, {
        method: "GET",
        headers,
        signal: ctrl.signal,
      });
      
      return await this.parseResponse<Policy>(res);
    } finally {
      clearTimeout(timer);
    }
  }

  async upsertPolicy(req: UpsertPolicyRequest): Promise<Policy> {
    const headers = this.headers();
    if (req.tenantId) {
      headers["X-Tenant-ID"] = req.tenantId;
    }

    const body = {
      content: req.content,
      version: req.version || "1.0"
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/policies/${encodeURIComponent(req.name)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      
      return await this.parseResponse<Policy>(res);
    } finally {
      clearTimeout(timer);
    }
  }

  async deletePolicy(req: DeletePolicyRequest): Promise<DeletePolicyResult> {
    const headers = this.headers();
    if (req.tenantId) {
      headers["X-Tenant-ID"] = req.tenantId;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/policies/${encodeURIComponent(req.name)}`, {
        method: "DELETE",
        headers,
        signal: ctrl.signal,
      });
      
      return await this.parseResponse<DeletePolicyResult>(res);
    } finally {
      clearTimeout(timer);
    }
  }

  // ── HTTP helpers ───────────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      h["Authorization"] = `Bearer ${this.apiKey}`;
    }
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
