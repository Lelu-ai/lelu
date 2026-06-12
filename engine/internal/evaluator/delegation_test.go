package evaluator_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-auth/lelu/engine/internal/evaluator"
)

var delegationPolicy = []byte(`
version: "1.0"
roles:
  finance_manager:
    allow:
      - view_invoices
      - approve_refunds
      - research
      - read_reports
    deny: []

  read_only_auditor:
    allow:
      - view_invoices
    deny: []

agent_scopes:
  orchestrator_agent:
    inherits: finance_manager
    constraints:
      - require_human_approval_if_confidence_below: 0.90
    can_delegate:
      - to: research_agent
        scoped_to:
          - research
          - read_reports
        max_ttl_seconds: 300
        require_confidence_above: 0.85

  research_agent:
    inherits: read_only_auditor
    constraints:
      - hard_deny_if_confidence_below: 0.50
    deny:
      - approve_refunds
`)

func newDelegationEval(t *testing.T) *evaluator.Evaluator {
	t.Helper()
	e := evaluator.New()
	require.NoError(t, e.LoadPolicyBytes(delegationPolicy))
	return e
}

func TestCheckDelegation_Allowed(t *testing.T) {
	e := newDelegationEval(t)
	dec, err := e.CheckDelegation(context.Background(), "orchestrator_agent", "research_agent", []string{"research"}, 0.92)
	require.NoError(t, err)
	assert.True(t, dec.Allowed, "expected delegation to be allowed")
	assert.Contains(t, dec.GrantedScopes, "research")
	assert.Equal(t, int64(300), dec.MaxTTL)
}

func TestCheckDelegation_AllGrantedScopesWhenNoneRequested(t *testing.T) {
	e := newDelegationEval(t)
	dec, err := e.CheckDelegation(context.Background(), "orchestrator_agent", "research_agent", nil, 0.92)
	require.NoError(t, err)
	assert.True(t, dec.Allowed)
	// Should return all scopes from the rule when none requested.
	assert.ElementsMatch(t, []string{"research", "read_reports"}, dec.GrantedScopes)
}

func TestCheckDelegation_ConfidenceTooLow(t *testing.T) {
	e := newDelegationEval(t)
	dec, err := e.CheckDelegation(context.Background(), "orchestrator_agent", "research_agent", []string{"research"}, 0.80)
	require.NoError(t, err)
	assert.False(t, dec.Allowed, "expected delegation to fail due to low confidence")
	assert.Contains(t, dec.Reason, "confidence")
}

func TestCheckDelegation_ScopeNotPermitted(t *testing.T) {
	e := newDelegationEval(t)
	// "approve_refunds" is not in the delegation rule's scoped_to list.
	dec, err := e.CheckDelegation(context.Background(), "orchestrator_agent", "research_agent", []string{"approve_refunds"}, 0.92)
	require.NoError(t, err)
	assert.False(t, dec.Allowed)
	assert.Contains(t, dec.Reason, "approve_refunds")
}

func TestCheckDelegation_NoDelegationRuleForDelegatee(t *testing.T) {
	e := newDelegationEval(t)
	// orchestrator_agent has no rule for "unknown_bot".
	dec, err := e.CheckDelegation(context.Background(), "orchestrator_agent", "unknown_bot", nil, 0.95)
	require.NoError(t, err)
	assert.False(t, dec.Allowed)
}

func TestCheckDelegation_UnknownDelegator(t *testing.T) {
	e := newDelegationEval(t)
	dec, err := e.CheckDelegation(context.Background(), "rogue_agent", "research_agent", nil, 0.95)
	require.NoError(t, err)
	assert.False(t, dec.Allowed)
	assert.Contains(t, dec.Reason, "unknown delegator")
}
