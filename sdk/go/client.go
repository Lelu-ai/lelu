package lelu

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// LeluCloudURL is the default Lelu cloud endpoint.
const LeluCloudURL = "https://lelu-ai.com"

// ClientConfig configures the Lelu client.
type ClientConfig struct {
	BaseURL    string
	APIKey     string
	Timeout    time.Duration
	HTTPClient *http.Client
}

// Client is the Go SDK entry-point for the Lelu Auth Engine.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewClient constructs a new Lelu SDK client.
func NewClient(cfg ClientConfig) *Client {
	defaultURL := "http://localhost:8080"
	if cfg.APIKey != "" {
		defaultURL = LeluCloudURL
	}

	baseURL := strings.TrimSuffix(cfg.BaseURL, "/")
	if baseURL == "" {
		baseURL = defaultURL
	}

	hc := cfg.HTTPClient
	if hc == nil {
		timeout := cfg.Timeout
		if timeout <= 0 {
			timeout = 5 * time.Second
		}
		hc = &http.Client{Timeout: timeout}
	}

	return &Client{
		baseURL:    baseURL,
		apiKey:     cfg.APIKey,
		httpClient: hc,
	}
}

// ─── Authorization Types ──────────────────────────────────────────────────────

// AuthorizeRequest checks whether an AI agent is permitted to call a tool.
type AuthorizeRequest struct {
	Tool    string                 `json:"tool"`
	Context *string                `json:"context,omitempty"`
	Args    map[string]interface{} `json:"args,omitempty"`
}

// AuthDecision is the response from POST /api/v1/authorize.
type AuthDecision struct {
	RequestID  string  `json:"requestId"`
	Tool       string  `json:"tool"`
	Decision   string  `json:"decision"` // "allow" | "deny" | "human_review"
	Reason     string  `json:"reason"`
	Rule       string  `json:"rule"`
	PolicyName *string `json:"policyName,omitempty"`
	LatencyMS  float64 `json:"latencyMs"`
	Mode       string  `json:"mode"` // "live" | "sandbox"
	KeyID      *string `json:"keyId,omitempty"`
	Timestamp  string  `json:"timestamp"`
}

// Allowed returns true when the decision is "allow".
func (d *AuthDecision) Allowed() bool {
	return d != nil && d.Decision == "allow"
}

// RequiresHumanReview returns true when the decision is "human_review".
func (d *AuthDecision) RequiresHumanReview() bool {
	return d != nil && d.Decision == "human_review"
}

// AgentAuthRequest is the confidence-aware agent authorization request payload.
// Deprecated: Use AuthorizeRequest with Authorize() instead.
type AgentAuthRequest struct {
	Actor      string  `json:"actor"`
	Action     string  `json:"action"`
	Confidence float64 `json:"confidence"`
	ActingFor  string  `json:"acting_for,omitempty"`
	Scope      string  `json:"scope,omitempty"`
}

// AgentAuthDecision is the response from agent authorization.
// Deprecated: Use AuthDecision with Authorize() instead.
type AgentAuthDecision struct {
	AuthDecision
	ConfidenceUsed  float64 `json:"confidence_used"`
	TraceID         string  `json:"trace_id"`
	DowngradedScope *string `json:"downgraded_scope,omitempty"`
}

// ─── Token Types ──────────────────────────────────────────────────────────────

// MintTokenRequest is the request payload for token minting.
type MintTokenRequest struct {
	Scope      string `json:"scope"`
	ActingFor  string `json:"acting_for,omitempty"`
	TTLSeconds int64  `json:"ttl_seconds,omitempty"`
}

// MintTokenResult is the response from /v1/tokens/mint.
type MintTokenResult struct {
	Token     string    `json:"token"`
	TokenID   string    `json:"token_id"`
	ExpiresAt time.Time `json:"-"`
}

// RevokeTokenResult is the response from token revocation.
type RevokeTokenResult struct {
	Success bool `json:"success"`
}

// ─── Audit Types ──────────────────────────────────────────────────────────────

// AuditEvent represents a single audit event from the platform.
type AuditEvent struct {
	ID         int64   `json:"id"`
	TraceID    string  `json:"traceId"`
	UserID     *string `json:"userId,omitempty"`
	KeyID      *string `json:"keyId,omitempty"`
	Actor      string  `json:"actor"`
	Action     string  `json:"action"`
	Decision   string  `json:"decision"` // "allow" | "deny" | "human_review"
	Reason     string  `json:"reason"`
	Rule       string  `json:"rule"`
	PolicyName *string `json:"policyName,omitempty"`
	Confidence float64 `json:"confidence"`
	LatencyMS  float64 `json:"latencyMs"`
	Mode       string  `json:"mode"`
	CreatedAt  string  `json:"createdAt"`
}

// ListAuditEventsRequest configures audit event listing.
type ListAuditEventsRequest struct {
	Limit    int64  `json:"limit,omitempty"`
	Cursor   int64  `json:"cursor,omitempty"`
	Actor    string `json:"actor,omitempty"`
	Action   string `json:"action,omitempty"`
	Decision string `json:"decision,omitempty"`
	TraceID  string `json:"trace_id,omitempty"`
	From     string `json:"from,omitempty"`
	To       string `json:"to,omitempty"`
}

// ListAuditEventsResult contains the audit events response.
type ListAuditEventsResult struct {
	Events     []AuditEvent `json:"events"`
	Count      int          `json:"count"`
	Limit      int64        `json:"limit"`
	Cursor     int64        `json:"cursor"`
	NextCursor int64        `json:"next_cursor"`
}

// ─── Policy Types ─────────────────────────────────────────────────────────────

// PolicyRule represents a single rule within a policy.
type PolicyRule struct {
	ID       string `json:"id"`
	Pattern  string `json:"pattern"`
	Decision string `json:"decision"` // "allow" | "deny" | "human_review"
	Reason   string `json:"reason"`
}

// Policy represents a policy stored in the platform.
type Policy struct {
	ID          string       `json:"id"`
	UserID      string       `json:"userId"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Rules       []PolicyRule `json:"rules"`
	IsActive    bool         `json:"isActive"`
	CreatedAt   string       `json:"createdAt"`
	UpdatedAt   string       `json:"updatedAt"`
}

// ListPoliciesRequest configures policy listing.
type ListPoliciesRequest struct{}

// ListPoliciesResult contains the policies response.
type ListPoliciesResult struct {
	Policies []Policy `json:"policies"`
	Count    int      `json:"count"`
}

// GetPolicyRequest configures getting a specific policy.
type GetPolicyRequest struct {
	ID string `json:"id"`
}

// UpsertPolicyRequest configures creating or updating a policy.
type UpsertPolicyRequest struct {
	Name        string       `json:"name"`
	Description string       `json:"description,omitempty"`
	Rules       []PolicyRule `json:"rules"`
	IsActive    bool         `json:"isActive"`
}

// DeletePolicyRequest configures deleting a policy.
type DeletePolicyRequest struct {
	ID string `json:"id"`
}

// DeletePolicyResult contains the policy deletion response.
type DeletePolicyResult struct {
	Deleted bool `json:"deleted"`
}

// ─── Phase 2: Behavioral Analytics Types ─────────────────────────────────────

// AgentReputation represents an agent's reputation metrics
type AgentReputation struct {
	AgentID          string  `json:"agent_id"`
	ReputationScore  float64 `json:"reputation_score"`
	DecisionCount    int64   `json:"decision_count"`
	AccuracyRate     float64 `json:"accuracy_rate"`
	CalibrationScore float64 `json:"calibration_score"`
	LastUpdated      string  `json:"last_updated"`
	ConfidenceSum    float64 `json:"confidence_sum"`
	CorrectDecisions int64   `json:"correct_decisions"`
	HighConfErrors   int64   `json:"high_conf_errors"`
	LowConfCorrect   int64   `json:"low_conf_correct"`
}

// AnomalyResult represents an anomaly detection result
type AnomalyResult struct {
	AgentID      string             `json:"agent_id"`
	Timestamp    string             `json:"timestamp"`
	AnomalyScore float64            `json:"anomaly_score"`
	IsAnomaly    bool               `json:"is_anomaly"`
	Severity     string             `json:"severity"`
	Features     map[string]float64 `json:"features"`
	Explanation  string             `json:"explanation"`
	Action       string             `json:"action"`
	Confidence   float64            `json:"confidence"`
	Latency      float64            `json:"latency"`
	Outcome      string             `json:"outcome"`
}

// BaselineHealth represents behavioral baseline health information
type BaselineHealth struct {
	AgentID            string   `json:"agent_id"`
	OverallHealth      float64  `json:"overall_health"`
	SampleCount        int64    `json:"sample_count"`
	Age                float64  `json:"age"`
	LastUpdated        string   `json:"last_updated"`
	ConfidenceVariance float64  `json:"confidence_variance"`
	LatencyVariance    float64  `json:"latency_variance"`
	ActionDiversity    int64    `json:"action_diversity"`
	TemporalCoverage   float64  `json:"temporal_coverage"`
	ConfidenceDrift    float64  `json:"confidence_drift"`
	LatencyDrift       float64  `json:"latency_drift"`
	PatternDrift       float64  `json:"pattern_drift"`
	NeedsRefresh       bool     `json:"needs_refresh"`
	RecommendedActions []string `json:"recommended_actions"`
}

// DriftAnalysis represents behavioral drift analysis
type DriftAnalysis struct {
	AgentID         string   `json:"agent_id"`
	DetectedAt      string   `json:"detected_at"`
	DriftScore      float64  `json:"drift_score"`
	DriftType       string   `json:"drift_type"`
	Severity        string   `json:"severity"`
	BaselineAge     float64  `json:"baseline_age"`
	RecentSamples   int64    `json:"recent_samples"`
	Explanation     string   `json:"explanation"`
	Recommendations []string `json:"recommendations"`
}

// Alert represents alert information
type Alert struct {
	ID          string                 `json:"id"`
	RuleID      string                 `json:"rule_id"`
	AgentID     string                 `json:"agent_id"`
	Timestamp   string                 `json:"timestamp"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Severity    string                 `json:"severity"`
	Priority    int                    `json:"priority"`
	TriggerData map[string]interface{} `json:"trigger_data"`
	Context     map[string]interface{} `json:"context"`
	Status      string                 `json:"status"`
	AckedBy     *string                `json:"acked_by,omitempty"`
	AckedAt     *string                `json:"acked_at,omitempty"`
	ResolvedAt  *string                `json:"resolved_at,omitempty"`
	GroupID     *string                `json:"group_id,omitempty"`
	GroupCount  int                    `json:"group_count"`
	Tags        map[string]string      `json:"tags"`
	Channels    []string               `json:"channels"`
}

// API Response types for Phase 2
type ReputationListResponse struct {
	Agents    []AgentReputation `json:"agents"`
	Total     int               `json:"total"`
	Sort      string            `json:"sort"`
	Threshold *float64          `json:"threshold,omitempty"`
}

type AnomaliesResponse struct {
	AgentID   string          `json:"agent_id"`
	Anomalies []AnomalyResult `json:"anomalies"`
	Total     int             `json:"total"`
	Since     string          `json:"since"`
}

type BaselineResponse struct {
	AgentID string         `json:"agent_id"`
	Health  BaselineHealth `json:"health"`
	Drift   DriftAnalysis  `json:"drift"`
}

type AlertsResponse struct {
	Alerts []Alert `json:"alerts"`
	Total  int     `json:"total"`
}

type AcknowledgeAlertRequest struct {
	AcknowledgedBy string `json:"acknowledged_by"`
}

// ─── Wire types ───────────────────────────────────────────────────────────────

type mintTokenWire struct {
	Token     string `json:"token"`
	TokenID   string `json:"token_id"`
	ExpiresAt int64  `json:"expires_at"`
}

type policyWrapper struct {
	Policy Policy `json:"policy"`
}

// EngineError represents non-2xx responses from the Lelu Engine.
type EngineError struct {
	Message string
	Status  int
	Body    string
}

func (e *EngineError) Error() string {
	if e == nil {
		return ""
	}
	if e.Status > 0 {
		return fmt.Sprintf("engine error (%d): %s", e.Status, e.Message)
	}
	return "engine error: " + e.Message
}

type errorBody struct {
	Error string `json:"error"`
}

// ─── Authorization Methods ────────────────────────────────────────────────────

// Authorize checks whether an AI agent is permitted to call a tool.
func (c *Client) Authorize(ctx context.Context, req AuthorizeRequest) (*AuthDecision, error) {
	if strings.TrimSpace(req.Tool) == "" {
		return nil, errors.New("tool is required")
	}

	var out AuthDecision
	if err := c.postJSON(ctx, "/api/v1/authorize", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// AgentAuthorize checks whether an agent is authorized for an action.
// Deprecated: Use Authorize() instead. Kept for backward compatibility.
func (c *Client) AgentAuthorize(ctx context.Context, req AgentAuthRequest) (*AgentAuthDecision, error) {
	if strings.TrimSpace(req.Actor) == "" {
		return nil, errors.New("actor is required")
	}
	if strings.TrimSpace(req.Action) == "" {
		return nil, errors.New("action is required")
	}
	if req.Confidence < 0 || req.Confidence > 1 {
		return nil, errors.New("confidence must be between 0 and 1")
	}

	tracer := GetAgentTracer()
	return c.withAgentSpan(ctx, tracer, "ai.agent.authorize", req.Actor, func(ctx context.Context, span trace.Span) (*AgentAuthDecision, error) {
		span.SetAttributes(
			attribute.String(AttrRequestIntent, req.Action),
			attribute.Float64(AttrRequestConfidence, req.Confidence),
			attribute.String(AttrRequestActingFor, req.ActingFor),
			attribute.String(AttrRequestScope, req.Scope),
		)

		decision, err := c.Authorize(ctx, AuthorizeRequest{Tool: req.Action})
		if err != nil {
			return nil, err
		}

		outcome := "denied"
		if decision.RequiresHumanReview() {
			outcome = "review"
		} else if decision.Allowed() {
			outcome = "allowed"
		}

		tracer.RecordDecision(span, decision.Allowed(), decision.RequiresHumanReview(), req.Confidence, 0.0, outcome)
		tracer.RecordLatency(span, decision.LatencyMS, 0, 0, 0)

		span.SetAttributes(
			attribute.String("lelu.request_id", decision.RequestID),
			attribute.Bool("lelu.engine_decision", decision.Allowed()),
		)

		return &AgentAuthDecision{
			AuthDecision:   *decision,
			ConfidenceUsed: req.Confidence,
			TraceID:        decision.RequestID,
		}, nil
	})
}

// ─── JIT Token Methods ────────────────────────────────────────────────────────

// MintToken mints a scoped JIT token for agents.
func (c *Client) MintToken(ctx context.Context, req MintTokenRequest) (*MintTokenResult, error) {
	if strings.TrimSpace(req.Scope) == "" {
		return nil, errors.New("scope is required")
	}
	if req.TTLSeconds < 0 {
		return nil, errors.New("ttl_seconds cannot be negative")
	}
	if req.TTLSeconds == 0 {
		req.TTLSeconds = 60
	}

	var wire mintTokenWire
	if err := c.postJSON(ctx, "/v1/tokens/mint", req, &wire); err != nil {
		return nil, err
	}

	return &MintTokenResult{
		Token:     wire.Token,
		TokenID:   wire.TokenID,
		ExpiresAt: time.Unix(wire.ExpiresAt, 0).UTC(),
	}, nil
}

// RevokeToken revokes a previously minted token by ID.
func (c *Client) RevokeToken(ctx context.Context, tokenID string) (*RevokeTokenResult, error) {
	if strings.TrimSpace(tokenID) == "" {
		return nil, errors.New("tokenID is required")
	}

	escaped := url.PathEscape(tokenID)
	var out RevokeTokenResult
	if err := c.doJSON(ctx, http.MethodDelete, "/v1/tokens/"+escaped, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ─── Multi-agent Delegation ───────────────────────────────────────────────────

// DelegateScopeRequest is the request payload for multi-agent delegation.
type DelegateScopeRequest struct {
	Delegator  string   `json:"delegator"`
	Delegatee  string   `json:"delegatee"`
	ScopedTo   []string `json:"scoped_to,omitempty"`
	TTLSeconds int64    `json:"ttl_seconds,omitempty"`
	Confidence float64  `json:"confidence,omitempty"`
	ActingFor  string   `json:"acting_for,omitempty"`
	TenantID   string   `json:"tenant_id,omitempty"`
}

// DelegateScopeResult is the response from /v1/agent/delegate.
type DelegateScopeResult struct {
	Token         string    `json:"-"`
	TokenID       string    `json:"-"`
	ExpiresAt     time.Time `json:"-"`
	Delegator     string    `json:"delegator"`
	Delegatee     string    `json:"delegatee"`
	GrantedScopes []string  `json:"granted_scopes"`
	TraceID       string    `json:"trace_id"`
}

type delegateScopeWire struct {
	Token         string   `json:"token"`
	TokenID       string   `json:"token_id"`
	ExpiresAt     int64    `json:"expires_at"`
	Delegator     string   `json:"delegator"`
	Delegatee     string   `json:"delegatee"`
	GrantedScopes []string `json:"granted_scopes"`
	TraceID       string   `json:"trace_id"`
}

// DelegateScope delegates a constrained sub-scope from one agent to another.
func (c *Client) DelegateScope(ctx context.Context, req DelegateScopeRequest) (*DelegateScopeResult, error) {
	if strings.TrimSpace(req.Delegator) == "" {
		return nil, errors.New("delegator is required")
	}
	if strings.TrimSpace(req.Delegatee) == "" {
		return nil, errors.New("delegatee is required")
	}
	if req.Confidence < 0 || req.Confidence > 1 {
		return nil, errors.New("confidence must be between 0 and 1")
	}
	if req.TTLSeconds == 0 {
		req.TTLSeconds = 60
	}

	tracer := GetAgentTracer()
	return c.withDelegationSpan(ctx, tracer, "ai.agent.delegate", req.Delegator, func(ctx context.Context, span trace.Span) (*DelegateScopeResult, error) {
		tracer.InjectCorrelationContext(span, fmt.Sprintf("%s→%s", req.Delegator, req.Delegatee))
		span.SetAttributes(
			attribute.String(AttrParentAgent, req.Delegator),
			attribute.String(AttrChildAgent, req.Delegatee),
			attribute.StringSlice("ai.delegation.scoped_to", req.ScopedTo),
			attribute.Int64("ai.delegation.ttl_seconds", req.TTLSeconds),
			attribute.Float64(AttrRequestConfidence, req.Confidence),
			attribute.String(AttrRequestActingFor, req.ActingFor),
		)

		var wire delegateScopeWire
		if err := c.postJSON(ctx, "/v1/agent/delegate", req, &wire); err != nil {
			tracer.RecordDecision(span, false, false, req.Confidence, 1.0, "delegation_denied")
			return nil, err
		}

		start := time.Now()
		totalLatency := float64(time.Since(start).Microseconds()) / 1000
		tracer.RecordDecision(span, true, false, req.Confidence, 0.0, "delegation_allowed")
		tracer.RecordLatency(span, totalLatency, 0, 0, 0)

		span.SetAttributes(
			attribute.String("lelu.trace_id", wire.TraceID),
			attribute.String("lelu.token_id", wire.TokenID),
			attribute.StringSlice("lelu.granted_scopes", wire.GrantedScopes),
			attribute.Bool("lelu.delegation_success", true),
		)

		return &DelegateScopeResult{
			Token:         wire.Token,
			TokenID:       wire.TokenID,
			ExpiresAt:     time.Unix(wire.ExpiresAt, 0).UTC(),
			Delegator:     wire.Delegator,
			Delegatee:     wire.Delegatee,
			GrantedScopes: wire.GrantedScopes,
			TraceID:       wire.TraceID,
		}, nil
	})
}

// ─── Health Check ─────────────────────────────────────────────────────────────

// IsHealthy returns true when the platform is reachable.
func (c *Client) IsHealthy(ctx context.Context) bool {
	hreq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/config-check", nil)
	if err != nil {
		return false
	}
	if c.apiKey != "" {
		hreq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	resp, err := c.httpClient.Do(hreq)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

// ListAuditEvents fetches audit events from the platform API.
func (c *Client) ListAuditEvents(ctx context.Context, req *ListAuditEventsRequest) (*ListAuditEventsResult, error) {
	if req == nil {
		req = &ListAuditEventsRequest{Limit: 20}
	}
	if req.Limit <= 0 {
		req.Limit = 20
	}
	if req.Limit > 500 {
		req.Limit = 500
	}

	params := url.Values{}
	if req.Limit != 20 {
		params.Set("limit", fmt.Sprintf("%d", req.Limit))
	}
	if req.Cursor > 0 {
		params.Set("cursor", fmt.Sprintf("%d", req.Cursor))
	}
	if req.Actor != "" {
		params.Set("actor", req.Actor)
	}
	if req.Action != "" {
		params.Set("action", req.Action)
	}
	if req.Decision != "" {
		params.Set("decision", req.Decision)
	}
	if req.TraceID != "" {
		params.Set("trace_id", req.TraceID)
	}
	if req.From != "" {
		params.Set("from", req.From)
	}
	if req.To != "" {
		params.Set("to", req.To)
	}

	path := "/api/v1/audit"
	if len(params) > 0 {
		path += "?" + params.Encode()
	}

	hreq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	hreq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		hreq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(hreq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, c.parseError(resp.StatusCode, respBytes)
	}

	var result ListAuditEventsResult
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &result, nil
}

// ─── Policy Management ────────────────────────────────────────────────────────

// ListPolicies lists all policies for the authenticated user.
func (c *Client) ListPolicies(ctx context.Context, _ *ListPoliciesRequest) (*ListPoliciesResult, error) {
	hreq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/policies", nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	hreq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		hreq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(hreq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, c.parseError(resp.StatusCode, respBytes)
	}

	var result ListPoliciesResult
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &result, nil
}

// GetPolicy gets a specific policy by ID.
func (c *Client) GetPolicy(ctx context.Context, req *GetPolicyRequest) (*Policy, error) {
	if req == nil || strings.TrimSpace(req.ID) == "" {
		return nil, errors.New("policy ID is required")
	}

	path := fmt.Sprintf("/api/policies/%s", url.PathEscape(req.ID))
	hreq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	hreq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		hreq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(hreq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, c.parseError(resp.StatusCode, respBytes)
	}

	var wrapper policyWrapper
	if err := json.Unmarshal(respBytes, &wrapper); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &wrapper.Policy, nil
}

// UpsertPolicy creates or updates a policy.
func (c *Client) UpsertPolicy(ctx context.Context, req *UpsertPolicyRequest) (*Policy, error) {
	if req == nil || strings.TrimSpace(req.Name) == "" {
		return nil, errors.New("policy name is required")
	}

	payload := map[string]interface{}{
		"name":        req.Name,
		"description": req.Description,
		"rules":       req.Rules,
		"isActive":    req.IsActive,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	hreq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/policies", bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	hreq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		hreq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(hreq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, c.parseError(resp.StatusCode, respBytes)
	}

	var wrapper policyWrapper
	if err := json.Unmarshal(respBytes, &wrapper); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &wrapper.Policy, nil
}

// DeletePolicy deletes a policy by ID.
func (c *Client) DeletePolicy(ctx context.Context, req *DeletePolicyRequest) (*DeletePolicyResult, error) {
	if req == nil || strings.TrimSpace(req.ID) == "" {
		return nil, errors.New("policy ID is required")
	}

	path := fmt.Sprintf("/api/policies/%s", url.PathEscape(req.ID))
	hreq, err := http.NewRequestWithContext(ctx, http.MethodDelete, c.baseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	hreq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		hreq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(hreq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, c.parseError(resp.StatusCode, respBytes)
	}

	var result DeletePolicyResult
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &result, nil
}

// ─── Phase 2: Behavioral Analytics Methods ────────────────────────────────────

// GetAgentReputation retrieves reputation information for a specific agent.
func (c *Client) GetAgentReputation(ctx context.Context, agentID string) (*AgentReputation, error) {
	if strings.TrimSpace(agentID) == "" {
		return nil, errors.New("agentID is required")
	}

	path := fmt.Sprintf("/v1/analytics/reputation/%s", url.PathEscape(agentID))
	var result AgentReputation
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ListAgentReputations retrieves reputation information for all agents.
func (c *Client) ListAgentReputations(ctx context.Context, sort string, threshold *float64) (*ReputationListResponse, error) {
	params := url.Values{}
	if sort != "" {
		params.Set("sort", sort)
	}
	if threshold != nil {
		params.Set("threshold", fmt.Sprintf("%.3f", *threshold))
	}

	path := "/v1/analytics/reputation"
	if len(params) > 0 {
		path += "?" + params.Encode()
	}

	var result ReputationListResponse
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetAgentAnomalies retrieves recent anomalies for a specific agent.
func (c *Client) GetAgentAnomalies(ctx context.Context, agentID string, since *string) (*AnomaliesResponse, error) {
	if strings.TrimSpace(agentID) == "" {
		return nil, errors.New("agentID is required")
	}

	params := url.Values{}
	if since != nil {
		params.Set("since", *since)
	}

	path := fmt.Sprintf("/v1/analytics/anomalies/%s", url.PathEscape(agentID))
	if len(params) > 0 {
		path += "?" + params.Encode()
	}

	var result AnomaliesResponse
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetAgentBaseline retrieves behavioral baseline information for a specific agent.
func (c *Client) GetAgentBaseline(ctx context.Context, agentID string) (*BaselineResponse, error) {
	if strings.TrimSpace(agentID) == "" {
		return nil, errors.New("agentID is required")
	}

	path := fmt.Sprintf("/v1/analytics/baseline/%s", url.PathEscape(agentID))
	var result BaselineResponse
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// RefreshAgentBaseline triggers a refresh of the behavioral baseline for a specific agent.
func (c *Client) RefreshAgentBaseline(ctx context.Context, agentID string) error {
	if strings.TrimSpace(agentID) == "" {
		return errors.New("agentID is required")
	}

	path := fmt.Sprintf("/v1/analytics/baseline/%s/refresh", url.PathEscape(agentID))
	return c.doJSON(ctx, http.MethodPost, path, nil, nil)
}

// GetAlerts retrieves active alerts.
func (c *Client) GetAlerts(ctx context.Context, agentID *string, severity *string, status *string) (*AlertsResponse, error) {
	params := url.Values{}
	if agentID != nil {
		params.Set("agent_id", *agentID)
	}
	if severity != nil {
		params.Set("severity", *severity)
	}
	if status != nil {
		params.Set("status", *status)
	}

	path := "/v1/analytics/alerts"
	if len(params) > 0 {
		path += "?" + params.Encode()
	}

	var result AlertsResponse
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// AcknowledgeAlert acknowledges a specific alert.
func (c *Client) AcknowledgeAlert(ctx context.Context, alertID string, acknowledgedBy string) error {
	if strings.TrimSpace(alertID) == "" {
		return errors.New("alertID is required")
	}
	if strings.TrimSpace(acknowledgedBy) == "" {
		return errors.New("acknowledgedBy is required")
	}

	path := fmt.Sprintf("/v1/analytics/alerts/%s/acknowledge", url.PathEscape(alertID))
	req := AcknowledgeAlertRequest{AcknowledgedBy: acknowledgedBy}
	return c.doJSON(ctx, http.MethodPost, path, req, nil)
}

// ResolveAlert resolves a specific alert.
func (c *Client) ResolveAlert(ctx context.Context, alertID string) error {
	if strings.TrimSpace(alertID) == "" {
		return errors.New("alertID is required")
	}

	path := fmt.Sprintf("/v1/analytics/alerts/%s/resolve", url.PathEscape(alertID))
	return c.doJSON(ctx, http.MethodPost, path, nil, nil)
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

// withAgentSpan executes a function within an agent span context
func (c *Client) withAgentSpan(ctx context.Context, tracer *AgentTracer, operationName string, agentID string, fn func(context.Context, trace.Span) (*AgentAuthDecision, error)) (*AgentAuthDecision, error) {
	ctx, span := tracer.StartAgentSpan(ctx, operationName, agentID)
	defer span.End()

	result, err := fn(ctx, span)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	return result, nil
}

// withDelegationSpan executes a function within a delegation span context
func (c *Client) withDelegationSpan(ctx context.Context, tracer *AgentTracer, operationName string, agentID string, fn func(context.Context, trace.Span) (*DelegateScopeResult, error)) (*DelegateScopeResult, error) {
	ctx, span := tracer.StartAgentSpan(ctx, operationName, agentID)
	defer span.End()

	result, err := fn(ctx, span)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	return result, nil
}

func (c *Client) postJSON(ctx context.Context, path string, in any, out any) error {
	return c.doJSON(ctx, http.MethodPost, path, in, out)
}

func (c *Client) doJSON(ctx context.Context, method, path string, in any, out any) error {
	var body io.Reader
	if in != nil {
		payload, err := json.Marshal(in)
		if err != nil {
			return fmt.Errorf("marshal request: %w", err)
		}
		body = bytes.NewReader(payload)
	}

	hreq, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	hreq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		hreq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(hreq)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return c.parseError(resp.StatusCode, respBytes)
	}

	if out == nil || len(respBytes) == 0 {
		return nil
	}
	if err := json.Unmarshal(respBytes, out); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}

func (c *Client) parseError(status int, body []byte) error {
	msg := strings.TrimSpace(string(body))
	var eb errorBody
	if len(body) > 0 && json.Unmarshal(body, &eb) == nil && eb.Error != "" {
		msg = eb.Error
	}
	if msg == "" {
		msg = "request failed"
	}
	return &EngineError{Message: msg, Status: status, Body: string(body)}
}
