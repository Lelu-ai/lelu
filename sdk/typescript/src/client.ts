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
  // Phase 2: Behavioral Analytics Types
  type AgentReputation,
  type AnomalyResult,
  type BaselineHealth,
  type DriftAnalysis,
  type Alert,
  type ReputationListResponse,
  type AnomaliesResponse,
  type BaselineResponse,
  type AlertsResponse,
  type AcknowledgeAlertRequest,
} from "./types.js";
import { agentTracer, type DecisionMetrics, type LatencyMetrics } from "./observability/tracer.js";

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
   * 
   * Enhanced with Phase 1 observability features.
   */
  async agentAuthorize(req: AgentAuthRequest): Promise<AgentAuthDecision> {
    const validated = AgentAuthRequestSchema.parse(req);
    
    // Start enhanced tracing span
    return await agentTracer.withAgentSpan(
      'ai.agent.authorize',
      {
        agentId: validated.actor,
        action: validated.action,
        confidence: validated.context.confidence,
        ...(validated.context.actingFor && { actingFor: validated.context.actingFor }),
        ...(validated.context.scope && { scope: validated.context.scope }),
      },
      async (span) => {
        const startTime = Date.now();
        
        const body = {
          actor: validated.actor,
          action: validated.action,
          resource: validated.resource,
          confidence: validated.context.confidence,
          acting_for: validated.context.actingFor,
          scope: validated.context.scope,
        };
        
        try {
          const data = await this.post<{
            allowed: boolean;
            reason: string;
            trace_id: string;
            downgraded_scope?: string;
            requires_human_review: boolean;
            confidence_used: number;
            risk_score?: number;
          }>("/v1/agent/authorize", body);

          const totalLatency = Date.now() - startTime;
          
          // Record decision metrics
          const decisionMetrics: DecisionMetrics = {
            allowed: data.allowed,
            requiresHumanReview: data.requires_human_review,
            confidence: data.confidence_used,
            riskScore: data.risk_score || 0,
            outcome: data.requires_human_review ? 'review' : data.allowed ? 'allowed' : 'denied',
          };
          
          const latencyMetrics: LatencyMetrics = {
            totalMs: totalLatency,
          };
          
          agentTracer.recordDecision(span, decisionMetrics);
          agentTracer.recordLatency(span, latencyMetrics);
          
          // Add trace ID to span
          span.setAttributes({
            'lelu.trace_id': data.trace_id,
            'lelu.engine_decision': data.allowed,
            'lelu.downgraded_scope': data.downgraded_scope || '',
          });

          return {
            allowed: data.allowed,
            reason: data.reason,
            traceId: data.trace_id,
            downgradedScope: data.downgraded_scope,
            requiresHumanReview: data.requires_human_review,
            confidenceUsed: data.confidence_used,
          };
        } catch (error) {
          // Record error in span
          span.recordException(error as Error);
          throw error;
        }
      }
    );
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
   * 
   * Enhanced with Phase 1 observability features.
   */
  async delegateScope(req: DelegateScopeRequest): Promise<DelegateScopeResult> {
    const validated = DelegateScopeRequestSchema.parse(req);
    
    // Start enhanced delegation tracing span
    return await agentTracer.withAgentSpan(
      'ai.agent.delegate',
      {
        agentId: validated.delegator,
        action: 'delegate',
        ...(validated.confidence !== undefined && { confidence: validated.confidence }),
        ...(validated.actingFor && { actingFor: validated.actingFor }),
      },
      async (span) => {
        const startTime = Date.now();
        
        // Add delegation-specific attributes
        agentTracer.injectCorrelationContext(span, `${validated.delegator}→${validated.delegatee}`);
        span.setAttributes({
          'ai.parent.agent': validated.delegator,
          'ai.child.agent': validated.delegatee,
          'ai.delegation.scoped_to': validated.scopedTo?.join(',') || '',
          'ai.delegation.ttl_seconds': validated.ttlSeconds || 60,
        });
        
        const body = {
          delegator: validated.delegator,
          delegatee: validated.delegatee,
          scoped_to: validated.scopedTo ?? [],
          ttl_seconds: validated.ttlSeconds ?? 60,
          confidence: validated.confidence ?? 1.0,
          acting_for: validated.actingFor ?? "",
          tenant_id: validated.tenantId ?? "",
        };
        
        try {
          const data = await this.post<{
            token: string;
            token_id: string;
            expires_at: number;
            delegator: string;
            delegatee: string;
            granted_scopes: string[];
            trace_id: string;
          }>("/v1/agent/delegate", body);

          const totalLatency = Date.now() - startTime;
          
          // Record successful delegation metrics
          const decisionMetrics: DecisionMetrics = {
            allowed: true,
            requiresHumanReview: false,
            confidence: validated.confidence ?? 1.0,
            riskScore: 0,
            outcome: 'delegation_allowed',
          };
          
          const latencyMetrics: LatencyMetrics = {
            totalMs: totalLatency,
          };
          
          agentTracer.recordDecision(span, decisionMetrics);
          agentTracer.recordLatency(span, latencyMetrics);
          
          // Add delegation result attributes
          span.setAttributes({
            'lelu.trace_id': data.trace_id,
            'lelu.token_id': data.token_id,
            'lelu.granted_scopes': data.granted_scopes.join(','),
            'lelu.delegation_success': true,
          });

          return {
            token: data.token,
            tokenId: data.token_id,
            expiresAt: new Date(data.expires_at * 1000),
            delegator: data.delegator,
            delegatee: data.delegatee,
            grantedScopes: data.granted_scopes,
            traceId: data.trace_id,
          };
        } catch (error) {
          // Record delegation failure
          const decisionMetrics: DecisionMetrics = {
            allowed: false,
            requiresHumanReview: false,
            confidence: validated.confidence ?? 1.0,
            riskScore: 1.0,
            outcome: 'delegation_denied',
          };
          
          agentTracer.recordDecision(span, decisionMetrics);
          span.setAttributes({
            'lelu.delegation_success': false,
            'lelu.delegation_error': (error as Error).message,
          });
          
          throw error;
        }
      }
    );
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

  // ─── Phase 2: Behavioral Analytics ─────────────────────────────────────────

  /**
   * Gets reputation information for a specific agent.
   */
  async getAgentReputation(agentId: string): Promise<AgentReputation> {
    return await this.get<AgentReputation>(`/v1/analytics/reputation/${encodeURIComponent(agentId)}`);
  }

  /**
   * Lists agent reputations sorted by performance.
   */
  async listAgentReputations(options: {
    sort: 'top' | 'problematic';
    limit?: number;
    threshold?: number;
  }): Promise<ReputationListResponse> {
    const params = new URLSearchParams();
    params.set('sort', options.sort);
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.threshold) params.set('threshold', options.threshold.toString());
    
    return await this.get<ReputationListResponse>(`/v1/analytics/reputation?${params.toString()}`);
  }

  /**
   * Gets recent anomalies for a specific agent.
   */
  async getAgentAnomalies(agentId: string, since?: Date): Promise<AnomaliesResponse> {
    const params = new URLSearchParams();
    if (since) params.set('since', since.toISOString());
    
    const path = `/v1/analytics/anomalies/${encodeURIComponent(agentId)}${params.toString() ? `?${params.toString()}` : ''}`;
    return await this.get<AnomaliesResponse>(path);
  }

  /**
   * Gets behavioral baseline information for a specific agent.
   */
  async getAgentBaseline(agentId: string): Promise<BaselineResponse> {
    return await this.get<BaselineResponse>(`/v1/analytics/baseline/${encodeURIComponent(agentId)}`);
  }

  /**
   * Triggers a baseline refresh for a specific agent.
   */
  async refreshAgentBaseline(agentId: string): Promise<{ agent_id: string; status: string }> {
    return await this.post<{ agent_id: string; status: string }>(`/v1/analytics/baseline/${encodeURIComponent(agentId)}/refresh`, {});
  }

  /**
   * Gets active alerts, optionally filtered by agent.
   */
  async getAlerts(agentId?: string): Promise<AlertsResponse> {
    const params = new URLSearchParams();
    if (agentId) params.set('agent_id', agentId);
    
    const path = `/v1/analytics/alerts${params.toString() ? `?${params.toString()}` : ''}`;
    return await this.get<AlertsResponse>(path);
  }

  /**
   * Acknowledges an alert.
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<{ alert_id: string; status: string }> {
    const body: AcknowledgeAlertRequest = { acknowledged_by: acknowledgedBy };
    return await this.post<{ alert_id: string; status: string }>(`/v1/analytics/alerts/${encodeURIComponent(alertId)}/acknowledge`, body);
  }

  /**
   * Resolves an alert.
   */
  async resolveAlert(alertId: string): Promise<{ alert_id: string; status: string }> {
    return await this.post<{ alert_id: string; status: string }>(`/v1/analytics/alerts/${encodeURIComponent(alertId)}/resolve`, {});
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
