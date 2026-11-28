package evaluator

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A compute decision tells the caller to run safe_tool instead of the action
// it asked for. A compute rule with no safe_tool must not load, whichever way
// it is written.
func TestComputeRuleWithoutSafeToolRejectedAtLoad(t *testing.T) {
	cases := map[string]struct {
		policy  string
		wantErr string
	}{
		"top-level rule": {
			policy:  "rules:\n  - id: redirect\n    match: deploy_*\n    decision: compute\n",
			wantErr: `rules[0] ("redirect"): a compute rule needs safe_tool`,
		},
		"top-level rule with blank safe_tool": {
			policy:  "rules:\n  - id: redirect\n    match: deploy_*\n    decision: compute\n    safe_tool: \"  \"\n",
			wantErr: `rules[0] ("redirect"): a compute rule needs safe_tool`,
		},
		"agent scope rule": {
			policy: `
version: "1.0"
roles:
  base:
    allow: ["*"]
agent_scopes:
  deploy_bot:
    inherits: base
    compute:
      - action: deploy_*
        safe_tool: deploy
      - action: write_*_prod
        safe_args:
          sandboxed: true
`,
			wantErr: `agent_scopes.deploy_bot.compute[1] (action "write_*_prod"): a compute rule needs safe_tool`,
		},
		"agent scope rule with blank safe_tool": {
			policy: `
agent_scopes:
  deploy_bot:
    compute:
      - action: deploy_*
        safe_tool: ""
`,
			wantErr: `agent_scopes.deploy_bot.compute[0] (action "deploy_*"): a compute rule needs safe_tool`,
		},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			err := New().LoadPolicyBytes([]byte(c.policy))
			if err == nil {
				t.Fatal("expected a load error")
			}
			if !strings.Contains(err.Error(), c.wantErr) {
				t.Fatalf("error %q does not contain %q", err, c.wantErr)
			}
		})
	}
}

// If a compute decision without a safe tool is ever produced anyway, the
// evaluator denies rather than returning compute. The policy is installed
// directly here to get past load-time validation.
func TestComputeDecisionWithoutSafeToolIsDenied(t *testing.T) {
	cases := map[string]*Policy{
		"top-level rule": {
			Rules: []PatternRule{{ID: "redirect", Match: "deploy_*", Decision: "compute"}},
		},
		"agent scope rule": {
			Roles: map[string]Role{"base": {Allow: []string{"*"}}},
			AgentScopes: map[string]AgentScope{
				"deploy_bot": {Inherits: "base", Compute: []ComputeRule{{Action: "deploy_*"}}},
			},
		},
	}
	for name, p := range cases {
		t.Run(name, func(t *testing.T) {
			e := New()
			e.policy = p
			d, err := e.EvaluateAgent(context.Background(), AgentAuthRequest{Actor: "deploy_bot", Action: "deploy_prod", Confidence: 1})
			if err != nil {
				t.Fatal(err)
			}
			if d.Allowed || d.Compute {
				t.Fatalf("got allowed=%v compute=%v, want a deny", d.Allowed, d.Compute)
			}
			if !strings.Contains(d.Reason, "no safe_tool") {
				t.Fatalf("reason %q does not explain the deny", d.Reason)
			}
		})
	}

	// A compute rule that names a tool still redirects.
	e := New()
	e.policy = &Policy{
		Roles: map[string]Role{"base": {Allow: []string{"*"}}},
		AgentScopes: map[string]AgentScope{
			"deploy_bot": {Inherits: "base", Compute: []ComputeRule{{Action: "deploy_*", SafeTool: "deploy"}}},
		},
	}
	d, err := e.EvaluateAgent(context.Background(), AgentAuthRequest{Actor: "deploy_bot", Action: "deploy_prod", Confidence: 1})
	if err != nil {
		t.Fatal(err)
	}
	if !d.Allowed || !d.Compute || d.SafeTool != "deploy" {
		t.Fatalf("got allowed=%v compute=%v safe_tool=%q, want a compute redirect to deploy", d.Allowed, d.Compute, d.SafeTool)
	}
}

// The policies shipped in the repo, all of which use compute rules, still load.
func TestShippedPoliciesLoad(t *testing.T) {
	for _, rel := range []string{
		"../../../config/auth.yaml",
		"../../../examples/quickstart/policy.yaml",
	} {
		path := filepath.FromSlash(rel)
		if _, err := os.Stat(path); err != nil {
			t.Fatalf("%s: %v", rel, err)
		}
		if err := New().LoadPolicy(path); err != nil {
			t.Errorf("%s: %v", rel, err)
		}
	}
}
