package server

import (
	"strings"
	"testing"
)

// ─── https://github.com/Lelu-ai/lelu/issues/54 ────────────────────────────────

// TestNewRiskConfigFromEnv_FloorDefaultsToReview pins the promise made when
// the floor became configurable: an environment that never mentions
// RISK_HIGH_CRITICALITY_FLOOR behaves exactly as before #54 — the #44
// guarantee (high criticality is never auto-allowed or read-only) is the
// default, not an opt-in.
func TestNewRiskConfigFromEnv_FloorDefaultsToReview(t *testing.T) {
	clearRiskEnv(t)

	cfg, err := NewRiskConfigFromEnv()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HighCriticalityFloor != outcomeReview {
		t.Fatalf("default floor = %v, want review", cfg.HighCriticalityFloor)
	}
	// delete_record at confidence 0.99 scores 0.009, below HighBand.Allow
	// (0.08): allow before the floor, review after it.
	if dec := newRiskModel(cfg).evaluate("delete_record", 0.99, 1.0, 1.0); dec.Outcome != outcomeReview {
		t.Fatalf("delete_record at confidence 0.99 under the default floor = %v, want review", dec.Outcome)
	}
}

// TestRiskModel_FloorSettings walks the three floor values on the same
// high-criticality action at three confidences chosen to land in allow,
// read_only and review before the floor is applied (scores 0.009, 0.18 and
// 0.36 against HighBand 0.08 / 0.22 / 0.40). Each row states which of those
// pre-floor outcomes the floor is expected to lift — and, by the columns it
// leaves unchanged, which HighBand thresholds are back in service.
func TestRiskModel_FloorSettings(t *testing.T) {
	tests := []struct {
		floor string
		want  [3]decisionOutcome // at confidence 0.99, 0.80, 0.60
	}{
		{"review", [3]decisionOutcome{outcomeReview, outcomeReview, outcomeReview}},
		{"read_only", [3]decisionOutcome{outcomeReadOnly, outcomeReadOnly, outcomeReview}},
		{"off", [3]decisionOutcome{outcomeAllow, outcomeReadOnly, outcomeReview}},
	}
	confidences := [3]float64{0.99, 0.80, 0.60}

	for _, tt := range tests {
		t.Run(tt.floor, func(t *testing.T) {
			clearRiskEnv(t)
			t.Setenv("RISK_HIGH_CRITICALITY_FLOOR", tt.floor)
			cfg, err := NewRiskConfigFromEnv()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			m := newRiskModel(cfg)
			for i, conf := range confidences {
				dec := m.evaluate("delete_record", conf, 1.0, 1.0)
				if dec.Outcome != tt.want[i] {
					t.Errorf("floor=%s confidence=%.2f (score %.3f): outcome %v, want %v", tt.floor, conf, dec.Score, dec.Outcome, tt.want[i])
				}
				if dec.Outcome != outcomeAllow && strings.Contains(dec.Reason, "floored to") && !strings.Contains(dec.Reason, "floored to "+tt.want[i].String()) {
					t.Errorf("floor=%s confidence=%.2f: reason names a different floor than the outcome: %s", tt.floor, conf, dec.Reason)
				}
			}
		})
	}
}

// TestNewRiskConfigFromEnv_RejectsUnknownFloor: a typo in
// RISK_HIGH_CRITICALITY_FLOOR must not silently keep the default. The
// operator who wrote it believes the high band now behaves differently;
// the only honest answer is to refuse to start.
func TestNewRiskConfigFromEnv_RejectsUnknownFloor(t *testing.T) {
	clearRiskEnv(t)
	t.Setenv("RISK_HIGH_CRITICALITY_FLOOR", "sometimes")

	_, err := NewRiskConfigFromEnv()
	if err == nil {
		t.Fatal("expected an error for an unknown floor name, got nil")
	}
	if !strings.Contains(err.Error(), "RISK_HIGH_CRITICALITY_FLOOR") {
		t.Fatalf("expected the error to name the variable, got: %v", err)
	}
}

// TestRiskConfig_InertThresholdWarnings is the startup message #54 asked for:
// a HighBand threshold tuned away from its default while the floor keeps it
// unable to change any verdict must be named, with the floor setting that
// would make it effective. The shipped defaults must produce nothing, so a
// deployment that never touched the high band is not nagged about it.
func TestRiskConfig_InertThresholdWarnings(t *testing.T) {
	tests := []struct {
		name     string
		floor    string
		allow    string
		readOnly string
		want     []string // substrings, one per expected warning, in order
	}{
		{"defaults under the default floor say nothing", "review", "", "", nil},
		{"allow tuned under review is inert", "review", "0.03", "", []string{"RISK_ALLOW_THRESHOLD_HIGH=0.0300 is inert"}},
		{"allow and read_only tuned under review are both inert", "review", "0.03", "0.04", []string{"RISK_ALLOW_THRESHOLD_HIGH", "RISK_READONLY_THRESHOLD_HIGH"}},
		{"read_only tuned under a read_only floor is effective", "read_only", "", "0.10", nil},
		{"allow tuned under a read_only floor is inert", "read_only", "0.03", "", []string{"RISK_ALLOW_THRESHOLD_HIGH"}},
		{"nothing is inert with the floor off", "off", "0.03", "0.04", nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clearRiskEnv(t)
			t.Setenv("RISK_HIGH_CRITICALITY_FLOOR", tt.floor)
			t.Setenv("RISK_ALLOW_THRESHOLD_HIGH", tt.allow)
			t.Setenv("RISK_READONLY_THRESHOLD_HIGH", tt.readOnly)

			cfg, err := NewRiskConfigFromEnv()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			got := cfg.InertThresholdWarnings()
			if len(got) != len(tt.want) {
				t.Fatalf("got %d warning(s), want %d:\n%s", len(got), len(tt.want), strings.Join(got, "\n"))
			}
			for i, w := range tt.want {
				if !strings.Contains(got[i], w) {
					t.Errorf("warning %d = %q, want it to mention %q", i, got[i], w)
				}
			}
		})
	}
}
