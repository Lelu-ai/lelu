package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-ai/lelu/engine/internal/audit"
	"github.com/lelu-ai/lelu/engine/internal/confidence"
	"github.com/lelu-ai/lelu/engine/internal/evaluator"
	"github.com/lelu-ai/lelu/engine/internal/fallback"
	"github.com/lelu-ai/lelu/engine/internal/queue"
	"github.com/lelu-ai/lelu/engine/internal/ratelimit"
	"github.com/lelu-ai/lelu/engine/internal/server"
	"github.com/lelu-ai/lelu/engine/internal/tokens"
)

var samplePolicy = []byte(`
version: "1.0"
roles:
  finance_manager:
    allow: [view_invoices, approve_refunds]
    deny:  [delete_invoices]
agent_scopes:
  invoice_bot:
    inherits: finance_manager
    constraints:
      - require_human_approval_if_confidence_below: 0.90
      - downgrade_to_read_only_if_confidence_below: 0.70
      - hard_deny_if_confidence_below: 0.50
    deny: [delete_invoices]
`)

// TestMain runs the package's HTTP fixtures as a local-dev engine with no API
// key configured. The auth middleware now fails closed on a missing key unless
// LELU_DEV_INSECURE is explicitly set, so the suite opts in once here. Tests
// that assert the locked-down default override this flag individually.
func TestMain(m *testing.M) {
	os.Setenv("LELU_DEV_INSECURE", "true")
	os.Exit(m.Run())
}

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	return newTestServerWithMode(t, server.EnforcementModeEnforce)
}

// clearRiskEnv resets every env var server.NewRiskConfigFromEnv reads, so
// server.New() in these fixtures can't fail (or coincidentally succeed) on
// an ambient RISK_* value left over in the developer's shell or CI
// environment, now that a misordered or collapsed band is a hard startup
// error rather than a silent clamp. Flagged by the Copilot review on PR #45.
func clearRiskEnv(t *testing.T) {
	t.Helper()
	for _, k := range []string{
		"RISK_ALLOW_THRESHOLD_LOW", "RISK_READONLY_THRESHOLD_LOW", "RISK_REVIEW_THRESHOLD_LOW",
		"RISK_ALLOW_THRESHOLD_MID", "RISK_READONLY_THRESHOLD_MID", "RISK_REVIEW_THRESHOLD_MID",
		"RISK_ALLOW_THRESHOLD_HIGH", "RISK_READONLY_THRESHOLD_HIGH", "RISK_REVIEW_THRESHOLD_HIGH",
		"RISK_CRITICALITY_HIGH_MIN", "RISK_CRITICALITY_MID_MIN",
	} {
		t.Setenv(k, "")
	}
}

func newTestServerWithMode(t *testing.T, mode server.EnforcementMode) *httptest.Server {
	t.Helper()
	clearRiskEnv(t)
	eval := evaluator.New()
	require.NoError(t, eval.LoadPolicyBytes(samplePolicy))

	h, err := server.New(
		eval,
		tokens.New(tokens.Config{SigningKey: "test-key"}),
		confidence.New(),
		audit.New(audit.Config{Sink: &bytes.Buffer{}}),
		nil, // queue — not needed in unit tests
		"",
		server.ConfidenceConfig{},
		mode,
		nil,
		nil, // rateLimit
		nil, // fallback
		nil, // telemetry
		nil, // database — not needed in unit tests
	)
	require.NoError(t, err)

	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	return httptest.NewServer(mux)
}

func newTestHTTPServerWithConfig(t *testing.T, policy []byte, apiKey string, q *queue.Queue) *httptest.Server {
	t.Helper()
	clearRiskEnv(t)
	eval := evaluator.New()
	require.NoError(t, eval.LoadPolicyBytes(policy))

	h, err := server.New(
		eval,
		tokens.New(tokens.Config{SigningKey: "test-key"}),
		confidence.New(),
		audit.New(audit.Config{Sink: &bytes.Buffer{}}),
		q,
		apiKey,
		server.ConfidenceConfig{},
		server.EnforcementModeEnforce,
		nil,
		nil, // rateLimit
		nil, // fallback
		nil, // telemetry
		nil, // database — not needed in unit tests
	)
	require.NoError(t, err)

	httpSrv := server.NewHTTPServer(":0", h)
	return httptest.NewServer(httpSrv.Handler)
}

func postJSON(t *testing.T, srv *httptest.Server, path string, body any) *http.Response {
	t.Helper()
	b, _ := json.Marshal(body)
	resp, err := http.Post(srv.URL+path, "application/json", bytes.NewReader(b))
	require.NoError(t, err)
	return resp
}

// ── /healthz ──────────────────────────────────────────────────────────────────

func TestHealth(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/healthz")
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

// ── /v1/authorize ─────────────────────────────────────────────────────────────

func TestAuthorize_Allowed(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	resp := postJSON(t, srv, "/v1/authorize", map[string]any{
		"user_id": "user_123",
		"action":  "approve_refunds",
	})
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.True(t, body["allowed"].(bool))
}

func TestAuthorize_Denied(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	resp := postJSON(t, srv, "/v1/authorize", map[string]any{
		"user_id": "user_123",
		"action":  "delete_invoices",
	})
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.False(t, body["allowed"].(bool))
}

// ── /v1/agent/authorize ───────────────────────────────────────────────────────

func TestAgentAuthorize_FullConfidence(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	// view_invoices is low-criticality (matches "view"), so the criticality
	// floor added for https://github.com/Lelu-ai/lelu/issues/44 doesn't apply
	// — full confidence on a low-stakes action is still a clean allow.
	resp := postJSON(t, srv, "/v1/agent/authorize", map[string]any{
		"actor":  "invoice_bot",
		"action": "view_invoices",
		"confidence_signal": map[string]any{
			"provider":       "openai",
			"token_logprobs": []float64{-0.04, -0.05, -0.03},
		},
		"acting_for": "user_123",
	})
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.True(t, body["allowed"].(bool))
	assert.False(t, body["requires_human_review"].(bool))
}

// TestAgentAuthorize_HighCriticalityNeverAutoAllows confirms the criticality
// floor from https://github.com/Lelu-ai/lelu/issues/44: approve_refunds
// matches the "approve" high-criticality keyword, so even near-total model
// confidence must not bypass review. Before the fix, this exact input
// produced a clean allow — the risk-score cancellation the issue describes.
func TestAgentAuthorize_HighCriticalityNeverAutoAllows(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	resp := postJSON(t, srv, "/v1/agent/authorize", map[string]any{
		"actor":  "invoice_bot",
		"action": "approve_refunds",
		"confidence_signal": map[string]any{
			"provider":       "openai",
			"token_logprobs": []float64{-0.001, -0.001, -0.001}, // ~99.9% confidence
		},
		"acting_for": "user_123",
	})
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.False(t, body["allowed"].(bool), "high-criticality action must never auto-allow, no matter the confidence")
	assert.True(t, body["requires_human_review"].(bool))
}

func TestAgentAuthorize_HardDeny(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	resp := postJSON(t, srv, "/v1/agent/authorize", map[string]any{
		"actor":  "invoice_bot",
		"action": "approve_refunds",
		"confidence_signal": map[string]any{
			"provider":       "openai",
			"token_logprobs": []float64{-2.0, -1.8, -1.9},
		},
	})
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.False(t, body["allowed"].(bool))
}

// ── /v1/tokens/mint ───────────────────────────────────────────────────────────

func TestMintToken(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	resp := postJSON(t, srv, "/v1/tokens/mint", map[string]any{
		"scope":       "invoice_bot",
		"acting_for":  "user_123",
		"ttl_seconds": 30,
	})
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.NotEmpty(t, body["token"])
	assert.NotEmpty(t, body["token_id"])
}

func TestAuthorize_ShadowMode_AllowsButShowsWouldHaveDenied(t *testing.T) {
	srv := newTestServerWithMode(t, server.EnforcementModeShadow)
	defer srv.Close()

	resp := postJSON(t, srv, "/v1/authorize", map[string]any{
		"user_id": "user_123",
		"action":  "delete_invoices",
	})
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.True(t, body["allowed"].(bool))
	assert.True(t, body["shadow_mode"].(bool))
	assert.False(t, body["would_have_allowed"].(bool))
	assert.NotEmpty(t, body["would_have_reason"])
}

func TestAgentAuthorize_ShadowMode_AllowsButShowsWouldHaveDenied(t *testing.T) {
	srv := newTestServerWithMode(t, server.EnforcementModeShadow)
	defer srv.Close()

	resp := postJSON(t, srv, "/v1/agent/authorize", map[string]any{
		"actor":  "invoice_bot",
		"action": "approve_refunds",
		"confidence_signal": map[string]any{
			"provider":       "openai",
			"token_logprobs": []float64{-2.0, -1.8, -1.9},
		},
	})
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.True(t, body["allowed"].(bool))
	assert.True(t, body["shadow_mode"].(bool))
	assert.False(t, body["would_have_allowed"].(bool))
	assert.False(t, body["requires_human_review"].(bool))
	assert.NotEmpty(t, body["would_have_reason"])
}

func TestSimulatorReplay_ReturnsDeltaSummary(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	proposedPolicy := `
version: "1.0"
roles:
  finance_manager:
    allow: [view_invoices]
    deny:  [delete_invoices, approve_refunds]
agent_scopes:
  invoice_bot:
    inherits: finance_manager
    constraints:
      - require_human_approval_if_confidence_below: 0.90
      - downgrade_to_read_only_if_confidence_below: 0.70
      - hard_deny_if_confidence_below: 0.50
    deny: [delete_invoices]
`

	resp := postJSON(t, srv, "/v1/simulator/replay", map[string]any{
		"proposed_policy_yaml": proposedPolicy,
		"traces": []map[string]any{
			{
				"id":      "t1",
				"kind":    "human",
				"user_id": "user_123",
				"action":  "approve_refunds",
			},
			{
				"id":      "t2",
				"kind":    "human",
				"user_id": "user_123",
				"action":  "delete_invoices",
			},
		},
	})
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))

	summary := body["summary"].(map[string]any)
	assert.Equal(t, float64(2), summary["total"])
	assert.Equal(t, float64(1), summary["changed"])
	assert.Equal(t, float64(1), summary["allow_to_deny"])

	items := body["items"].([]any)
	require.Len(t, items, 2)

	first := items[0].(map[string]any)
	assert.Equal(t, true, first["changed"])
	assert.Equal(t, "t1", first["id"])
	assert.Equal(t, "human", first["kind"])

	before := first["before"].(map[string]any)
	after := first["after"].(map[string]any)
	assert.Equal(t, "allow", before["outcome"])
	assert.Equal(t, "deny", after["outcome"])
}

func TestShadowSummary_TracksWouldHaveOutcomes(t *testing.T) {
	srv := newTestServerWithMode(t, server.EnforcementModeShadow)
	defer srv.Close()

	_ = postJSON(t, srv, "/v1/authorize", map[string]any{
		"user_id": "user_123",
		"action":  "delete_invoices",
	})

	_ = postJSON(t, srv, "/v1/agent/authorize", map[string]any{
		"actor":  "invoice_bot",
		"action": "approve_refunds",
		"confidence_signal": map[string]any{
			"provider":       "openai",
			"token_logprobs": []float64{-0.23, -0.22, -0.24},
		},
	})

	// view_invoices (low criticality) at high confidence — still a clean
	// allow. approve_refunds (high criticality, see the call above) is not:
	// the criticality floor means it always requires at least review now,
	// regardless of confidence — see https://github.com/Lelu-ai/lelu/issues/44.
	_ = postJSON(t, srv, "/v1/agent/authorize", map[string]any{
		"actor":  "invoice_bot",
		"action": "view_invoices",
		"confidence_signal": map[string]any{
			"provider":       "openai",
			"token_logprobs": []float64{-0.01, -0.02, -0.01},
		},
	})

	resp, err := http.Get(srv.URL + "/v1/shadow/summary?window_minutes=120")
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))

	assert.Equal(t, "shadow", body["mode"])
	totals := body["totals"].(map[string]any)
	assert.Equal(t, float64(1), totals["deny"])
	assert.Equal(t, float64(1), totals["review"])
	assert.Equal(t, float64(1), totals["allow"])

	buckets := body["buckets"].([]any)
	assert.NotEmpty(t, buckets)
}

func TestAgentDelegate_Allowed(t *testing.T) {
	policy := []byte(`
version: "1.0"
roles:
  finance_manager:
    allow: [view_invoices, approve_refunds]
agent_scopes:
  orchestrator_agent:
    inherits: finance_manager
    can_delegate:
      - to: research_agent
        scoped_to:
          - research
          - read_reports
        max_ttl_seconds: 300
        require_confidence_above: 0.90
  research_agent:
    inherits: finance_manager
`)

	srv := newTestHTTPServerWithConfig(t, policy, "", nil)
	defer srv.Close()

	resp := postJSON(t, srv, "/v1/agent/delegate", map[string]any{
		"delegator":   "orchestrator_agent",
		"delegatee":   "research_agent",
		"scoped_to":   []string{"research"},
		"ttl_seconds": 120,
		"confidence":  0.95,
	})
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.NotEmpty(t, body["token"])
	assert.Equal(t, "orchestrator_agent", body["delegator"])
	assert.Equal(t, "research_agent", body["delegatee"])
}

func TestAgentDelegate_Denied(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	resp := postJSON(t, srv, "/v1/agent/delegate", map[string]any{
		"delegator":   "invoice_bot",
		"delegatee":   "research_agent",
		"scoped_to":   []string{"research"},
		"ttl_seconds": 120,
		"confidence":  0.95,
	})
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.False(t, body["allowed"].(bool))
	assert.NotEmpty(t, body["reason"])
}

func TestQueueApproveDenyFlows(t *testing.T) {
	q := queue.NewInMemory()
	srv := newTestHTTPServerWithConfig(t, samplePolicy, "", q)
	defer srv.Close()

	// Enqueue two separate items so each can be resolved independently.
	approveID, err := q.Enqueue(context.Background(), "t1", "bot", "act", nil, 0.5, "r", "u")
	require.NoError(t, err)
	denyID, err := q.Enqueue(context.Background(), "t1", "bot", "act", nil, 0.5, "r", "u")
	require.NoError(t, err)

	approveResp := postJSON(t, srv, "/v1/queue/"+approveID+"/approve", map[string]any{
		"resolved_by": "reviewer_1",
		"note":        "looks good",
	})
	assert.Equal(t, http.StatusOK, approveResp.StatusCode)

	denyResp := postJSON(t, srv, "/v1/queue/"+denyID+"/deny", map[string]any{
		"resolved_by": "reviewer_2",
		"note":        "too risky",
	})
	assert.Equal(t, http.StatusOK, denyResp.StatusCode)
}

func TestQueueResolve_BadBody(t *testing.T) {
	srv := newTestHTTPServerWithConfig(t, samplePolicy, "", queue.NewInMemory())
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/v1/queue/fake-id/approve", "application/json", bytes.NewBufferString("{"))
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

// ─── Delegation integration tests ────────────────────────────────────────────

func TestAgentDelegate_LowConfidence_Denied(t *testing.T) {
	policy := []byte(`
version: "1.0"
roles:
  finance_manager:
    allow: [view_invoices, approve_refunds]
agent_scopes:
  orchestrator_agent:
    inherits: finance_manager
    can_delegate:
      - to: research_agent
        scoped_to: [research]
        max_ttl_seconds: 300
        require_confidence_above: 0.90
  research_agent:
    inherits: finance_manager
`)
	srv := newTestHTTPServerWithConfig(t, policy, "", nil)
	defer srv.Close()

	resp := postJSON(t, srv, "/v1/agent/delegate", map[string]any{
		"delegator":   "orchestrator_agent",
		"delegatee":   "research_agent",
		"scoped_to":   []string{"research"},
		"ttl_seconds": 120,
		"confidence":  0.50,
	})
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.False(t, body["allowed"].(bool))
	assert.Contains(t, body["reason"], "confidence")
}

func TestAgentDelegate_TTL_CappedByPolicy(t *testing.T) {
	policy := []byte(`
version: "1.0"
roles:
  finance_manager:
    allow: [view_invoices]
agent_scopes:
  orchestrator_agent:
    inherits: finance_manager
    can_delegate:
      - to: research_agent
        scoped_to: [research]
        max_ttl_seconds: 60
        require_confidence_above: 0.80
  research_agent:
    inherits: finance_manager
`)
	srv := newTestHTTPServerWithConfig(t, policy, "", nil)
	defer srv.Close()

	resp := postJSON(t, srv, "/v1/agent/delegate", map[string]any{
		"delegator":   "orchestrator_agent",
		"delegatee":   "research_agent",
		"scoped_to":   []string{"research"},
		"ttl_seconds": 9999,
		"confidence":  0.95,
	})
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.NotEmpty(t, body["token"])
}

func TestAgentDelegate_MissingDelegator(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	resp := postJSON(t, srv, "/v1/agent/delegate", map[string]any{
		"delegatee": "research_agent",
	})
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

// ─── Queue integration tests ─────────────────────────────────────────────────

func TestQueueList_Empty(t *testing.T) {
	srv := newTestHTTPServerWithConfig(t, samplePolicy, "", queue.NewInMemory())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/v1/queue/pending")
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	// In-memory queue returns nil slice, which JSON-encodes as null.
	if body["items"] != nil {
		items, ok := body["items"].([]any)
		assert.True(t, ok)
		assert.Empty(t, items)
	}
	assert.Equal(t, float64(0), body["count"])
}

func TestQueueGet_NotFound(t *testing.T) {
	srv := newTestHTTPServerWithConfig(t, samplePolicy, "", queue.NewInMemory())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/v1/queue/nonexistent-id")
	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}

// ─── Rate limiting integration tests ─────────────────────────────────────────

func TestRateLimit_AuthEndpoint(t *testing.T) {
	clearRiskEnv(t)
	eval := evaluator.New()
	require.NoError(t, eval.LoadPolicyBytes(samplePolicy))

	rl := ratelimit.New(ratelimit.Config{
		Defaults: ratelimit.TenantLimits{
			AuthChecksPerMinute: 2,
			TokenMintsPerMinute: 100,
		},
	})

	h, err := server.New(
		eval,
		tokens.New(tokens.Config{SigningKey: "test-key"}),
		confidence.New(),
		audit.New(audit.Config{Sink: &bytes.Buffer{}}),
		nil,
		"",
		server.ConfidenceConfig{},
		server.EnforcementModeEnforce,
		nil,
		rl,
		nil, // fallback
		nil, // telemetry
		nil, // database — not needed in unit tests
	)
	require.NoError(t, err)
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	body := map[string]any{
		"tenant_id": "tenant-rl",
		"user_id":   "user_123",
		"action":    "approve_refunds",
	}

	// First 2 calls should succeed.
	for i := 0; i < 2; i++ {
		resp := postJSON(t, srv, "/v1/authorize", body)
		assert.Equal(t, http.StatusOK, resp.StatusCode, "call %d should pass", i+1)
	}
	// Third should be rate limited.
	resp := postJSON(t, srv, "/v1/authorize", body)
	assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode)
}

// ─── Fallback status endpoint ────────────────────────────────────────────────

func TestFallbackStatus_NilFallback(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/v1/fallback/status")
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Contains(t, body["status"], "not configured")
}

func TestFallbackStatus_WithStrategy(t *testing.T) {
	clearRiskEnv(t)
	eval := evaluator.New()
	require.NoError(t, eval.LoadPolicyBytes(samplePolicy))

	fb := fallback.New(fallback.Config{
		RedisMode:        fallback.ModeOpen,
		ControlPlaneMode: fallback.ModeClosed,
	})

	h, err := server.New(
		eval,
		tokens.New(tokens.Config{SigningKey: "test-key"}),
		confidence.New(),
		audit.New(audit.Config{Sink: &bytes.Buffer{}}),
		nil,
		"",
		server.ConfidenceConfig{},
		server.EnforcementModeEnforce,
		nil,
		nil, // rateLimit
		fb,
		nil, // telemetry
		nil, // database — not needed in unit tests
	)
	require.NoError(t, err)
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/v1/fallback/status")
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	redis, ok := body["redis"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, true, redis["healthy"])
	assert.Equal(t, "open", redis["mode"])
}

func TestAuthMiddleware_RejectsEmptyAPIKeyByDefault(t *testing.T) {
	// Without the explicit LELU_DEV_INSECURE opt-in, a missing API key must
	// fail closed (regardless of ENV) rather than silently allow all traffic.
	t.Setenv("LELU_DEV_INSECURE", "false")
	srv := newTestHTTPServerWithConfig(t, samplePolicy, "", nil)
	defer srv.Close()

	resp := postJSON(t, srv, "/v1/authorize", map[string]any{
		"user_id": "user_123",
		"action":  "approve_refunds",
	})
	assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
}

func TestAuthMiddleware_InvalidAPIKeyUnauthorized(t *testing.T) {
	t.Setenv("ENV", "development")
	srv := newTestHTTPServerWithConfig(t, samplePolicy, "test-api-key", nil)
	defer srv.Close()

	reqBody, _ := json.Marshal(map[string]any{"user_id": "user_123", "action": "approve_refunds"})
	req, err := http.NewRequest(http.MethodPost, srv.URL+"/v1/authorize", bytes.NewReader(reqBody))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer wrong-key")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestAuthMiddleware_ValidAPIKeyAllowed(t *testing.T) {
	t.Setenv("ENV", "development")
	srv := newTestHTTPServerWithConfig(t, samplePolicy, "test-api-key", nil)
	defer srv.Close()

	reqBody, _ := json.Marshal(map[string]any{"user_id": "user_123", "action": "approve_refunds"})
	req, err := http.NewRequest(http.MethodPost, srv.URL+"/v1/authorize", bytes.NewReader(reqBody))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-api-key")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestAgentAuthorize_RiskEscalatesToHumanReview(t *testing.T) {
	policy := []byte(`
version: "1.0"
roles:
  finance_manager:
    allow: [approve_payments]
agent_scopes:
  invoice_bot:
    inherits: finance_manager
    constraints: []
`)

	srv := newTestHTTPServerWithConfig(t, policy, "", nil)
	defer srv.Close()

	resp := postJSON(t, srv, "/v1/agent/authorize", map[string]any{
		"actor":  "invoice_bot",
		"action": "approve_payments",
		"confidence_signal": map[string]any{
			"provider":       "openai",
			"token_logprobs": []float64{-0.094, -0.094, -0.094},
		},
	})
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.False(t, body["allowed"].(bool))
	assert.True(t, body["requires_human_review"].(bool))
	assert.NotEmpty(t, body["risk_score"])
}

// A human_review decision must carry the queue item's ID: without it, a
// caller has nothing to poll GET /v1/queue/{id}, long-poll
// /v1/queue/{id}/wait, or resolve via approve/deny with — the decision is
// unaddressable. Requires a real (in-memory) queue; the ID only exists once
// something actually enqueues the item.
func TestAgentAuthorize_HumanReviewCarriesReviewID(t *testing.T) {
	policy := []byte(`
version: "1.0"
roles:
  finance_manager:
    allow: [approve_payments]
agent_scopes:
  invoice_bot:
    inherits: finance_manager
    constraints: []
`)

	srv := newTestHTTPServerWithConfig(t, policy, "", queue.NewInMemory())
	defer srv.Close()

	resp := postJSON(t, srv, "/v1/agent/authorize", map[string]any{
		"actor":  "invoice_bot",
		"action": "approve_payments",
		"confidence_signal": map[string]any{
			"provider":       "openai",
			"token_logprobs": []float64{-0.094, -0.094, -0.094},
		},
	})
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.True(t, body["requires_human_review"].(bool))
	reviewID, _ := body["review_id"].(string)
	assert.NotEmpty(t, reviewID, "human_review response must carry a review_id or the decision is unaddressable")

	// The ID must resolve against the queue — not just be a non-empty string.
	getResp, err := http.Get(srv.URL + "/v1/queue/" + reviewID)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, getResp.StatusCode)
}

// ── Request body size limit (DoS guard) ─────────────────────────────────────────

// TestRequestBodySizeLimit verifies that the shared bodyLimit middleware caps
// request bodies: a payload under the limit is processed normally, while an
// oversized payload is rejected before the handler (and the O(n·m) injection
// scanner) ever runs on it. See issue #12 (E1).
func TestRequestBodySizeLimit(t *testing.T) {
	t.Setenv("LELU_MAX_BODY_BYTES", "1024")
	srv := newTestHTTPServerWithConfig(t, samplePolicy, "", nil)
	defer srv.Close()

	// Under the limit: handled normally.
	resp := postJSON(t, srv, "/v1/authorize", map[string]any{
		"user_id": "user_123",
		"action":  "approve_refunds",
	})
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	resp.Body.Close()

	// Over the limit: rejected before the handler processes the payload.
	resp2 := postJSON(t, srv, "/v1/authorize", map[string]any{
		"user_id": strings.Repeat("A", 4096),
		"action":  "approve_refunds",
	})
	defer resp2.Body.Close()
	assert.Equal(t, http.StatusRequestEntityTooLarge, resp2.StatusCode)
	respBody, _ := io.ReadAll(resp2.Body)
	assert.Contains(t, string(respBody), "too large")
}
