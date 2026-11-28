package daemon

import "testing"

// An agent must not be able to switch Lelu off quietly by changing its own
// files (#118). Changes are routed to review; reads stay quiet.
func TestEvaluate_SelfProtection(t *testing.T) {
	cases := []struct {
		cmd  string
		want Outcome
	}{
		{"echo shadow > ~/.lelu/claude-plugin/mode", OutcomeAsk},
		{"printf shadow >| $HOME/.lelu/claude-plugin/mode", OutcomeAsk},
		{"rm ~/.lelu/claude-plugin/bin/0.2.1/lelu-hook", OutcomeAsk},
		{"rm ~/.lelu/claude-plugin/ledger.jsonl", OutcomeAsk},
		{"sed -i s/x/y/ ~/.claude/plugins/cache/lelu/lelu/0.2.1/hooks/hooks.json", OutcomeAsk},
		{"tee ~/.claude/settings.json", OutcomeAsk},
		{"sudo cp /tmp/x .claude/settings.local.json", OutcomeAsk},
		{"cat ~/.lelu/claude-plugin/mode", OutcomeAllow},
		{"tail -n 5 ~/.lelu/claude-plugin/ledger.jsonl", OutcomeAllow},
		{"ls ~/.claude/plugins/", OutcomeAllow},
		{"echo hello > notes.txt", OutcomeAllow},
	}
	ps := loadTestPolicy(t)
	for _, tc := range cases {
		t.Run(tc.cmd, func(t *testing.T) {
			a := AnalyzeCommand(tc.cmd, "/home/testuser/project", testEnv("/home/testuser"))
			if d := ps.Evaluate(a, "/home/testuser"); d.Outcome != tc.want {
				t.Errorf("outcome = %q, want %q; decision=%+v", d.Outcome, tc.want, d)
			}
		})
	}
}

func TestEngine_SelfProtectionForFileTools(t *testing.T) {
	cases := []struct {
		req  Request
		want Outcome
	}{
		{Request{Tool: "Write", FilePath: "/home/testuser/.lelu/claude-plugin/mode"}, OutcomeAsk},
		{Request{Tool: "Write", FilePath: "/home/testuser/.lelu/claude-plugin/policy.local.json"}, OutcomeAsk},
		{Request{Tool: "Edit", FilePath: "/home/testuser/project/.claude/settings.local.json"}, OutcomeAsk},
		{Request{Tool: "MultiEdit", FilePath: "/home/testuser/.claude/plugins/cache/lelu/lelu/0.2.1/policies/defaults.json"}, OutcomeAsk},
		{Request{Tool: "Read", FilePath: "/home/testuser/.lelu/claude-plugin/ledger.jsonl"}, OutcomeAllow},
		{Request{Tool: "Write", FilePath: "/home/testuser/project/main.go"}, OutcomeAllow},
	}
	for _, tc := range cases {
		t.Run(tc.req.Tool+" "+tc.req.FilePath, func(t *testing.T) {
			engine, _ := newTestEngine(t, false)
			tc.req.SessionID = "s"
			tc.req.Env = map[string]string{"HOME": "/home/testuser"}
			if got := engine.Decide(tc.req); got.Outcome != tc.want {
				t.Errorf("outcome = %q, want %q; response=%+v", got.Outcome, tc.want, got)
			}
		})
	}
}

func TestGuardPath_CustomDataDir(t *testing.T) {
	ps := loadTestPolicy(t)
	a := AnalyzeCommand("echo shadow > /srv/lelu-data/mode", "/tmp", testEnv("/home/testuser"))
	if d := ps.Evaluate(a, "/home/testuser"); d.Outcome != OutcomeAllow {
		t.Fatalf("precondition: /srv/lelu-data is not guarded by default; decision=%+v", d)
	}
	ps.GuardPath("/srv/lelu-data")
	if d := ps.Evaluate(a, "/home/testuser"); d.Outcome != OutcomeAsk {
		t.Errorf("outcome = %q, want ask once the custom data dir is guarded; decision=%+v", d.Outcome, d)
	}
}
