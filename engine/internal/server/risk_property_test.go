package server

import "testing"

// ─── https://github.com/Lelu-ai/lelu/issues/54 ────────────────────────────────

// TestRiskModel_EveryBandAllowThresholdChangesAVerdict is the property from
// issue #54, in the suite as written:
//
//	For every band, there exists a risk score for which changing that band's
//	Allow threshold changes the verdict returned by evaluate.
//
// It is written against NewRiskConfigFromEnv rather than DefaultRiskConfig —
// the environment is where these thresholds actually come from, and #48
// noted that the monotonicity property was only ever exercised against the
// defaults. The criticality floor is switched off for this property, since
// its whole purpose is to make high-criticality outcomes below review
// unreachable; what the floor leaves inert is the subject of
// TestRiskConfig_InertThresholdWarnings, not of this test.
//
// Before #54 this failed for HighBand: the floor was applied by the same
// predicate that selected the band, so RISK_ALLOW_THRESHOLD_HIGH could be set
// to any valid value and never change a single verdict.
func TestRiskModel_EveryBandAllowThresholdChangesAVerdict(t *testing.T) {
	bands := []struct {
		prefix string
		action string
	}{
		{"LOW", "read_public_doc"}, // criticalityLow (0.25)
		{"MID", "restart_service"}, // criticalityDefault (0.50)
		{"HIGH", "delete_record"},  // criticalityHigh (0.90)
	}
	confidences := []float64{0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 0.999}

	for _, b := range bands {
		t.Run(b.prefix, func(t *testing.T) {
			clearRiskEnv(t)
			t.Setenv("RISK_HIGH_CRITICALITY_FLOOR", "off")

			base, err := NewRiskConfigFromEnv()
			if err != nil {
				t.Fatalf("baseline config: %v", err)
			}
			// The smallest Allow threshold loadBandFromEnv accepts for this
			// band: every score that was allow with the default now lands in
			// read_only, and nothing else about the band moves.
			t.Setenv("RISK_ALLOW_THRESHOLD_"+b.prefix, "0.0001")
			lowered, err := NewRiskConfigFromEnv()
			if err != nil {
				t.Fatalf("lowered config: %v", err)
			}

			mBase, mLow := newRiskModel(base), newRiskModel(lowered)
			for _, conf := range confidences {
				if mBase.evaluate(b.action, conf, 1.0, 1.0).Outcome != mLow.evaluate(b.action, conf, 1.0, 1.0).Outcome {
					return // the threshold changed a verdict: the property holds for this band
				}
			}
			t.Errorf("RISK_ALLOW_THRESHOLD_%s is inert: lowering it from %.4f to 0.0001 never changed the verdict for %s across %d confidence values",
				b.prefix, base.HighBand.Allow, b.action, len(confidences))
		})
	}
}
