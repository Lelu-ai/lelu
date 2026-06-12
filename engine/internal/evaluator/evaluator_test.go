package evaluator_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-auth/lelu/engine/internal/evaluator"
)

var samplePolicy = []byte(`
version: "1.0"
roles:
  finance_manager:
    allow:
      - view_invoices
      - approve_refunds
    deny:
      - delete_invoices

agent_scopes:
  invoice_bot:
    inherits: finance_manager
    constraints:
      - max_refund_amount: 50.0
      - require_human_approval_if_confidence_below: 0.90
      - downgrade_to_read_only_if_confidence_below: 0.70
      - hard_deny_if_confidence_below: 0.50
    deny:
      - delete_invoices
`)

func newEval(t *testing.T) *evaluator.Evaluator {
	t.Helper()
	e := evaluator.New()
	require.NoError(t, e.LoadPolicyBytes(samplePolicy))
	return e
}

// ── Human auth ────────────────────────────────────────────────────────────────

func TestEvaluate_AllowedAction(t *testing.T) {
	e := newEval(t)
	dec, err := e.Evaluate(context.Background(), evaluator.AuthRequest{
		UserID: "user_123",
		Action: "approve_refunds",
	})
	require.NoError(t, err)
	assert.True(t, dec.Allowed)
}

func TestEvaluate_DeniedAction(t *testing.T) {
	e := newEval(t)
	dec, err := e.Evaluate(context.Background(), evaluator.AuthRequest{
		UserID: "user_123",
		Action: "delete_invoices",
	})
	require.NoError(t, err)
	assert.False(t, dec.Allowed)
}

func TestEvaluate_UnknownAction(t *testing.T) {
	e := newEval(t)
	dec, err := e.Evaluate(context.Background(), evaluator.AuthRequest{
		UserID: "user_123",
		Action: "wire_transfer",
	})
	require.NoError(t, err)
	assert.False(t, dec.Allowed)
}

// ── Agent auth ────────────────────────────────────────────────────────────────

func TestEvaluateAgent_FullConfidence(t *testing.T) {
	e := newEval(t)
	dec, err := e.EvaluateAgent(context.Background(), evaluator.AgentAuthRequest{
		Actor:      "invoice_bot",
		Action:     "approve_refunds",
		Confidence: 0.95,
	})
	require.NoError(t, err)
	assert.True(t, dec.Allowed)
	assert.False(t, dec.RequiresHumanReview)
	assert.Empty(t, dec.DowngradedScope)
}

func TestEvaluateAgent_RequiresHumanApproval(t *testing.T) {
	e := newEval(t)
	dec, err := e.EvaluateAgent(context.Background(), evaluator.AgentAuthRequest{
		Actor:      "invoice_bot",
		Action:     "approve_refunds",
		Confidence: 0.80,
	})
	require.NoError(t, err)
	assert.True(t, dec.RequiresHumanReview)
}

func TestEvaluateAgent_DowngradedToReadOnly(t *testing.T) {
	e := newEval(t)
	dec, err := e.EvaluateAgent(context.Background(), evaluator.AgentAuthRequest{
		Actor:      "invoice_bot",
		Action:     "approve_refunds",
		Confidence: 0.65,
	})
	require.NoError(t, err)
	assert.False(t, dec.Allowed)
	assert.Equal(t, "read_only", dec.DowngradedScope)
}

func TestEvaluateAgent_HardDeny(t *testing.T) {
	e := newEval(t)
	dec, err := e.EvaluateAgent(context.Background(), evaluator.AgentAuthRequest{
		Actor:      "invoice_bot",
		Action:     "approve_refunds",
		Confidence: 0.40,
	})
	require.NoError(t, err)
	assert.False(t, dec.Allowed)
}

func TestEvaluateAgent_ExplicitDeny(t *testing.T) {
	e := newEval(t)
	dec, err := e.EvaluateAgent(context.Background(), evaluator.AgentAuthRequest{
		Actor:      "invoice_bot",
		Action:     "delete_invoices",
		Confidence: 1.0,
	})
	require.NoError(t, err)
	assert.False(t, dec.Allowed)
}

func TestEvaluateAgent_UnknownAgent(t *testing.T) {
	e := newEval(t)
	dec, err := e.EvaluateAgent(context.Background(), evaluator.AgentAuthRequest{
		Actor:  "rogue_bot",
		Action: "approve_refunds",
	})
	require.NoError(t, err)
	assert.False(t, dec.Allowed)
}

// ── Hot-reload ────────────────────────────────────────────────────────────────

func TestLoadPolicyBytes_HotSwap(t *testing.T) {
	e := newEval(t)

	// Action allowed by original policy
	dec, err := e.Evaluate(context.Background(), evaluator.AuthRequest{Action: "approve_refunds"})
	require.NoError(t, err)
	assert.True(t, dec.Allowed)

	// Swap in a restrictive policy
	err = e.LoadPolicyBytes([]byte(`version: "1.0"
roles:
  minimal:
    allow: [view_invoices]
`))
	require.NoError(t, err)

	dec, err = e.Evaluate(context.Background(), evaluator.AuthRequest{Action: "approve_refunds"})
	require.NoError(t, err)
	assert.False(t, dec.Allowed)
}
