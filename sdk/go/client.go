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
	baseURL := strings.TrimSuffix(cfg.BaseURL, "/")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
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

	var out AgentAuthDecision
	if err := c.postJSON(ctx, "/v1/agent/authorize", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
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

	var wire delegateScopeWire
	if err := c.postJSON(ctx, "/v1/agent/delegate", req, &wire); err != nil {
		return nil, err
	}

	return &DelegateScopeResult{
		Token:         wire.Token,
		TokenID:       wire.TokenID,
		ExpiresAt:     time.Unix(wire.ExpiresAt, 0).UTC(),
		Delegator:     wire.Delegator,
		Delegatee:     wire.Delegatee,
		GrantedScopes: wire.GrantedScopes,
		TraceID:       wire.TraceID,
	}, nil
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
