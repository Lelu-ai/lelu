package server

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-ai/lelu/engine/internal/audit"
	"github.com/lelu-ai/lelu/engine/internal/confidence"
	"github.com/lelu-ai/lelu/engine/internal/evaluator"
	"github.com/lelu-ai/lelu/engine/internal/identity"
	"github.com/lelu-ai/lelu/engine/internal/observability"
	"github.com/lelu-ai/lelu/engine/internal/queue"
	"github.com/lelu-ai/lelu/engine/internal/tokens"
)

// Regression tests for https://github.com/Lelu-ai/lelu/issues/18: per-actor
// reputation is keyed on the verified agent ID, and unverified requests
// neither read nor write it.

// The lelu-mcp starter policy plus the allow-create rule from the field run.
var reputationStarterPolicy = []byte(`version: "1.0"
rules:
  - id: deny-delete
    match: "*delete*"
    decision: deny
    reason: "Destructive operations are blocked by the starter policy."
  - id: review-email
    match: "send_*"
    decision: human_review
    reason: "Outbound communication requires human sign-off."
  - id: allow-read
    match: "read_*"
    decision: allow
  - id: allow-create
    match: "create_*"
    decision: allow
  - id: default-deny
    match: "*"
    decision: deny
    reason: "Default-deny: no rule allows this action."
`)

// The 16 earlier calls from the field report: 12 without a confidence signal,
// then 4 policy denials at confidence 0.9. Before the fix, these left the
// actor at reliability 0.00, and its next create_pull_request at 0.9 came back
// allowed but downgraded to read_only.
var fieldRunMissingSignalActions = []string{
	"git_push", "git_force_push", "run_pytest", "edit_file",
	"create_pull_request", "merge_pull_request", "delete_branch", "npm_install",
	"send_slack_message", "deploy_lambda", "read_env_file", "execute_sql",
}

var fieldRunDeniedActions = []string{"git_push", "git_force_push", "run_pytest", "edit_file"}

func newReputationHandler(t *testing.T, db *sql.DB) *Handler {
	t.Helper()
	clearRiskEnv(t)
	eval := evaluator.New()
	require.NoError(t, eval.LoadPolicyBytes(reputationStarterPolicy))
	h, err := New(eval, tokens.New(tokens.Config{SigningKey: "test-key"}), confidence.New(),
		audit.New(audit.Config{Sink: &bytes.Buffer{}}), queue.NewInMemory(), "",
		ConfidenceConfig{AllowUnverifiedConfidence: true, MissingSignalMode: MissingConfidenceReview},
		EnforcementModeEnforce, nil, nil, nil, nil, db)
	require.NoError(t, err)
	return h
}

// The tables the async analytics writes, copied from initDatabase in
// cmd/engine/main.go, which this package cannot import.
const analyticsTestSchema = `
CREATE TABLE IF NOT EXISTS agent_review_reputation (
	agent_id TEXT PRIMARY KEY,
	reputation_score REAL NOT NULL DEFAULT 0.5,
	decision_count INTEGER NOT NULL DEFAULT 0,
	accuracy_rate REAL NOT NULL DEFAULT 0.0,
	calibration_score REAL NOT NULL DEFAULT 0.5,
	last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	confidence_sum REAL NOT NULL DEFAULT 0.0,
	correct_decisions INTEGER NOT NULL DEFAULT 0,
	high_conf_errors INTEGER NOT NULL DEFAULT 0,
	low_conf_correct INTEGER NOT NULL DEFAULT 0,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS behavioral_baselines (
	agent_id TEXT PRIMARY KEY,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	sample_count INTEGER NOT NULL DEFAULT 0,
	confidence_mean REAL NOT NULL DEFAULT 0.0,
	confidence_std_dev REAL NOT NULL DEFAULT 0.0,
	latency_mean REAL NOT NULL DEFAULT 0.0,
	latency_std_dev REAL NOT NULL DEFAULT 0.0,
	action_frequencies TEXT NOT NULL DEFAULT '{}',
	hourly_patterns TEXT NOT NULL DEFAULT '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]',
	decision_outcomes TEXT NOT NULL DEFAULT '{}',
	confidence_distribution TEXT NOT NULL DEFAULT '[]',
	latency_percentiles TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS agent_decisions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	agent_id TEXT NOT NULL,
	timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	action TEXT NOT NULL,
	confidence REAL NOT NULL,
	latency_ms INTEGER NOT NULL,
	outcome TEXT NOT NULL,
	was_correct BOOLEAN,
	risk_score REAL,
	human_review_required BOOLEAN DEFAULT FALSE,
	policy_version TEXT,
	trace_id TEXT,
	span_id TEXT
);
`

func openReputationDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", filepath.Join(t.TempDir(), "lelu.db"))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	return db
}

// registerAgent attaches an identity registry to h and returns a fresh agent
// ID and a workload token for it.
func registerAgent(t *testing.T, h *Handler, db *sql.DB) (string, string) {
	t.Helper()
	reg, err := identity.New(identity.Config{DB: db})
	require.NoError(t, err)
	h.SetIdentityRegistry(reg)
	ctx := context.Background()
	agent, err := reg.Register(ctx, identity.RegisterRequest{TenantID: "default", Name: "claude_code", AgentType: identity.AgentTypeAutonomous})
	require.NoError(t, err)
	tok, err := reg.IssueToken(ctx, agent.ID)
	require.NoError(t, err)
	return agent.ID, tok.Token
}

func evaluateAs(t *testing.T, h *Handler, token string, req agentAuthorizeRequest) (agentDecisionResult, bool, *httptest.ResponseRecorder) {
	t.Helper()
	rec := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/v1/agent/authorize", nil)
	if token != "" {
		r.Header.Set("X-Lelu-Agent-Token", token)
	}
	res, handled := h.evaluateAgentDecision(r.Context(), rec, r, req, nil, time.Now(), "test-input-hash")
	return res, handled, rec
}

// runFieldSequence replays the 16 earlier calls. Each call may claim a
// different actor name, to show the claimed name stops mattering once a token
// is presented.
func runFieldSequence(t *testing.T, h *Handler, token string, actorFor func(i int) string) {
	t.Helper()
	i := 0
	for _, action := range fieldRunMissingSignalActions {
		_, handled, _ := evaluateAs(t, h, token, agentAuthorizeRequest{Actor: actorFor(i), Action: action})
		require.True(t, handled, "%s without a confidence signal takes the missing-signal path", action)
		i++
	}
	for _, action := range fieldRunDeniedActions {
		res, handled, _ := evaluateAs(t, h, token, agentAuthorizeRequest{Actor: actorFor(i), Action: action, Confidence: f64(0.9)})
		require.False(t, handled)
		require.Equal(t, "denied", res.outcome, action)
		i++
	}
}

func sameActor(name string) func(int) string { return func(int) string { return name } }

func createPR(t *testing.T, h *Handler, token, actor string) agentAuthorizeResponse {
	t.Helper()
	res, handled, _ := evaluateAs(t, h, token, agentAuthorizeRequest{Actor: actor, Action: "create_pull_request", Confidence: f64(0.9)})
	require.False(t, handled)
	return res.resp
}

func TestUnverifiedFieldSequenceKeepsDefaultReliability(t *testing.T) {
	h := newReputationHandler(t, nil)
	runFieldSequence(t, h, "", sameActor("claude_code"))

	resp := createPR(t, h, "", "claude_code")
	assert.False(t, resp.ActorVerified)
	assert.Equal(t, 1.0, resp.RiskReliability, "an unverified actor's own history must not lower its reliability")
	assert.True(t, resp.Allowed)
	assert.Empty(t, resp.DowngradedScope, "create_pull_request at 0.9 is a plain allow, not read_only")
	// Unverified names must not take cache slots either, or they could
	// evict verified agents' history under pressure.
	assert.Zero(t, h.actorStat.lru.Len(), "unverified requests do not write in-memory reputation")
}

func TestRenamingUnverifiedActorDoesNotChangeReliability(t *testing.T) {
	for _, tc := range []struct {
		name string
		env  string
		want float64
	}{
		{name: "default", env: "", want: 1.0},
		{name: "configured 0.5", env: "0.5", want: 0.5},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := newReputationHandler(t, nil)
			if tc.env != "" {
				t.Setenv("RISK_UNVERIFIED_ACTOR_RELIABILITY", tc.env)
				cfg, err := NewRiskConfigFromEnv()
				require.NoError(t, err)
				h.riskModel = newRiskModel(cfg)
			}
			runFieldSequence(t, h, "", sameActor("claude_code"))

			original := createPR(t, h, "", "claude_code")
			renamed := createPR(t, h, "", "fresh_actor_1")
			assert.Equal(t, tc.want, original.RiskReliability)
			assert.Equal(t, tc.want, renamed.RiskReliability, "renaming must not change an unverified actor's reliability")
		})
	}
}

func TestVerifiedReputationFollowsAgentIDNotClaimedName(t *testing.T) {
	h := newReputationHandler(t, nil)
	_, token := registerAgent(t, h, openReputationDB(t))

	// Every call claims a new name; the token is what identifies the agent.
	runFieldSequence(t, h, token, func(i int) string { return "name_" + string(rune('a'+i)) })

	verified := createPR(t, h, token, "fresh_actor_1")
	assert.True(t, verified.ActorVerified)
	assert.Equal(t, 0.0, verified.RiskReliability, "the four denials count against the agent ID whatever name it claims")
	assert.Equal(t, "read_only", verified.DowngradedScope)

	// The verified agent's history does not attach to the name it claimed.
	unverified := createPR(t, h, "", "fresh_actor_1")
	assert.False(t, unverified.ActorVerified)
	assert.Equal(t, 1.0, unverified.RiskReliability)
	assert.Empty(t, unverified.DowngradedScope)
}

// Regression tests for https://github.com/Lelu-ai/lelu/issues/74: persisted
// reputation records human review verdicts, not the engine's own decisions.
//
// One database-backed Handler serves every subtest, since a second can't be
// built in one process (its metrics register globally). Each subtest
// registers its own agent, so their reputation rows don't overlap.
func TestReviewVerdictReputation(t *testing.T) {
	db := openReputationDB(t)
	_, err := db.Exec(analyticsTestSchema)
	require.NoError(t, err)
	h := newReputationHandler(t, db)
	authenticated := &reviewerRegistry{secrets: []reviewerCredential{{name: "alice", secret: reviewerTestSecret}}}
	h.reviewers = authenticated
	ctx := context.Background()

	newAgent := func(t *testing.T) (string, string) { return registerAgent(t, h, db) }

	// create_* is allowed by policy; "payment" makes it high-criticality, so
	// the risk gate — not the policy — routes it to a human.
	riskReview := func(t *testing.T, token, actor string) *queue.ReviewRequest {
		t.Helper()
		resp := authorizeHTTP(t, h, token, agentAuthorizeRequest{Actor: actor, Action: "create_payment", Confidence: f64(0.9)})
		require.True(t, resp.RequiresHumanReview, resp.Reason)
		require.NotEmpty(t, resp.ReviewID)
		item, err := h.queue.Get(ctx, resp.ReviewID)
		require.NoError(t, err)
		return item
	}

	t.Run("decisions are not recorded", func(t *testing.T) {
		agentID, token := newAgent(t)
		decisionRows := func() int {
			var n int
			require.NoError(t, db.QueryRowContext(ctx, `SELECT COUNT(*) FROM agent_decisions WHERE agent_id = ?`, agentID).Scan(&n))
			return n
		}
		// A policy denial for a verified agent used to be recorded as an
		// incorrect decision, so one denial set its persisted accuracy to 0.
		resp := authorizeHTTP(t, h, token, agentAuthorizeRequest{Actor: "claimed_name", Action: "git_push", Confidence: f64(0.9)})
		require.False(t, resp.Allowed)
		// The analytics goroutine has run once it writes the decision row.
		require.Eventually(t, func() bool { return decisionRows() == 1 }, 5*time.Second, 10*time.Millisecond)
		count, _ := reputationOf(t, h, agentID)
		assert.Equal(t, int64(0), count, "the engine's own decision is not a reputation outcome")
	})

	t.Run("verdicts are recorded against the verified agent", func(t *testing.T) {
		agentID, token := newAgent(t)

		item := riskReview(t, token, "claimed_name")
		require.Equal(t, agentID, item.ReputationActor, "the verdict counts toward the verified agent ID, not the claimed name")
		resolveAs(t, h, item.ID, true, reviewerTestSecret)
		count, correct := reputationOf(t, h, agentID)
		assert.Equal(t, int64(1), count)
		assert.Equal(t, int64(1), correct, "an approval counts as correct")

		resolveAs(t, h, riskReview(t, token, "claimed_name").ID, false, reviewerTestSecret)
		count, correct = reputationOf(t, h, agentID)
		assert.Equal(t, int64(2), count)
		assert.Equal(t, int64(1), correct, "a denial counts as incorrect")

		claimed, _ := reputationOf(t, h, "claimed_name")
		assert.Equal(t, int64(0), claimed)
	})

	t.Run("self-asserted reviewer is not counted", func(t *testing.T) {
		agentID, token := newAgent(t)
		h.reviewers = nil // LELU_REVIEWER_KEYS unset: resolved_by is a claim
		defer func() { h.reviewers = authenticated }()
		resolveAs(t, h, riskReview(t, token, "a").ID, true, "")
		count, _ := reputationOf(t, h, agentID)
		assert.Equal(t, int64(0), count, "an agent could approve its own item under another name")
	})

	t.Run("unverified actor is not counted", func(t *testing.T) {
		item := riskReview(t, "", "unverified_bot")
		assert.Empty(t, item.ReputationActor)
		resolveAs(t, h, item.ID, false, reviewerTestSecret)
		count, _ := reputationOf(t, h, "unverified_bot")
		assert.Equal(t, int64(0), count)
	})

	t.Run("policy review is not counted", func(t *testing.T) {
		agentID, token := newAgent(t)
		// send_* is a human_review rule: the verdict is about the action.
		resp := authorizeHTTP(t, h, token, agentAuthorizeRequest{Actor: "a", Action: "send_email", Confidence: f64(0.9)})
		require.True(t, resp.RequiresHumanReview)
		item, err := h.queue.Get(ctx, resp.ReviewID)
		require.NoError(t, err)
		assert.Empty(t, item.ReputationActor)
		resolveAs(t, h, item.ID, false, reviewerTestSecret)
		count, _ := reputationOf(t, h, agentID)
		assert.Equal(t, int64(0), count)
	})

	// Persisted reputation only replaces the in-memory reliability once
	// there are MinDecisionsForScore verdicts: one denied review must not
	// set it to 0.
	t.Run("reliability needs the minimum number of verdicts", func(t *testing.T) {
		agentID, token := newAgent(t)
		minVerdicts := int(observability.DefaultReputationConfig().MinDecisionsForScore)

		for i := 0; i < minVerdicts-1; i++ {
			require.NoError(t, h.reputationMgr.RecordDecision(ctx, agentID, "autonomous", 0.9, false, "review:deny"))
		}
		// Empty the in-memory stats, as a restart would.
		h.actorStat = newActorStats()
		assert.Equal(t, 1.0, createPR(t, h, token, "claimed_name").RiskReliability,
			"below the minimum, reliability stays at the in-memory value")

		require.NoError(t, h.reputationMgr.RecordDecision(ctx, agentID, "autonomous", 0.9, false, "review:deny"))
		h.actorStat = newActorStats()
		assert.Equal(t, 0.0, createPR(t, h, token, "claimed_name").RiskReliability,
			"at the minimum, the verdict history is the reliability")

		// A self-reported name equal to that agent ID does not read its history.
		assert.Equal(t, 1.0, createPR(t, h, "", agentID).RiskReliability)
	})
}

const reviewerTestSecret = "alice-reviewer-secret-0123456789"

// authorizeHTTP runs a request through handleAgentAuthorize, which is the
// path that enqueues reviews and fires the async analytics.
func authorizeHTTP(t *testing.T, h *Handler, token string, req agentAuthorizeRequest) agentAuthorizeResponse {
	t.Helper()
	body, err := json.Marshal(req)
	require.NoError(t, err)
	r := httptest.NewRequest(http.MethodPost, "/v1/agent/authorize", bytes.NewReader(body))
	if token != "" {
		r.Header.Set("X-Lelu-Agent-Token", token)
	}
	rec := httptest.NewRecorder()
	h.handleAgentAuthorize(rec, r)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var resp agentAuthorizeResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	return resp
}

// resolveAs approves or denies a review as the operator, presenting the
// reviewer secret when it is non-empty.
func resolveAs(t *testing.T, h *Handler, id string, approve bool, reviewerSecret string) {
	t.Helper()
	path := "/v1/queue/" + id + "/deny"
	if approve {
		path = "/v1/queue/" + id + "/approve"
	}
	r := httptest.NewRequest(http.MethodPost, path, bytes.NewBufferString(`{"resolved_by":"human","note":"test"}`))
	r.SetPathValue("id", id)
	if reviewerSecret != "" {
		r.Header.Set(reviewerHeader, reviewerSecret)
	}
	r = r.WithContext(withPrincipal(r.Context(), Principal{IsStaticAdminKey: true}))
	rec := httptest.NewRecorder()
	h.handleQueueResolve(rec, r, approve)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
}

func reputationOf(t *testing.T, h *Handler, agentID string) (count, correct int64) {
	t.Helper()
	rep, err := h.reputationMgr.GetReputation(context.Background(), agentID)
	require.NoError(t, err)
	return rep.DecisionCount, rep.CorrectDecisions
}

func TestUnverifiedActorReliabilityFromEnv(t *testing.T) {
	for _, tc := range []struct {
		env  string
		want float64
	}{
		{env: "", want: 1.0},
		{env: "0.5", want: 0.5},
		{env: "0", want: 0},
		// Out of range or unparseable keeps the default, like the other
		// RISK_* floats.
		{env: "1.5", want: 1.0},
		{env: "half", want: 1.0},
		{env: "NaN", want: 1.0},
	} {
		clearRiskEnv(t)
		t.Setenv("RISK_UNVERIFIED_ACTOR_RELIABILITY", tc.env)
		cfg, err := NewRiskConfigFromEnv()
		require.NoError(t, err)
		assert.Equal(t, tc.want, cfg.UnverifiedActorReliability, "RISK_UNVERIFIED_ACTOR_RELIABILITY=%q", tc.env)
	}
}
