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
	// Dual-mode logic: If API key is provided and looks like a SaaS key, default to Render URL
	isSaaSKey := cfg.APIKey != "" && (strings.HasPrefix(cfg.APIKey, "lelu_live_") || strings.HasPrefix(cfg.APIKey, "lelu_test_"))
	defaultURL := "http://localhost:8080"
	if isSaaSKey {
		defaultURL = "https://lelu-engine.onrender.com"
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

// AuthRequest is the human authorization request payload.
type AuthRequest struct {
	TenantID string            `json:"tenant_id,omitempty"`
	UserID   string            `json:"user_id"`
	Action   string            `json:"action"`
	Resource map[string]string `json:"resource,omitempty"`
}

// AuthDecision is the response from /v1/authorize.
type AuthDecision struct {
	Allowed bool   `json:"allowed"`
	Reason  string `json:"reason"`
	TraceID string `json:"trace_id"`
}

// AgentAuthRequest is the confidence-aware agent authorization request payload.
type AgentAuthRequest struct {
	TenantID   string            `json:"tenant_id,omitempty"`
	Actor      string            `json:"actor"`
	Action     string            `json:"action"`
	Resource   map[string]string `json:"resource,omitempty"`
	Confidence float64           `json:"confidence"`
	ActingFor  string            `json:"acting_for,omitempty"`
	Scope      string            `json:"scope,omitempty"`
}

// AgentAuthDecision is the response from /v1/agent/authorize.
type AgentAuthDecision struct {
	Allowed             bool    `json:"allowed"`
	Reason              string  `json:"reason"`
	TraceID             string  `json:"trace_id"`
	DowngradedScope     string  `json:"downgraded_scope,omitempty"`
	RequiresHumanReview bool    `json:"requires_human_review"`
	ConfidenceUsed      float64 `json:"confidence_used"`
}

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

// AuditEvent represents a single audit event from the platform.
type AuditEvent struct {
	ID              int64             `json:"id"`
	TenantID        string            `json:"tenant_id"`
	TraceID         string            `json:"trace_id"`
	Timestamp       string            `json:"timestamp"`
	Actor           string            `json:"actor"`
	Action          string            `json:"action"`
	Resource        map[string]string `json:"resource,omitempty"`
	ConfidenceScore *float64          `json:"confidence_score,omitempty"`
	Decision        string            `json:"decision"` // "allowed" | "denied" | "human_review"
	Reason          *string           `json:"reason,omitempty"`
	DowngradedScope *string           `json:"downgraded_scope,omitempty"`
	LatencyMS       float64           `json:"latency_ms"`
	EngineVersion   *string           `json:"engine_version,omitempty"`
	PolicyVersion   *string           `json:"policy_version,omitempty"`
	CreatedAt       string            `json:"created_at"`
}

// ListAuditEventsRequest configures audit event listing.
type ListAuditEventsRequest struct {
	Limit    int64   `json:"limit,omitempty"`    // Maximum number of events (default: 20, max: 500)
	Cursor   int64   `json:"cursor,omitempty"`   // Pagination cursor (offset)
	Actor    string  `json:"actor,omitempty"`    // Filter by actor
	Action   string  `json:"action,omitempty"`   // Filter by action
	Decision string  `json:"decision,omitempty"` // Filter by decision
	TraceID  string  `json:"trace_id,omitempty"` // Filter by trace ID
	From     *string `json:"from,omitempty"`     // Filter from timestamp (ISO 8601)
	To       *string `json:"to,omitempty"`       // Filter to timestamp (ISO 8601)
	TenantID string  `json:"tenant_id,omitempty"` // Tenant ID
}

// ListAuditEventsResult contains the audit events response.
type ListAuditEventsResult struct {
	Events     []AuditEvent `json:"events"`
	Count      int          `json:"count"`
	Limit      int64        `json:"limit"`
	Cursor     int64        `json:"cursor"`
	NextCursor int64        `json:"next_cursor"`
}

// Policy represents a policy stored in the platform.
type Policy struct {
	ID         string `json:"id"`
	TenantID   string `json:"tenant_id"`
	Name       string `json:"name"`
	Content    string `json:"content"`
	Version    string `json:"version"`
	HMACSha256 string `json:"hmac_sha256"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}

// ListPoliciesRequest configures policy listing.
type ListPoliciesRequest struct {
	TenantID string `json:"tenant_id,omitempty"` // Tenant ID
}

// ListPoliciesResult contains the policies response.
type ListPoliciesResult struct {
	Policies []Policy `json:"policies"`
	Count    int      `json:"count"`
}

// GetPolicyRequest configures getting a specific policy.
type GetPolicyRequest struct {
	Name     string `json:"name"`                // Policy name
	TenantID string `json:"tenant_id,omitempty"` // Tenant ID
}

// UpsertPolicyRequest configures creating or updating a policy.
type UpsertPolicyRequest struct {
	Name     string `json:"name"`                // Policy name
	Content  string `json:"content"`             // Policy content (Rego code)
	Version  string `json:"version,omitempty"`   // Policy version (defaults to "1.0")
	TenantID string `json:"tenant_id,omitempty"` // Tenant ID
}

// DeletePolicyRequest configures deleting a policy.
type DeletePolicyRequest struct {
	Name     string `json:"name"`                // Policy name
	TenantID string `json:"tenant_id,omitempty"` // Tenant ID
}

// DeletePolicyResult contains the policy deletion response.
type DeletePolicyResult struct {
	Deleted bool `json:"deleted"`
}

// ─── Phase 2: Behavioral Analytics Types ─────────────────────────────────────

// AgentReputation represents an agent's reputation metrics
type AgentReputation struct {
	AgentID          string    `json:"agent_id"`
	ReputationScore  float64   `json:"reputation_score"`   // 0-1 trust score
	DecisionCount    int64     `json:"decision_count"`     // Total decisions made
	AccuracyRate     float64   `json:"accuracy_rate"`      // % correct decisions
	CalibrationScore float64   `json:"calibration_score"`  // Confidence vs accuracy alignment
	LastUpdated      string    `json:"last_updated"`       // ISO timestamp
	ConfidenceSum    float64   `json:"confidence_sum"`     // Sum of all confidence scores
	CorrectDecisions int64     `json:"correct_decisions"`  // Number of correct decisions
	HighConfErrors   int64     `json:"high_conf_errors"`   // High confidence but wrong
	LowConfCorrect   int64     `json:"low_conf_correct"`   // Low confidence but correct
}

// AnomalyResult represents an anomaly detection result
type AnomalyResult struct {
	AgentID      string             `json:"agent_id"`
	Timestamp    string             `json:"timestamp"`       // ISO timestamp
	AnomalyScore float64            `json:"anomaly_score"`   // 0-1, higher = more anomalous
	IsAnomaly    bool               `json:"is_anomaly"`
	Severity     string             `json:"severity"`        // none, low, medium, high, severe
	Features     map[string]float64 `json:"features"`        // Feature values that contributed
	Explanation  string             `json:"explanation"`     // Human-readable explanation
	Action       string             `json:"action"`
	Confidence   float64            `json:"confidence"`
	Latency      float64            `json:"latency"`         // milliseconds
	Outcome      string             `json:"outcome"`
}

// BaselineHealth represents behavioral baseline health information
type BaselineHealth struct {
	AgentID             string   `json:"agent_id"`
	OverallHealth       float64  `json:"overall_health"`       // 0-1 health score
	SampleCount         int64    `json:"sample_count"`
	Age                 float64  `json:"age"`                  // milliseconds
	LastUpdated         string   `json:"last_updated"`         // ISO timestamp
	ConfidenceVariance  float64  `json:"confidence_variance"`
	LatencyVariance     float64  `json:"latency_variance"`
	ActionDiversity     int64    `json:"action_diversity"`
	TemporalCoverage    float64  `json:"temporal_coverage"`    // How well it covers different times
	ConfidenceDrift     float64  `json:"confidence_drift"`
	LatencyDrift        float64  `json:"latency_drift"`
	PatternDrift        float64  `json:"pattern_drift"`
	NeedsRefresh        bool     `json:"needs_refresh"`
	RecommendedActions  []string `json:"recommended_actions"`
}

// DriftAnalysis represents behavioral drift analysis
type DriftAnalysis struct {
	AgentID         string   `json:"agent_id"`
	DetectedAt      string   `json:"detected_at"`      // ISO timestamp
	DriftScore      float64  `json:"drift_score"`      // 0-1, higher = more drift
	DriftType       string   `json:"drift_type"`       // none, confidence, latency, pattern, combined
	Severity        string   `json:"severity"`         // none, low, medium, high, critical
	BaselineAge     float64  `json:"baseline_age"`     // milliseconds
	RecentSamples   int64    `json:"recent_samples"`
	Explanation     string   `json:"explanation"`
	Recommendations []string `json:"recommendations"`
}

// Alert represents alert information
type Alert struct {
	ID          string                 `json:"id"`
	RuleID      string                 `json:"rule_id"`
	AgentID     string                 `json:"agent_id"`
	Timestamp   string                 `json:"timestamp"`    // ISO timestamp
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Severity    string                 `json:"severity"`     // low, medium, high, critical
	Priority    int                    `json:"priority"`     // 1-5, higher = more urgent
	TriggerData map[string]interface{} `json:"trigger_data"`
	Context     map[string]interface{} `json:"context"`
	Status      string                 `json:"status"`       // active, acknowledged, resolved
	AckedBy     *string                `json:"acked_by,omitempty"`
	AckedAt     *string                `json:"acked_at,omitempty"`     // ISO timestamp
	ResolvedAt  *string                `json:"resolved_at,omitempty"`  // ISO timestamp
	GroupID     *string                `json:"group_id,omitempty"`
	GroupCount  int                    `json:"group_count"`
	Tags        map[string]string      `json:"tags"`
	Channels    []string               `json:"channels"`
}

// API Response types for Phase 2
type ReputationListResponse struct {
	Agents    []AgentReputation `json:"agents"`
	Total     int               `json:"total"`
	Sort      string            `json:"sort"`      // top or problematic
	Threshold *float64          `json:"threshold,omitempty"`
}

type AnomaliesResponse struct {
	AgentID   string          `json:"agent_id"`
	Anomalies []AnomalyResult `json:"anomalies"`
	Total     int             `json:"total"`
	Since     string          `json:"since"`     // ISO timestamp
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

type mintTokenWire struct {
	Token     string `json:"token"`
	TokenID   string `json:"token_id"`
	ExpiresAt int64  `json:"expires_at"`
}

type healthResponse struct {
	Status string `json:"status"`
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

// Authorize checks whether a human user is authorized for an action.
func (c *Client) Authorize(ctx context.Context, req AuthRequest) (*AuthDecision, error) {
	if strings.TrimSpace(req.UserID) == "" {
		return nil, errors.New("user_id is required")
	}
	if strings.TrimSpace(req.Action) == "" {
		return nil, errors.New("action is required")
	}

	var out AuthDecision
	if err := c.postJSON(ctx, "/v1/authorize", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// AgentAuthorize checks whether an agent is authorized for an action.
// Enhanced with Phase 1 observability features.
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

	// Start enhanced tracing span
	tracer := GetAgentTracer()
	return c.withAgentSpan(ctx, tracer, "ai.agent.authorize", req.Actor, func(ctx context.Context, span trace.Span) (*AgentAuthDecision, error) {
		start := time.Now()
		
		// Add request context attributes
		span.SetAttributes(
			attribute.String(AttrRequestIntent, req.Action),
			attribute.Float64(AttrRequestConfidence, req.Confidence),
			attribute.String(AttrRequestActingFor, req.ActingFor),
			attribute.String(AttrRequestScope, req.Scope),
		)
		
		var out AgentAuthDecision
		if err := c.postJSON(ctx, "/v1/agent/authorize", req, &out); err != nil {
			return nil, err
		}
		
		// Record decision metrics
		totalLatency := float64(time.Since(start).Microseconds()) / 1000
		outcome := "denied"
		if out.RequiresHumanReview {
			outcome = "review"
		} else if out.Allowed {
			outcome = "allowed"
		}
		
		tracer.RecordDecision(span, out.Allowed, out.RequiresHumanReview, out.ConfidenceUsed, 0.0, outcome)
		tracer.RecordLatency(span, totalLatency, 0, 0, 0)
		
		// Add trace ID and engine decision to span
		span.SetAttributes(
			attribute.String("lelu.trace_id", out.TraceID),
			attribute.Bool("lelu.engine_decision", out.Allowed),
			attribute.String("lelu.downgraded_scope", out.DowngradedScope),
		)
		
		return &out, nil
	})
}

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
// The delegator's confidence score is checked against the policy's
// require_confidence_above before delegation is granted.
// Enhanced with Phase 1 observability features.
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

	// Start enhanced delegation tracing span
	tracer := GetAgentTracer()
	return c.withDelegationSpan(ctx, tracer, "ai.agent.delegate", req.Delegator, func(ctx context.Context, span trace.Span) (*DelegateScopeResult, error) {
		start := time.Now()
		
		// Add delegation-specific attributes
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
			// Record delegation failure
			tracer.RecordDecision(span, false, false, req.Confidence, 1.0, "delegation_denied")
			return nil, err
		}
		
		// Record successful delegation metrics
		totalLatency := float64(time.Since(start).Microseconds()) / 1000
		tracer.RecordDecision(span, true, false, req.Confidence, 0.0, "delegation_allowed")
		tracer.RecordLatency(span, totalLatency, 0, 0, 0)
		
		// Add delegation result attributes
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

// IsHealthy returns true when the engine health endpoint reports status=ok.
func (c *Client) IsHealthy(ctx context.Context) bool {
	var out healthResponse
	if err := c.doJSON(ctx, http.MethodGet, "/healthz", nil, &out); err != nil {
		return false
	}
	return out.Status == "ok"
}

// ListAuditEvents fetches audit events from the platform API.
// Requires the platform service to be running (not just the engine).
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

	// Build query parameters
	params := url.Values{}
	if req.Limit != 20 { // Only add if not default
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
	if req.From != nil {
		params.Set("from", *req.From)
	}
	if req.To != nil {
		params.Set("to", *req.To)
	}

	// Build URL
	path := "/api/v1/audit"
	if len(params) > 0 {
		path += "?" + params.Encode()
	}

	// Build request
	hreq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	hreq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		hreq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	if req.TenantID != "" {
		hreq.Header.Set("X-Tenant-ID", req.TenantID)
	}

	// Execute request
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
		msg := strings.TrimSpace(string(respBytes))
		var eb errorBody
		if len(respBytes) > 0 && json.Unmarshal(respBytes, &eb) == nil && eb.Error != "" {
			msg = eb.Error
		}
		if msg == "" {
			msg = "request failed"
		}
		return nil, &EngineError{Message: msg, Status: resp.StatusCode, Body: string(respBytes)}
	}

	var result ListAuditEventsResult
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &result, nil
}

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
		msg := strings.TrimSpace(string(respBytes))
		var eb errorBody
		if len(respBytes) > 0 && json.Unmarshal(respBytes, &eb) == nil && eb.Error != "" {
			msg = eb.Error
		}
		if msg == "" {
			msg = "request failed"
		}
		return &EngineError{Message: msg, Status: resp.StatusCode, Body: string(respBytes)}
	}

	if out == nil || len(respBytes) == 0 {
		return nil
	}
	if err := json.Unmarshal(respBytes, out); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}

// ── Policy Management ─────────────────────────────────────────────────────────

// ListPolicies lists all policies from the platform API.
func (c *Client) ListPolicies(ctx context.Context, req *ListPoliciesRequest) (*ListPoliciesResult, error) {
	if req == nil {
		req = &ListPoliciesRequest{}
	}

	// Build request
	hreq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v1/policies", nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	hreq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		hreq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	if req.TenantID != "" {
		hreq.Header.Set("X-Tenant-ID", req.TenantID)
	}

	// Execute request
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
		msg := strings.TrimSpace(string(respBytes))
		var eb errorBody
		if len(respBytes) > 0 && json.Unmarshal(respBytes, &eb) == nil && eb.Error != "" {
			msg = eb.Error
		}
		if msg == "" {
			msg = "request failed"
		}
		return nil, &EngineError{Message: msg, Status: resp.StatusCode, Body: string(respBytes)}
	}

	var result ListPoliciesResult
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &result, nil
}

// GetPolicy gets a specific policy by name.
func (c *Client) GetPolicy(ctx context.Context, req *GetPolicyRequest) (*Policy, error) {
	if req == nil || req.Name == "" {
		return nil, errors.New("policy name is required")
	}

	// Build request
	path := fmt.Sprintf("/api/v1/policies/%s", url.PathEscape(req.Name))
	hreq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	hreq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		hreq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	if req.TenantID != "" {
		hreq.Header.Set("X-Tenant-ID", req.TenantID)
	}

	// Execute request
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
		msg := strings.TrimSpace(string(respBytes))
		var eb errorBody
		if len(respBytes) > 0 && json.Unmarshal(respBytes, &eb) == nil && eb.Error != "" {
			msg = eb.Error
		}
		if msg == "" {
			msg = "request failed"
		}
		return nil, &EngineError{Message: msg, Status: resp.StatusCode, Body: string(respBytes)}
	}

	var result Policy
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &result, nil
}

// UpsertPolicy creates or updates a policy.
func (c *Client) UpsertPolicy(ctx context.Context, req *UpsertPolicyRequest) (*Policy, error) {
	if req == nil || req.Name == "" || req.Content == "" {
		return nil, errors.New("policy name and content are required")
	}

	version := req.Version
	if version == "" {
		version = "1.0"
	}

	payload := map[string]string{
		"content": req.Content,
		"version": version,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	// Build request
	path := fmt.Sprintf("/api/v1/policies/%s", url.PathEscape(req.Name))
	hreq, err := http.NewRequestWithContext(ctx, http.MethodPut, c.baseURL+path, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	hreq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		hreq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	if req.TenantID != "" {
		hreq.Header.Set("X-Tenant-ID", req.TenantID)
	}

	// Execute request
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
		msg := strings.TrimSpace(string(respBytes))
		var eb errorBody
		if len(respBytes) > 0 && json.Unmarshal(respBytes, &eb) == nil && eb.Error != "" {
			msg = eb.Error
		}
		if msg == "" {
			msg = "request failed"
		}
		return nil, &EngineError{Message: msg, Status: resp.StatusCode, Body: string(respBytes)}
	}

	var result Policy
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &result, nil
}

// DeletePolicy deletes a policy by name.
func (c *Client) DeletePolicy(ctx context.Context, req *DeletePolicyRequest) (*DeletePolicyResult, error) {
	if req == nil || req.Name == "" {
		return nil, errors.New("policy name is required")
	}

	// Build request
	path := fmt.Sprintf("/api/v1/policies/%s", url.PathEscape(req.Name))
	hreq, err := http.NewRequestWithContext(ctx, http.MethodDelete, c.baseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	hreq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		hreq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	if req.TenantID != "" {
		hreq.Header.Set("X-Tenant-ID", req.TenantID)
	}

	// Execute request
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
		msg := strings.TrimSpace(string(respBytes))
		var eb errorBody
		if len(respBytes) > 0 && json.Unmarshal(respBytes, &eb) == nil && eb.Error != "" {
			msg = eb.Error
		}
		if msg == "" {
			msg = "request failed"
		}
		return nil, &EngineError{Message: msg, Status: resp.StatusCode, Body: string(respBytes)}
	}

	var result DeletePolicyResult
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &result, nil
}

// ─── Phase 2: Behavioral Analytics Methods ──────────────────────────────────

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
