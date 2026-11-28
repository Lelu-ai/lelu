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

func TestEvaluate_DynamicContentOnDestructiveCommandAsksForReview(t *testing.T) {
	ps := loadTestPolicy(t)
	a := AnalyzeCommand(`rm -rf "$(echo pwned)"`, "/home/testuser", testEnv("/home/testuser"))
	d := ps.Evaluate(a, "/home/testuser")
	if d.Outcome != OutcomeAsk {
		t.Errorf("outcome = %q, want ask when unresolvable content hides inside a destructive command; decision=%+v", d.Outcome, d)
	}
}

// TestEvaluate_DynamicContentOnBenignCommandAllowed guards against the exact
// false positive found while dogfooding this: ordinary command substitution
// in a totally harmless command (counting lines, printing a date, etc.) has
// nothing destructive for the unresolved part to hide inside, so it should
// not nag for review just because SOME command on the machine used $(...).
func TestEvaluate_DynamicContentOnBenignCommandAllowed(t *testing.T) {
	ps := loadTestPolicy(t)
	a := AnalyzeCommand(`echo "count: $(pgrep -f foo | wc -l)"`, "/home/testuser", testEnv("/home/testuser"))
	d := ps.Evaluate(a, "/home/testuser")
	if d.Outcome != OutcomeAllow {
		t.Errorf("outcome = %q, want allow — echo is not a destructive command, dynamic content elsewhere shouldn't matter; decision=%+v", d.Outcome, d)
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

func TestEvaluate_ProcessSubstitution(t *testing.T) {
	ps := loadTestPolicy(t)
	cases := []struct {
		name string
		cmd  string
		want Outcome
	}{
		// Nothing destructive for the unresolved part to hide in: stays allowed,
		// same as `echo $(date)`.
		{"benign diff", "diff <(sort a.txt) <(sort b.txt)", OutcomeAllow},
		// Destructive command with an unresolvable target: human review.
		{"rm of substituted path", "rm -rf <(echo ~/)", OutcomeAsk},
		// A destructive command inside the substitution is still caught.
		{"home wipe inside substitution", "cat <(rm -rf ~/)", OutcomeDeny},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := AnalyzeCommand(tc.cmd, "/home/testuser/project", testEnv("/home/testuser"))
			d := ps.Evaluate(a, "/home/testuser")
			if d.Outcome != tc.want {
				t.Errorf("cmd %q: outcome = %q, want %q; decision=%+v", tc.cmd, d.Outcome, tc.want, d)
			}
		})
	}
}

func TestMerge_LocalProtectedPathIsEnforced(t *testing.T) {
	ps := loadTestPolicy(t)
	a := AnalyzeCommand("rm -rf prod-db", "/home/testuser/project", testEnv("/home/testuser"))
	if d := ps.Evaluate(a, "/home/testuser"); d.Outcome == OutcomeDeny {
		t.Fatalf("precondition: prod-db should not be protected by the defaults; decision=%+v", d)
	}

	ps.Merge(&PolicySet{ProtectedPaths: []protectedPathRule{{Contains: "prod-db"}}})

	if d := ps.Evaluate(a, "/home/testuser"); d.Outcome != OutcomeDeny {
		t.Errorf("outcome = %q, want deny once prod-db is a local protected path; decision=%+v", d.Outcome, d)
	}
}

func TestMerge_KeepsDefaultsAndTheirSettings(t *testing.T) {
	ps := loadTestPolicy(t)
	before := len(ps.ProtectedPaths)
	loop := ps.LoopDetection

	// A local file that sets other fields must not change them.
	ps.Merge(&PolicySet{ProtectedPaths: []protectedPathRule{{Contains: "x"}}, LoopDetection: LoopConfig{}})

	if got := len(ps.ProtectedPaths); got != before+1 {
		t.Errorf("protected paths = %d, want %d (defaults plus one)", got, before+1)
	}
	if ps.LoopDetection != loop {
		t.Errorf("loop detection changed by merge: got %+v, want %+v", ps.LoopDetection, loop)
	}
}
