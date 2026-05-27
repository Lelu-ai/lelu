package lelu

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func authorizeResponse() map[string]any {
	return map[string]any{
		"requestId": "req-123",
		"tool":      "view",
		"decision":  "allow",
		"reason":    "ok",
		"rule":      "default-allow",
		"latencyMs": 1.5,
		"mode":      "live",
		"timestamp": "2024-01-01T00:00:00Z",
	}
}

func TestAuthorize(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/v1/authorize" {
			t.Fatalf("unexpected route: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(authorizeResponse())
	}))
	defer ts.Close()

	c := NewClient(ClientConfig{BaseURL: ts.URL})
	res, err := c.Authorize(context.Background(), AuthorizeRequest{Tool: "view"})
	if err != nil {
		t.Fatalf("authorize failed: %v", err)
	}
	if !res.Allowed() {
		t.Fatalf("expected allowed, got decision=%s", res.Decision)
	}
	if res.RequestID != "req-123" {
		t.Fatalf("unexpected request id: %s", res.RequestID)
	}
}

func TestAuthorize_Deny(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"requestId": "req-456",
			"tool":      "delete_db",
			"decision":  "deny",
			"reason":    "not permitted",
			"rule":      "deny-all",
			"latencyMs": 0.5,
			"mode":      "live",
			"timestamp": "2024-01-01T00:00:00Z",
		})
	}))
	defer ts.Close()

	c := NewClient(ClientConfig{BaseURL: ts.URL})
	res, err := c.Authorize(context.Background(), AuthorizeRequest{Tool: "delete_db"})
	if err != nil {
		t.Fatalf("authorize failed: %v", err)
	}
	if res.Allowed() {
		t.Fatalf("expected denied")
	}
	if res.RequiresHumanReview() {
		t.Fatalf("expected not human review")
	}
}

func TestAuthorize_HumanReview(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"requestId": "req-789",
			"tool":      "wire_transfer",
			"decision":  "human_review",
			"reason":    "high risk action",
			"rule":      "require-review",
			"latencyMs": 1.0,
			"mode":      "live",
			"timestamp": "2024-01-01T00:00:00Z",
		})
	}))
	defer ts.Close()

	c := NewClient(ClientConfig{BaseURL: ts.URL})
	res, err := c.Authorize(context.Background(), AuthorizeRequest{Tool: "wire_transfer"})
	if err != nil {
		t.Fatalf("authorize failed: %v", err)
	}
	if res.Allowed() {
		t.Fatalf("expected not allowed")
	}
	if !res.RequiresHumanReview() {
		t.Fatalf("expected human review")
	}
}

func TestAgentAuthorize(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// AgentAuthorize now internally calls POST /api/v1/authorize
		if r.Method != http.MethodPost || r.URL.Path != "/api/v1/authorize" {
			t.Fatalf("unexpected route: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"requestId": "req-456",
			"tool":      "approve_refunds",
			"decision":  "allow",
			"reason":    "allowed",
			"rule":      "agent-policy",
			"latencyMs": 2.0,
			"mode":      "live",
			"timestamp": "2024-01-01T00:00:00Z",
		})
	}))
	defer ts.Close()

	c := NewClient(ClientConfig{BaseURL: ts.URL})
	res, err := c.AgentAuthorize(context.Background(), AgentAuthRequest{
		Actor:      "invoice_bot",
		Action:     "approve_refunds",
		Confidence: 0.95,
	})
	if err != nil {
		t.Fatalf("agent authorize failed: %v", err)
	}
	if !res.Allowed() {
		t.Fatalf("expected allowed, got decision=%s", res.Decision)
	}
	if res.ConfidenceUsed != 0.95 {
		t.Fatalf("unexpected confidence_used: %v", res.ConfidenceUsed)
	}
	if res.TraceID != "req-456" {
		t.Fatalf("unexpected trace id: %s", res.TraceID)
	}
}

func TestMintAndRevokeToken(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v1/tokens/mint":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"token":      "jwt-token",
				"token_id":   "tid-1",
				"expires_at": 1700000000,
			})
		case r.Method == http.MethodDelete && r.URL.Path == "/v1/tokens/tid-1":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
		default:
			t.Fatalf("unexpected route: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer ts.Close()

	c := NewClient(ClientConfig{BaseURL: ts.URL})
	minted, err := c.MintToken(context.Background(), MintTokenRequest{Scope: "invoice_bot"})
	if err != nil {
		t.Fatalf("mint failed: %v", err)
	}
	if minted.TokenID != "tid-1" {
		t.Fatalf("unexpected token id: %s", minted.TokenID)
	}
	if minted.ExpiresAt.Unix() != 1700000000 {
		t.Fatalf("unexpected expires at: %v", minted.ExpiresAt)
	}

	revoked, err := c.RevokeToken(context.Background(), minted.TokenID)
	if err != nil {
		t.Fatalf("revoke failed: %v", err)
	}
	if !revoked.Success {
		t.Fatalf("expected success=true")
	}
}

func TestIsHealthy(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/api/config-check" {
			t.Fatalf("unexpected route: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok"})
	}))
	defer ts.Close()

	c := NewClient(ClientConfig{BaseURL: ts.URL, Timeout: 2 * time.Second})
	if !c.IsHealthy(context.Background()) {
		t.Fatalf("expected healthy=true")
	}
}

func TestIsHealthy_Unreachable(t *testing.T) {
	c := NewClient(ClientConfig{BaseURL: "http://127.0.0.1:1", Timeout: 200 * time.Millisecond})
	if c.IsHealthy(context.Background()) {
		t.Fatalf("expected healthy=false for unreachable server")
	}
}

func TestDelegateScope(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/agent/delegate" {
			t.Fatalf("unexpected route: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"token":          "child.jwt.token",
			"token_id":       "dtid-1",
			"expires_at":     1700000120,
			"delegator":      "orchestrator",
			"delegatee":      "research_bot",
			"granted_scopes": []string{"research"},
			"trace_id":       "td-1",
		})
	}))
	defer ts.Close()

	c := NewClient(ClientConfig{BaseURL: ts.URL})
	res, err := c.DelegateScope(context.Background(), DelegateScopeRequest{
		Delegator:  "orchestrator",
		Delegatee:  "research_bot",
		ScopedTo:   []string{"research"},
		Confidence: 0.92,
	})
	if err != nil {
		t.Fatalf("delegate failed: %v", err)
	}
	if res.Token != "child.jwt.token" {
		t.Fatalf("unexpected token: %s", res.Token)
	}
	if res.TokenID != "dtid-1" {
		t.Fatalf("unexpected token_id: %s", res.TokenID)
	}
	if res.TraceID != "td-1" {
		t.Fatalf("unexpected trace_id: %s", res.TraceID)
	}
	if len(res.GrantedScopes) != 1 || res.GrantedScopes[0] != "research" {
		t.Fatalf("unexpected granted_scopes: %v", res.GrantedScopes)
	}
	if res.ExpiresAt.Unix() != 1700000120 {
		t.Fatalf("unexpected expires_at: %v", res.ExpiresAt)
	}
}

func TestDelegateScope_Validation(t *testing.T) {
	c := NewClient(ClientConfig{BaseURL: "http://localhost"})
	_, err := c.DelegateScope(context.Background(), DelegateScopeRequest{
		Delegatee: "bot",
	})
	if err == nil || err.Error() != "delegator is required" {
		t.Fatalf("expected delegator required error, got: %v", err)
	}

	_, err = c.DelegateScope(context.Background(), DelegateScopeRequest{
		Delegator:  "orch",
		Delegatee:  "bot",
		Confidence: 1.5,
	})
	if err == nil || err.Error() != "confidence must be between 0 and 1" {
		t.Fatalf("expected confidence validation error, got: %v", err)
	}
}

func TestEngineError(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "unauthorized"})
	}))
	defer ts.Close()

	c := NewClient(ClientConfig{BaseURL: ts.URL})
	_, err := c.Authorize(context.Background(), AuthorizeRequest{Tool: "view"})
	if err == nil {
		t.Fatalf("expected an error")
	}
	engErr, ok := err.(*EngineError)
	if !ok {
		t.Fatalf("expected *EngineError, got %T", err)
	}
	if engErr.Status != http.StatusUnauthorized {
		t.Fatalf("unexpected status: %d", engErr.Status)
	}
}

func TestNewClient_DefaultURL(t *testing.T) {
	// No API key → localhost
	c := NewClient(ClientConfig{})
	if c.baseURL != "http://localhost:8080" {
		t.Fatalf("expected localhost, got %s", c.baseURL)
	}

	// With API key → cloud URL
	c2 := NewClient(ClientConfig{APIKey: "lelu_sk_test_123"})
	if c2.baseURL != LeluCloudURL {
		t.Fatalf("expected cloud URL %s, got %s", LeluCloudURL, c2.baseURL)
	}

	// Explicit base URL overrides default
	c3 := NewClient(ClientConfig{APIKey: "lelu_sk_test", BaseURL: "http://custom:9090"})
	if c3.baseURL != "http://custom:9090" {
		t.Fatalf("expected custom URL, got %s", c3.baseURL)
	}
}
