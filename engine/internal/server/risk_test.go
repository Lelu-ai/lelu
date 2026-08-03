package server

import "testing"

// ─── https://github.com/Lelu-ai/lelu/issues/44 ────────────────────────────────

// TestRiskModel_CriticalityMonotone is the property Mayur's issue asked for:
// for any two actions where criticality(A) > criticality(B), and for any
// single (confidence, reliability, anomaly) triple applied to both, the
// outcome for A must never be less restrictive than the outcome for B.
// Before the criticality floor, this failed on exactly the disable_mfa vs
// delete_record row from the issue.
//
// Iterates actionCriticalityTiers (defined in risk.go, next to
// actionCriticality itself) rather than a second hand-written list: an
// earlier version of this test hard-coded three tiers and silently missed
// the 0.60 mediumRisk tier, which let update_record (crit 0.60) resolve to
// a less restrictive outcome than restart_service (crit 0.50) pass
// unnoticed. See https://github.com/Lelu-ai/lelu/pull/45.
func TestRiskModel_CriticalityMonotone(t *testing.T) {
	m := newRiskModel(DefaultRiskConfig())

	tiers := actionCriticalityTiers
	for _, tr := range tiers {
		if got := actionCriticality(tr.Action); got != tr.Criticality {
			t.Fatalf("actionCriticality(%q) = %.2f, want %.2f (fixture assumption broken)", tr.Action, got, tr.Criticality)
		}
	}

	confidences := []float64{0.0, 0.35, 0.5, 0.71, 0.9, 0.95, 0.999}
	reliabilities := []float64{0.0, 0.5, 1.0}
	anomalies := []float64{1.0, 1.5, 2.0}

	for _, conf := range confidences {
		for _, rel := range reliabilities {
			for _, anom := range anomalies {
				var prevSeverity int
				var prevTier string
				for i, tr := range tiers {
					dec := m.evaluate(tr.Action, conf, rel, anom)
					sev := dec.Outcome.severity()
					if i > 0 && sev < prevSeverity {
						t.Errorf(
							"monotonicity violated at confidence=%.3f reliability=%.2f anomaly=%.2f: %s (criticality %.2f) outcome severity %d is LESS restrictive than %s (lower criticality) severity %d",
							conf, rel, anom, tr.Action, tr.Criticality, sev, prevTier, prevSeverity,
						)
					}
					prevSeverity = sev
					prevTier = tr.Action
				}
			}
		}
	}
}

// TestRiskModel_SubstringGapActionsAreHighCriticality locks in the exact
// disable_mfa / drop_table / execute_shell examples from the issue: none of
// them matched any keyword before this fix, so they inherited the 0.50
// default and could outrank delete_record in permissiveness.
func TestRiskModel_SubstringGapActionsAreHighCriticality(t *testing.T) {
	for _, action := range []string{"disable_mfa", "drop_table", "execute_shell"} {
		if got := actionCriticality(action); got != 0.90 {
			t.Errorf("actionCriticality(%q) = %.2f, want 0.90", action, got)
		}
	}
}

// TestRiskModel_KeywordsRequireWordBoundary locks in Mayur's PR #45 review
// finding: raw substring matching on the taxonomy keywords made "drop" and
// "exec" false-positive inside ordinary words that merely contain them as a
// substring — "dropbox", "droplet", "execution" — forcing unrelated read
// actions into permanent high criticality with no delimiter anywhere near
// the keyword.
//
// view_root_cause_report is deliberately excluded here: "root" is a genuine
// standalone token in "root_cause" (delimited by underscores on both
// sides), so word-boundary matching does not and should not change its
// result — it's still high criticality after this fix, same as before.
// That's a keyword-taxonomy precision problem (bare "root" collides with
// the ordinary phrase "root cause"), not the substring-boundary bug this
// test covers, and is out of scope here.
func TestRiskModel_KeywordsRequireWordBoundary(t *testing.T) {
	cases := map[string]float64{
		"read_dropbox_file":   criticalityLow, // "drop" inside "dropbox" — "read" still matches
		"list_execution_logs": criticalityLow, // "exec" inside "execution" — "list" still matches
		"get_droplet_status":  criticalityLow, // "drop" inside "droplet" — "get" still matches
	}
	for action, want := range cases {
		if got := actionCriticality(action); got != want {
			t.Errorf("actionCriticality(%q) = %.2f, want %.2f (word-boundary match should not fire on a keyword embedded in an unrelated word)", action, got, want)
		}
	}

	// The real keywords must still match as their own token.
	for _, action := range []string{"drop_table", "exec_command", "sudo_run", "chroot_exec"} {
		if got := actionCriticality(action); got != criticalityHigh {
			t.Errorf("actionCriticality(%q) = %.2f, want %.2f (real keyword token should still match)", action, got, criticalityHigh)
		}
	}
}

// TestRiskModel_HighCriticalityFloorsToReview is the exact scenario the
// issue's Method section produced: at confidence=0.71, disable_mfa/
// drop_table/execute_shell must no longer outrank delete_record now that
// all four share criticality 0.90 and the floor applies to all of them.
func TestRiskModel_HighCriticalityFloorsToReview(t *testing.T) {
	m := newRiskModel(DefaultRiskConfig())
	for _, action := range []string{"disable_mfa", "drop_table", "execute_shell", "delete_record", "revoke_access"} {
		dec := m.evaluate(action, 0.71, 1.0, 1.0)
		if dec.Outcome.severity() < outcomeReview.severity() {
			t.Errorf("%s at confidence=0.71: outcome severity %d, want at least outcomeReview (%d)", action, dec.Outcome.severity(), outcomeReview.severity())
		}
	}
}

// TestRiskModel_FloatBoundaryEpsilon locks in the exact float64 catch from
// the issue: 0.5*(1-0.70) computes to 0.15000000000000002, a hair over the
// literal 0.15 MidBand.Allow threshold. Without the epsilon, confidence 0.70
// reviews and 0.71 allows for no reason anyone configured. Uses
// restart_service rather than the issue's own disable_mfa example, since
// disable_mfa is now high-criticality (see the substring-gap fix above) and
// the criticality floor would mask this specific float behavior — this test
// needs an action that stays on the MidBand (0.50 default) to isolate it.
func TestRiskModel_FloatBoundaryEpsilon(t *testing.T) {
	if got := actionCriticality("restart_service"); got != 0.50 {
		t.Fatalf("actionCriticality(\"restart_service\") = %.2f, want 0.50 (fixture assumption broken)", got)
	}

	cfg := DefaultRiskConfig()
	m := newRiskModel(cfg)

	dec070 := m.evaluate("restart_service", 0.70, 1.0, 1.0)
	dec071 := m.evaluate("restart_service", 0.71, 1.0, 1.0)

	if dec070.Outcome != dec071.Outcome {
		t.Errorf("confidence 0.70 (%v) and 0.71 (%v) resolved to different outcomes across an unintended float64 rounding boundary", dec070.Outcome, dec071.Outcome)
	}
	if dec070.Outcome != outcomeAllow {
		t.Errorf("confidence 0.70 resolved to %v, want outcomeAllow (0.5*(1-0.70)=0.15 should land exactly on the allow threshold)", dec070.Outcome)
	}
}

func TestNewRiskConfigFromEnv_Defaults(t *testing.T) {
	t.Setenv("RISK_ALLOW_THRESHOLD_LOW", "")
	t.Setenv("RISK_REVIEW_THRESHOLD_LOW", "")
	t.Setenv("RISK_READONLY_THRESHOLD_LOW", "")

	cfg, err := NewRiskConfigFromEnv()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	def := DefaultRiskConfig()

	if cfg.LowBand.Allow != def.LowBand.Allow {
		t.Fatalf("expected default low allow threshold %.2f, got %.2f", def.LowBand.Allow, cfg.LowBand.Allow)
	}
	if cfg.HighBand.Review != def.HighBand.Review {
		t.Fatalf("expected default high review threshold %.2f, got %.2f", def.HighBand.Review, cfg.HighBand.Review)
	}
}

func TestNewRiskConfigFromEnv_Overrides(t *testing.T) {
	t.Setenv("RISK_ALLOW_THRESHOLD_HIGH", "0.03")
	t.Setenv("RISK_READONLY_THRESHOLD_HIGH", "0.04")
	t.Setenv("RISK_REVIEW_THRESHOLD_HIGH", "0.05")
	t.Setenv("RISK_CRITICALITY_MID_MIN", "0.9")
	t.Setenv("RISK_CRITICALITY_HIGH_MIN", "0.8")

	cfg, err := NewRiskConfigFromEnv()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.HighBand.Allow != 0.03 {
		t.Fatalf("expected high-band allow override 0.03, got %.2f", cfg.HighBand.Allow)
	}
	if cfg.HighBand.ReadOnly != 0.04 {
		t.Fatalf("expected high-band read_only override 0.04, got %.2f", cfg.HighBand.ReadOnly)
	}
	if cfg.HighBand.Review != 0.05 {
		t.Fatalf("expected high-band review override 0.05, got %.2f", cfg.HighBand.Review)
	}
	if cfg.MidCriticalityMin > cfg.HighCriticalityMin {
		t.Fatalf("expected mid criticality <= high criticality, got mid=%.2f high=%.2f", cfg.MidCriticalityMin, cfg.HighCriticalityMin)
	}
}

// TestNewRiskConfigFromEnv_RejectsMisconfiguredBand locks in the fix for the
// operational risk flagged in PR #45 review: a deployment carrying
// pre-fix RISK_REVIEW_THRESHOLD_HIGH/RISK_READONLY_THRESHOLD_HIGH overrides
// (0.22/0.40, matching the old, backwards ordering) must not start up with
// those silently reordered — reordering would collapse ReadOnly and Review
// to the same value (both clamped to 0.40), making outcomeReview completely
// unreachable for that band. Out-of-order thresholds must fail loudly
// instead. See https://github.com/Lelu-ai/lelu/pull/45.
func TestNewRiskConfigFromEnv_RejectsMisconfiguredBand(t *testing.T) {
	t.Setenv("RISK_ALLOW_THRESHOLD_HIGH", "0.08")
	t.Setenv("RISK_REVIEW_THRESHOLD_HIGH", "0.22")
	t.Setenv("RISK_READONLY_THRESHOLD_HIGH", "0.40")

	if _, err := NewRiskConfigFromEnv(); err == nil {
		t.Fatal("expected an error for out-of-order HIGH band thresholds (stale pre-PR#45 overrides), got nil")
	}
}
