package server

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-ai/lelu/engine/internal/audit"
	"github.com/lelu-ai/lelu/engine/internal/confidence"
	"github.com/lelu-ai/lelu/engine/internal/evaluator"
	"github.com/lelu-ai/lelu/engine/internal/queue"
	"github.com/lelu-ai/lelu/engine/internal/tokens"
)

// Mirrors the lelu-mcp starter policy shape: top-level rules, default deny.
var missingSignalStarterPolicy = []byte(`version: "1.0"
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
  - id: default-deny
    match: "*"
    decision: deny
    reason: "Default-deny: no rule allows this action."
`)

func newStarterPolicyHandler(t *testing.T) (*Handler, *queue.Queue) {
	t.Helper()
	clearRiskEnv(t)
	eval := evaluator.New()
	require.NoError(t, eval.LoadPolicyBytes(missingSignalStarterPolicy))
	q := queue.NewInMemory()
	h, err := New(eval, tokens.New(tokens.Config{SigningKey: "test-key"}), confidence.New(),
		audit.New(audit.Config{Sink: &bytes.Buffer{}}), q, "",
		ConfidenceConfig{AllowUnverifiedConfidence: true, MissingSignalMode: MissingConfidenceReview},
		EnforcementModeEnforce, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	return h, q
}

// Omitting confidence must not turn a policy deny into an approvable review.
func TestMissingSignal_PolicyDenyStaysDeny(t *testing.T) {
	h, _ := newStarterPolicyHandler(t)
	for _, action := range []string{"delete_table", "drop_database"} {
		_, handled, rec := evaluate(t, h, agentAuthorizeRequest{Actor: "agent", Action: action})
		require.True(t, handled)
		resp := decodeResp(t, rec)
		assert.False(t, resp.Allowed, action)
		assert.False(t, resp.RequiresHumanReview, "%s: a policy deny must not become a review", action)
		assert.Empty(t, resp.ReviewID, "%s: no review item may be enqueued for a policy deny", action)
	}
}

// When the policy itself asks for a human, the review carries the policy's
// reason rather than only the missing-signal one.
func TestMissingSignal_PolicyReviewKeepsPolicyReason(t *testing.T) {
	h, _ := newStarterPolicyHandler(t)
	_, handled, rec := evaluate(t, h, agentAuthorizeRequest{Actor: "agent", Action: "send_email"})
	require.True(t, handled)
	resp := decodeResp(t, rec)
	assert.True(t, resp.RequiresHumanReview)
	assert.NotEmpty(t, resp.ReviewID)
	assert.Contains(t, resp.Reason, "Outbound communication requires human sign-off.")
	assert.NotContains(t, resp.Reason, "set CONFIDENCE_MISSING_MODE=review",
		"the hint must not tell the user to set the mode that is already active")
}

// A policy allow without a confidence signal still falls back to the
// configured missing-signal mode.
func TestMissingSignal_PolicyAllowStillUsesMissingMode(t *testing.T) {
	h, _ := newStarterPolicyHandler(t)
	_, handled, rec := evaluate(t, h, agentAuthorizeRequest{Actor: "agent", Action: "read_file"})
	require.True(t, handled)
	resp := decodeResp(t, rec)
	assert.True(t, resp.RequiresHumanReview)
	assert.Contains(t, resp.Reason, "no confidence signal detected")
}
