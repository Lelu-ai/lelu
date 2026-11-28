package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-ai/lelu/engine/internal/identity"
)

// Every agent registry route that takes an agent ID must answer another
// account's agent exactly like a missing one. The token route didn't check
// ownership at all: account B got a workload token for account A's agent,
// while reading or revoking that agent answered 404.
func TestAgentRoutes_AccountKeysCannotReachAnotherAccountsAgent(t *testing.T) {
	const (
		keyA      = "lelu_sk_owner_a_secret"
		keyB      = "lelu_sk_owner_b_secret"
		staticKey = "static-admin-key"
	)
	accounts := map[string]string{keyA: "acct-a", keyB: "acct-b"}
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Key string `json:"key"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		w.Header().Set("Content-Type", "application/json")
		if userID, ok := accounts[body.Key]; ok {
			_ = json.NewEncoder(w).Encode(map[string]any{"valid": true, "userId": userID, "keyId": "k-" + userID})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"valid": false})
	}))
	t.Cleanup(platform.Close)
	t.Setenv("PLATFORM_URL", platform.URL)

	h := newReputationHandler(t, nil)
	h.apiKey = staticKey
	reg, err := identity.New(identity.Config{DB: openReputationDB(t)})
	require.NoError(t, err)
	h.SetIdentityRegistry(reg)
	require.NotNil(t, h.keyVerify, "PLATFORM_URL must enable account-bound keys")

	srv := httptest.NewServer(NewHTTPServer(":0", h).Handler)
	t.Cleanup(srv.Close)

	do := func(key, method, path string, body any) (int, map[string]any) {
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
		defer resp.Body.Close()
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		return resp.StatusCode, out
	}

	// A registers an agent.
	status, agent := do(keyA, http.MethodPost, "/v1/agents", map[string]any{"name": "a_bot"})
	require.Equal(t, http.StatusCreated, status, agent)
	agentID, _ := agent["id"].(string)
	require.NotEmpty(t, agentID)
	base := "/v1/agents/" + agentID

	// B gets the same answer as for an ID that doesn't exist, on every route.
	_, missing := do(keyB, http.MethodPost, "/v1/agents/no-such-agent/token", nil)
	for _, rt := range []struct{ method, path string }{
		{http.MethodPost, base + "/token"},
		{http.MethodGet, base},
		{http.MethodPost, base + "/suspend"},
		{http.MethodDelete, base},
	} {
		status, body := do(keyB, rt.method, rt.path, nil)
		assert.Equal(t, http.StatusNotFound, status, "%s %s as another account", rt.method, rt.path)
		assert.NotContains(t, body, "token", "%s %s leaked a token", rt.method, rt.path)
		assert.Equal(t, len(missing), len(body), "%s %s answered differently from a missing agent", rt.method, rt.path)
	}

	// B's attempts changed nothing, and A still gets a token for its agent.
	status, got := do(keyA, http.MethodGet, base, nil)
	require.Equal(t, http.StatusOK, status)
	assert.Equal(t, "active", got["status"])

	status, tok := do(keyA, http.MethodPost, base+"/token", nil)
	require.Equal(t, http.StatusOK, status, tok)
	assert.NotEmpty(t, tok["token"])

	// The static admin key can still get a token for any account's agent.
	status, tok = do(staticKey, http.MethodPost, base+"/token", nil)
	require.Equal(t, http.StatusOK, status, tok)
	assert.NotEmpty(t, tok["token"])
}
