package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/lelu-ai/lelu/engine/internal/audit"
	"github.com/lelu-ai/lelu/engine/internal/confidence"
	"github.com/lelu-ai/lelu/engine/internal/evaluator"
	"github.com/lelu-ai/lelu/engine/internal/tokens"
)

// ── principalMayActAs ────────────────────────────────────────────────────────
// The actual authorization decision behind the vault ownership checks —
// tested standalone since vault.Service needs CGO/SQLite that isn't
// available in every environment this runs in.

func TestPrincipalMayActAs(t *testing.T) {
	cases := []struct {
		name string
		p    Principal
		user string
		want bool
	}{
		{"static admin may act as anyone", Principal{IsStaticAdminKey: true}, "someone-else", true},
		{"static admin with empty target user", Principal{IsStaticAdminKey: true}, "", true},
		{"user may act as themselves", Principal{UserID: "user-1"}, "user-1", true},
		{"user may not act as another user", Principal{UserID: "user-1"}, "user-2", false},
		{"empty principal may not act as anyone named", Principal{}, "user-1", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := principalMayActAs(tc.p, tc.user); got != tc.want {
				t.Fatalf("principalMayActAs(%+v, %q) = %v, want %v", tc.p, tc.user, got, tc.want)
			}
		})
	}
}

// ── rateLimitKey ──────────────────────────────────────────────────────────────
// The old behavior keyed limits on req.TenantID — a caller-supplied string
// that resets the limit if you just relabel it. These confirm a verified
// account-bound principal always wins over whatever the caller claims.

func TestRateLimitKey(t *testing.T) {
	cases := []struct {
		name       string
		principal  *Principal
		claimedTID string
		want       string
	}{
		{"platform principal overrides the claimed tenant", &Principal{UserID: "user-1"}, "whatever-i-feel-like", "user-1"},
		{"static admin falls back to the claimed tenant", &Principal{IsStaticAdminKey: true}, "tenant-a", "tenant-a"},
		{"no principal falls back to the claimed tenant", nil, "tenant-b", "tenant-b"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			if tc.principal != nil {
				ctx = withPrincipal(ctx, *tc.principal)
			}
			if got := rateLimitKey(ctx, tc.claimedTID); got != tc.want {
				t.Fatalf("rateLimitKey(...) = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestRateLimitKey_SameUserSameKeyRegardlessOfClaimedTenant(t *testing.T) {
	ctx := withPrincipal(context.Background(), Principal{UserID: "user-1"})
	k1 := rateLimitKey(ctx, "tenant-a")
	k2 := rateLimitKey(ctx, "tenant-b")
	if k1 != k2 {
		t.Fatalf("same principal produced different rate-limit keys (%q vs %q) just by changing the claimed tenant_id — that's the exact bypass being fixed", k1, k2)
	}
}

// ── authMiddleware binds the right Principal ─────────────────────────────────
// keyverify_test.go already covers status codes for these paths; this checks
// what actually lands in the request context, which is the part Nate
// Howard's review found was being thrown away.

func TestAuthMiddleware_BindsStaticAdminPrincipal(t *testing.T) {
	h := &Handler{apiKey: "static-key"}
	var captured Principal
	var hadPrincipal bool
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured, hadPrincipal = principalFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/agent/authorize", nil)
	req.Header.Set("Authorization", "Bearer static-key")
	rec := httptest.NewRecorder()
	h.authMiddleware(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected request to pass auth, got status %d", rec.Code)
	}
	if !hadPrincipal {
		t.Fatal("expected a Principal in context, got none")
	}
	if !captured.IsStaticAdminKey {
		t.Fatalf("expected IsStaticAdminKey=true for the static key path, got %+v", captured)
	}
}

func TestAuthMiddleware_BindsDevInsecurePrincipal(t *testing.T) {
	t.Setenv("LELU_DEV_INSECURE", "true")
	h := &Handler{} // no apiKey, no keyVerify
	var captured Principal
	var hadPrincipal bool
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured, hadPrincipal = principalFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/agent/authorize", nil)
	rec := httptest.NewRecorder()
	h.authMiddleware(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected LELU_DEV_INSECURE to pass, got status %d", rec.Code)
	}
	if !hadPrincipal || !captured.IsStaticAdminKey {
		t.Fatalf("expected a static-admin Principal for the dev-insecure path, got present=%v %+v", hadPrincipal, captured)
	}
}

func TestAuthMiddleware_BindsPlatformKeyPrincipal(t *testing.T) {
	platform := fakePlatform(t, "lelu_sk_abc_secret", new(atomic.Int64))
	defer platform.Close()

	h := &Handler{keyVerify: newTestVerifier(platform.URL)}
	var captured Principal
	var hadPrincipal bool
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured, hadPrincipal = principalFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/agent/authorize", nil)
	req.Header.Set("Authorization", "Bearer lelu_sk_abc_secret")
	rec := httptest.NewRecorder()
	h.authMiddleware(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected the platform-verified key to pass, got status %d", rec.Code)
	}
	if !hadPrincipal {
		t.Fatal("expected a Principal in context, got none")
	}
	if captured.IsStaticAdminKey {
		t.Fatal("a platform-verified key must not be treated as the static admin credential")
	}
	if captured.UserID != "user-1" {
		t.Fatalf("expected UserID from the platform's verify response, got %q", captured.UserID)
	}
}

// ── handlePolicyPut's auth gate ──────────────────────────────────────────────
// The bug this closes: the old check only ran `if h.apiKey != ""`, so it was
// a no-op whenever PLATFORM_URL mode was configured — any account-bound key
// could overwrite the engine's one shared policy. These tests exercise the
// gate directly via ServeHTTP, using the real handler (newDecisionHandler
// already wires a working evaluator, no CGO needed).

func TestHandlePolicyPut_RejectsNonAdminPrincipal(t *testing.T) {
	h := newDecisionHandler(t, ConfidenceConfig{})

	req := httptest.NewRequest(http.MethodPut, "/v1/policy", nil)
	req = req.WithContext(withPrincipal(context.Background(), Principal{UserID: "some-customer"}))
	rec := httptest.NewRecorder()
	h.handlePolicyPut(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for a non-admin account-bound principal, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandlePolicyPut_RejectsMissingPrincipal(t *testing.T) {
	h := newDecisionHandler(t, ConfidenceConfig{})

	// No withPrincipal at all — simulates a request that reached the handler
	// without going through authMiddleware.
	req := httptest.NewRequest(http.MethodPut, "/v1/policy", nil)
	rec := httptest.NewRecorder()
	h.handlePolicyPut(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when no Principal is present, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandlePolicyPut_AllowsStaticAdminPastTheGate(t *testing.T) {
	h := newDecisionHandler(t, ConfidenceConfig{})

	// Deliberately malformed body — the point of this test is only that the
	// static-admin principal clears the auth gate (doesn't get 403), not that
	// the rest of the policy-write flow succeeds.
	req := httptest.NewRequest(http.MethodPut, "/v1/policy", nil)
	req = req.WithContext(withPrincipal(context.Background(), Principal{IsStaticAdminKey: true}))
	rec := httptest.NewRecorder()
	h.handlePolicyPut(rec, req)

	if rec.Code == http.StatusForbidden {
		t.Fatalf("static admin principal should clear the auth gate, got 403: %s", rec.Body.String())
	}
}

// ── Audit attribution uses the verified tenant, not the claimed one ─────────
// The sub-point of Nate Howard's finding #2 that survived the first pass:
// "audit attribution records whatever was claimed." These confirm the fix by
// reading the actual audit record back, not just checking a status code.

// newDecisionHandlerWithSink is newDecisionHandler but exposes the audit
// sink so a test can decode what actually got logged.
func newDecisionHandlerWithSink(t *testing.T) (*Handler, *bytes.Buffer) {
	t.Helper()
	clearRiskEnv(t)
	buf := &bytes.Buffer{}
	eval := evaluator.New()
	require.NoError(t, eval.LoadPolicyBytes(internalSamplePolicy))
	h, err := New(
		eval,
		tokens.New(tokens.Config{SigningKey: "test-key"}),
		confidence.New(),
		audit.New(audit.Config{Sink: buf}),
		nil, // queue
		"",  // apiKey
		ConfidenceConfig{AllowUnverifiedConfidence: true},
		EnforcementModeEnforce,
		nil, // incident notifier
		nil, // rateLimit
		nil, // fallback
		nil, // telemetry
		nil, // db
	)
	require.NoError(t, err)
	return h, buf
}

func lastAuditEvent(t *testing.T, buf *bytes.Buffer) audit.Event {
	t.Helper()
	lines := bytes.Split(bytes.TrimSpace(buf.Bytes()), []byte("\n"))
	require.NotEmpty(t, lines, "expected at least one audit event to have been written")
	var e audit.Event
	require.NoError(t, json.Unmarshal(lines[len(lines)-1], &e))
	return e
}

func TestEvaluateAgentDecision_AuditUsesVerifiedTenantNotClaimed(t *testing.T) {
	h, buf := newDecisionHandlerWithSink(t)

	r := httptest.NewRequest(http.MethodPost, "/v1/agent/authorize", nil)
	r = r.WithContext(withPrincipal(context.Background(), Principal{UserID: "real-account-1"}))
	rec := httptest.NewRecorder()

	_, handled := h.evaluateAgentDecision(r.Context(), rec, r, agentAuthorizeRequest{
		TenantID: "attacker-claimed-tenant",
		Actor:    "invoice_bot",
		Action:   "view_invoices",
		Confidence: f64(0.95),
	}, nil, time.Now(), "test-input-hash")

	require.False(t, handled)
	h.audit.Close()

	got := lastAuditEvent(t, buf)
	if got.TenantID != "real-account-1" {
		t.Fatalf("audit event TenantID = %q, want the verified principal's UserID (%q), not the claimed tenant_id in the request body",
			got.TenantID, "real-account-1")
	}
}

func TestHandleAgentAuthorize_AuditUsesVerifiedTenantNotClaimed(t *testing.T) {
	// Unlike the test above, this goes through the real HTTP entry point —
	// confirms checkShadowAgent/checkPromptInjection (which run before
	// evaluateAgentDecision and build their own audit records) also see the
	// corrected tenant, not just evaluateAgentDecision's own internal copy.
	h, buf := newDecisionHandlerWithSink(t)

	body := `{"tenant_id":"attacker-claimed-tenant","actor":"invoice_bot","action":"view_invoices","confidence":0.95}`
	r := httptest.NewRequest(http.MethodPost, "/v1/agent/authorize", bytes.NewBufferString(body))
	r = r.WithContext(withPrincipal(context.Background(), Principal{UserID: "real-account-1"}))
	rec := httptest.NewRecorder()

	h.handleAgentAuthorize(rec, r)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	h.audit.Close()

	got := lastAuditEvent(t, buf)
	if got.TenantID != "real-account-1" {
		t.Fatalf("audit event TenantID = %q, want the verified principal's UserID (%q), not the claimed tenant_id in the request body",
			got.TenantID, "real-account-1")
	}
}
