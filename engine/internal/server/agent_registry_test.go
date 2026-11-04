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

// The Python and TypeScript SDKs parse these names. Python's RegisteredAgent
// model requires all of them except metadata, so renaming a field breaks SDK callers.
var registeredAgentFields = []string{
	"id", "tenant_id", "name", "description", "agent_type", "owner_email",
	"status", "scopes", "metadata", "created_at", "updated_at",
}

func keysOf(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func asAdmin(r *http.Request) *http.Request {
	return r.WithContext(withPrincipal(r.Context(), Principal{IsStaticAdminKey: true}))
}

func TestAgentRegistryResponsesUseSnakeCaseFields(t *testing.T) {
	// The registry gets its own database. A handler built with one registers
	// process-wide reputation metrics, which can only happen once per test run.
	h := newReputationHandler(t, nil)
	reg, err := identity.New(identity.Config{DB: openReputationDB(t)})
	require.NoError(t, err)
	h.SetIdentityRegistry(reg)

	body := `{"name":"invoice_bot","description":"Processes invoices","agent_type":"autonomous",` +
		`"owner_email":"owner@example.com","scopes":["read:invoices"],"metadata":{"team":"billing"}}`
	rec := httptest.NewRecorder()
	h.handleRegisterAgent(rec, asAdmin(httptest.NewRequest(http.MethodPost, "/v1/agents", bytes.NewBufferString(body))))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	var registered map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &registered))
	assert.ElementsMatch(t, registeredAgentFields, keysOf(registered))

	id, _ := registered["id"].(string)
	require.NotEmpty(t, id)
	assert.Equal(t, "invoice_bot", registered["name"])
	assert.Equal(t, "autonomous", registered["agent_type"])
	assert.Equal(t, "owner@example.com", registered["owner_email"])
	assert.Equal(t, "active", registered["status"])
	assert.Equal(t, []any{"read:invoices"}, registered["scopes"])
	assert.Equal(t, map[string]any{"team": "billing"}, registered["metadata"])

	t.Run("get", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "/v1/agents/"+id, nil)
		r.SetPathValue("agentID", id)
		rec := httptest.NewRecorder()
		h.handleGetAgent(rec, asAdmin(r))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

		var got map[string]any
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
		assert.ElementsMatch(t, registeredAgentFields, keysOf(got))
		assert.Equal(t, id, got["id"])
	})

	t.Run("list", func(t *testing.T) {
		rec := httptest.NewRecorder()
		h.handleListAgents(rec, asAdmin(httptest.NewRequest(http.MethodGet, "/v1/agents", nil)))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

		var got struct {
			Agents []map[string]any `json:"agents"`
			Count  int              `json:"count"`
		}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
		require.Equal(t, 1, got.Count)
		require.Len(t, got.Agents, 1)
		assert.ElementsMatch(t, registeredAgentFields, keysOf(got.Agents[0]))
		assert.Equal(t, id, got.Agents[0]["id"])
	})
}
