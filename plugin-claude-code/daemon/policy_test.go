package daemon

import "testing"

func loadTestPolicy(t *testing.T) *PolicySet {
	t.Helper()
	ps, err := LoadPolicySet("../policies/defaults.json")
	if err != nil {
		t.Fatalf("failed to load default policy set: %v", err)
	}
	return ps
}

func TestEvaluate_HomeDirWipeDenied(t *testing.T) {
	ps := loadTestPolicy(t)
	a := AnalyzeCommand("rm -rf ~/", "/home/testuser", testEnv("/home/testuser"))
	d := ps.Evaluate(a, "/home/testuser")
	if d.Outcome != OutcomeDeny {
		t.Errorf("outcome = %q, want deny; decision=%+v", d.Outcome, d)
	}
}

func TestEvaluate_SudoHomeDirWipeDenied(t *testing.T) {
	ps := loadTestPolicy(t)
	a := AnalyzeCommand("sudo rm -rf $HOME", "/home/testuser", testEnv("/home/testuser"))
	d := ps.Evaluate(a, "/home/testuser")
	if d.Outcome != OutcomeDeny {
		t.Errorf("outcome = %q, want deny; decision=%+v", d.Outcome, d)
	}
}

func TestEvaluate_BenignSubdirDeleteAllowed(t *testing.T) {
	ps := loadTestPolicy(t)
	a := AnalyzeCommand("rm -rf node_modules", "/home/testuser/project", testEnv("/home/testuser"))
	d := ps.Evaluate(a, "/home/testuser")
	if d.Outcome != OutcomeAllow {
		t.Errorf("outcome = %q, want allow (should not nag on routine cleanup); decision=%+v", d.Outcome, d)
	}
}

func TestEvaluate_ProtectedFileDeleteDenied(t *testing.T) {
	ps := loadTestPolicy(t)
	a := AnalyzeCommand("rm -rf .env", "/home/testuser/project", testEnv("/home/testuser"))
	d := ps.Evaluate(a, "/home/testuser")
	if d.Outcome != OutcomeDeny {
		t.Errorf("outcome = %q, want deny for .env; decision=%+v", d.Outcome, d)
	}
}

func TestEvaluate_ForcePushAsksForReview(t *testing.T) {
	ps := loadTestPolicy(t)
	a := AnalyzeCommand("git push --force origin main", "/home/testuser/project", testEnv("/home/testuser"))
	d := ps.Evaluate(a, "/home/testuser")
	if d.Outcome != OutcomeAsk {
		t.Errorf("outcome = %q, want ask for force-push; decision=%+v", d.Outcome, d)
	}
}

func TestEvaluate_PlainPushAllowed(t *testing.T) {
	ps := loadTestPolicy(t)
	a := AnalyzeCommand("git push origin main", "/home/testuser/project", testEnv("/home/testuser"))
	d := ps.Evaluate(a, "/home/testuser")
	if d.Outcome != OutcomeAllow {
		t.Errorf("outcome = %q, want allow for a plain push; decision=%+v", d.Outcome, d)
	}
}

func TestEvaluate_DynamicContentAsksForReview(t *testing.T) {
	ps := loadTestPolicy(t)
	a := AnalyzeCommand(`rm -rf "$(echo pwned)"`, "/home/testuser", testEnv("/home/testuser"))
	d := ps.Evaluate(a, "/home/testuser")
	if d.Outcome != OutcomeAsk {
		t.Errorf("outcome = %q, want ask for unresolvable dynamic content; decision=%+v", d.Outcome, d)
	}
}

func TestEvaluate_BenignCommandAllowed(t *testing.T) {
	ps := loadTestPolicy(t)
	a := AnalyzeCommand("echo hello", "/tmp", testEnv("/home/testuser"))
	d := ps.Evaluate(a, "/home/testuser")
	if d.Outcome != OutcomeAllow {
		t.Errorf("outcome = %q, want allow; decision=%+v", d.Outcome, d)
	}
}
