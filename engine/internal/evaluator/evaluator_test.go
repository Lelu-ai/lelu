package evaluator_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-ai/lelu/engine/internal/evaluator"
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

// TestEvaluateAgent_HardDenyFiresRegardlessOfConstraintOrder guards against a
// bug where a low-confidence request should hard-deny, but a looser
// constraint (downgrade_to_read_only) listed earlier in the policy file
// caught it and returned first, so hard_deny_if_confidence_below never fired.
// samplePolicy lists require_human_approval, then downgrade, then hard_deny
// (matching the real config/auth.yaml's order) — confidence 0.10 is below
// all three, so only the strictest (hard deny) should win.
func TestEvaluateAgent_HardDenyFiresRegardlessOfConstraintOrder(t *testing.T) {
	e := newEval(t)
	dec, err := e.EvaluateAgent(context.Background(), evaluator.AgentAuthRequest{
		Actor:      "invoice_bot",
		Action:     "approve_refunds",
		Confidence: 0.10,
	})
	require.NoError(t, err)
	assert.False(t, dec.Allowed)
	assert.Empty(t, dec.DowngradedScope, "hard deny must win outright, not present as a read-only downgrade")
	assert.False(t, dec.RequiresHumanReview)
	assert.Contains(t, dec.Reason, "hard-deny")
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

// ── Wildcard matching ────────────────────────────────────────────────────────

var wildcardPolicy = []byte(`
version: "1.0"
roles:
  finance_manager:
    allow:
      - "*"

agent_scopes:
  invoice_bot:
    inherits: finance_manager
    compute:
      - action: write_*_prod
        safe_tool: write_file
        safe_args:
          sandboxed: true
      - action: a_*_b_*_c
        safe_tool: multi_wildcard_tool
`)

func newWildcardEval(t *testing.T) *evaluator.Evaluator {
	t.Helper()
	e := evaluator.New()
	require.NoError(t, e.LoadPolicyBytes(wildcardPolicy))
	return e
}

func TestEvaluateAgent_MidStringWildcard_Matches(t *testing.T) {
	e := newWildcardEval(t)
	dec, err := e.EvaluateAgent(context.Background(), evaluator.AgentAuthRequest{
		Actor:  "invoice_bot",
		Action: "write_users_prod",
	})
	require.NoError(t, err)
	assert.True(t, dec.Compute)
	assert.Equal(t, "write_file", dec.SafeTool)
}

func TestEvaluateAgent_MidStringWildcard_DoesNotMatchWrongSuffix(t *testing.T) {
	e := newWildcardEval(t)
	dec, err := e.EvaluateAgent(context.Background(), evaluator.AgentAuthRequest{
		Actor:  "invoice_bot",
		Action: "write_users_dev",
	})
	require.NoError(t, err)
	assert.False(t, dec.Compute)
}

func TestEvaluateAgent_MultipleMidStringWildcards_Matches(t *testing.T) {
	e := newWildcardEval(t)
	dec, err := e.EvaluateAgent(context.Background(), evaluator.AgentAuthRequest{
		Actor:  "invoice_bot",
		Action: "a_XX_b_YY_c",
	})
	require.NoError(t, err)
	assert.True(t, dec.Compute)
	assert.Equal(t, "multi_wildcard_tool", dec.SafeTool)
}

func TestEvaluateAgent_MultipleMidStringWildcards_RequiresOrder(t *testing.T) {
	e := newWildcardEval(t)
	dec, err := e.EvaluateAgent(context.Background(), evaluator.AgentAuthRequest{
		Actor:  "invoice_bot",
		Action: "a_XX_c_YY_b", // "_b_" and "_c_" out of order — must not match
	})
	require.NoError(t, err)
	assert.False(t, dec.Compute)
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
