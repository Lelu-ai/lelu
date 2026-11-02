package server_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-ai/lelu/engine/internal/queue"
)

// The review queue under account-bound keys. Every queued item's TenantID is
// the account that triggered it, but the queue handlers never compared it
// with the caller, so one customer could list another's pending actions and,
// without reviewer keys, approve them — after which the other customer's
// agent redeemed and went ahead. Reported by Thomas against f7168e7.

const (
	keyAcctA       = "lelu_sk_acct_a_secret"
	keyAcctB       = "lelu_sk_acct_b_secret"
	staticAdminKey = "static-admin-key"
)

// newTwoAccountServer runs the engine in PLATFORM_URL mode against a fake
// platform that verifies two keys to two different accounts, alongside the
// operator's static key.
func newTwoAccountServer(t *testing.T) *httptest.Server {
	t.Helper()
	accounts := map[string]string{keyAcctA: "acct-a", keyAcctB: "acct-b"}
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Key string `json:"key"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		w.Header().Set("Content-Type", "application/json")
		if userID, ok := accounts[body.Key]; ok {
			json.NewEncoder(w).Encode(map[string]any{"valid": true, "userId": userID, "keyId": "k-" + userID})
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"valid": false})
	}))
	t.Cleanup(platform.Close)

	t.Setenv("PLATFORM_URL", platform.URL)
	t.Setenv("LELU_REVIEWER_KEYS", "")
	srv := newTestHTTPServerWithConfig(t, samplePolicy, staticAdminKey, queue.NewInMemory())
	t.Cleanup(srv.Close)
	return srv
}

func doAs(t *testing.T, srv *httptest.Server, key, method, path string, body any) *http.Response {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		require.NoError(t, json.NewEncoder(&buf).Encode(body))
	}
	req, err := http.NewRequest(method, srv.URL+path, &buf)
	require.NoError(t, err)
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })
	return resp
}

func pendingAs(t *testing.T, srv *httptest.Server, key string) (ids []string, total float64) {
	t.Helper()
	resp := doAs(t, srv, key, http.MethodGet, "/v1/queue/pending", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var body struct {
		Items []queue.ReviewRequest `json:"items"`
		Total float64               `json:"total"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	for _, it := range body.Items {
		ids = append(ids, it.ID)
	}
	return ids, body.Total
}

func TestQueue_AccountKeysCannotReachAnotherAccountsReviews(t *testing.T) {
	srv := newTwoAccountServer(t)

	// B's agent makes a request that goes to human_review.
	payload := map[string]any{
		"actor":      "invoice_bot",
		"action":     "approve_refunds",
		"acting_for": "user_123",
		"args":       map[string]any{"amount_usd": 100, "invoice": "INV-1"},
		"confidence_signal": map[string]any{
			"provider":       "openai",
			"token_logprobs": []float64{-0.001, -0.001, -0.001},
		},
	}
	authResp := doAs(t, srv, keyAcctB, http.MethodPost, "/v1/agent/authorize", payload)
	require.Equal(t, http.StatusOK, authResp.StatusCode)
	var auth map[string]any
	require.NoError(t, json.NewDecoder(authResp.Body).Decode(&auth))
	require.True(t, auth["requires_human_review"].(bool), "fixture must produce a human_review decision")
	reviewID, _ := auth["review_id"].(string)
	require.NotEmpty(t, reviewID)

	// A's key does not see B's item in the list, or in the total.
	ids, total := pendingAs(t, srv, keyAcctA)
	assert.Empty(t, ids)
	assert.Equal(t, float64(0), total, "another account's queue size must not leak through total")

	// Nor by ID, on any route — and the answer is the same as for an ID that
	// doesn't exist.
	assert.Equal(t, http.StatusNotFound, doAs(t, srv, keyAcctA, http.MethodGet, "/v1/queue/"+reviewID, nil).StatusCode)
	assert.Equal(t, http.StatusNotFound, doAs(t, srv, keyAcctA, http.MethodGet, "/v1/queue/"+reviewID+"/wait?timeout_ms=1", nil).StatusCode)
	resolve := map[string]any{"resolved_by": "someone_else", "note": "cross-account"}
	assert.Equal(t, http.StatusNotFound, doAs(t, srv, keyAcctA, http.MethodPost, "/v1/queue/"+reviewID+"/approve", resolve).StatusCode)
	assert.Equal(t, http.StatusNotFound, doAs(t, srv, keyAcctA, http.MethodPost, "/v1/queue/"+reviewID+"/deny", resolve).StatusCode)

	// The failed attempts left the item pending for B.
	ids, total = pendingAs(t, srv, keyAcctB)
	assert.Equal(t, []string{reviewID}, ids)
	assert.Equal(t, float64(1), total)

	// The operator's static key still sees every account's reviews.
	ids, _ = pendingAs(t, srv, staticAdminKey)
	assert.Contains(t, ids, reviewID)

	// B resolves its own item.
	approve := map[string]any{"resolved_by": "human_reviewer_1", "note": "ok"}
	require.Equal(t, http.StatusOK, doAs(t, srv, keyAcctB, http.MethodPost, "/v1/queue/"+reviewID+"/approve", approve).StatusCode)

	// A can't spend B's approval, even holding the exact approved payload.
	assert.Equal(t, http.StatusNotFound, doAs(t, srv, keyAcctA, http.MethodPost, "/v1/queue/"+reviewID+"/redeem", payload).StatusCode)

	// So it is still there for B's agent.
	assert.Equal(t, http.StatusOK, doAs(t, srv, keyAcctB, http.MethodPost, "/v1/queue/"+reviewID+"/redeem", payload).StatusCode)
}
