package evaluator

import (
	"context"
	"strings"
	"testing"
)

// Regression tests for findings from the November 2026 security audit
// (POL-09, POL-10, POL-12).

const auditPolicy = `
version: "1.0"
roles:
  refunds:
    allow: [approve_refunds, read_invoices]
agent_scopes:
  limited_bot:
    inherits: refunds
    constraints:
      - max_refund_amount: 50.00
  deny_only_bot:
    deny: [delete_docs]
`

func loadAudit(t *testing.T, y string) *Evaluator {
	t.Helper()
	e := New()
	if err := e.LoadPolicyBytes([]byte(y)); err != nil {
		t.Fatalf("load: %v", err)
	}
	return e
}

// POL-10: a scope with only a deny list must not default to allow.
func TestScopeWithoutInheritsPermitsNothing(t *testing.T) {
	e := loadAudit(t, auditPolicy)
	for _, action := range []string{"summarise_docs", "send_all_funds_abroad", "read_invoices"} {
		d, err := e.EvaluateAgent(context.Background(), AgentAuthRequest{Actor: "deny_only_bot", Action: action, Confidence: 1})
		if err != nil {
			t.Fatal(err)
		}
		if d.Allowed {
			t.Errorf("action %q was allowed for a scope with no inherits", action)
		}
		if !strings.Contains(d.Reason, "no `inherits`") && action != "delete_docs" {
			t.Errorf("unexpected reason %q", d.Reason)
		}
	}
}

// POL-09: max_refund_amount is enforced against args.amount.
func TestMaxRefundAmountRequiresReview(t *testing.T) {
	e := loadAudit(t, auditPolicy)
	cases := []struct {
		name   string
		args   map[string]interface{}
		review bool
	}{
		{"under limit", map[string]interface{}{"amount": 10.0}, false},
		{"at limit", map[string]interface{}{"amount": 50.0}, false},
		{"over limit", map[string]interface{}{"amount": 5000000.0}, true},
		{"over limit as string", map[string]interface{}{"amount": "75.50"}, true},
		{"no amount supplied", nil, false},
	}
	for _, c := range cases {
		d, err := e.EvaluateAgent(context.Background(), AgentAuthRequest{Actor: "limited_bot", Action: "approve_refunds", Confidence: 1, Args: c.args})
		if err != nil {
			t.Fatal(err)
		}
		if d.RequiresHumanReview != c.review {
			t.Errorf("%s: RequiresHumanReview=%v, want %v (%s)", c.name, d.RequiresHumanReview, c.review, d.Reason)
		}
	}
	// A non-refund action with a large amount is not affected by the refund limit.
	d, _ := e.EvaluateAgent(context.Background(), AgentAuthRequest{Actor: "limited_bot", Action: "read_invoices", Confidence: 1, Args: map[string]interface{}{"amount": 1e9}})
	if d.RequiresHumanReview {
		t.Errorf("read_invoices should not be subject to the refund limit")
	}
}

// POL-12: invalid rule definitions are rejected at load time.
func TestInvalidRuleRejectedAtLoad(t *testing.T) {
	bad := map[string]string{
		"misspelt decision": "rules:\n  - id: a\n    match: wire_*\n    decision: alow\n",
		"missing match":     "rules:\n  - id: a\n    decision: deny\n",
		"compute no tool":   "rules:\n  - id: a\n    match: x\n    decision: compute\n",
	}
	for name, y := range bad {
		if err := New().LoadPolicyBytes([]byte(y)); err == nil {
			t.Errorf("%s: expected a load error", name)
		}
	}
	ok := "rules:\n  - id: a\n    match: x\n    decision: human_review\n"
	if err := New().LoadPolicyBytes([]byte(ok)); err != nil {
		t.Errorf("valid rule rejected: %v", err)
	}
}
