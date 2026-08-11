package confidence

import "testing"

// fitCalibrator feeds a clean, well-separated dataset into c so that a real
// isotonic fit + threshold update happen (Record refits every 50 samples).
// Negatives cluster near 0.1, positives near 0.9 — no ambiguity in the fit.
func fitCalibrator(c *Calibrator) {
	for i := 0; i < 25; i++ {
		c.Record(0.10+float64(i)*0.001, false)
	}
	for i := 0; i < 25; i++ {
		c.Record(0.90+float64(i)*0.001, true)
	}
}

// TestEscalate_CalibratedDeny reproduces the reported bug: ActionDeny in the
// calibrated branch was unreachable because the threshold+0.3 check came
// after the threshold check, and threshold+0.3 > threshold always. The
// highest possible calibrated score (1.0) must deny, not just review.
func TestEscalate_CalibratedDeny(t *testing.T) {
	e := NewEscalator(nil)
	fitCalibrator(e.calibrator)
	if !e.calibrator.IsFitted() {
		t.Fatal("calibrator did not fit — test setup invalid")
	}

	result := &AuditResult{ExternalScore: 1.0}
	action := e.Escalate(result, SeverityHigh)

	if action != ActionDeny {
		t.Errorf("Escalate() at max calibrated score = %q, want %q (threshold=%.3f)",
			action, ActionDeny, e.calibrator.Threshold())
	}
}

// TestEscalate_CalibratedReview covers the middle band: calibrated confidence
// at or above threshold but below threshold+0.3 should still route to human
// review, not deny.
func TestEscalate_CalibratedReview(t *testing.T) {
	e := NewEscalator(nil)
	fitCalibrator(e.calibrator)

	threshold := e.calibrator.Threshold()
	// Pick a raw score whose calibrated value sits just above threshold but
	// comfortably under threshold+0.3. The fitted curve is ~0 below 0.1 and
	// ~1 above 0.9, so anything calibrated must come from the interpolated
	// midsection; 0.5 raw score lands near the middle of the fitted range.
	result := &AuditResult{ExternalScore: 0.5}
	calibrated := e.calibrator.Calibrate(0.5)
	if calibrated < threshold || calibrated >= threshold+0.3 {
		t.Skipf("raw score 0.5 calibrated to %.3f, outside the review band [%.3f, %.3f) for this fit — not a valid probe",
			calibrated, threshold, threshold+0.3)
	}

	action := e.Escalate(result, SeverityHigh)
	if action != ActionReview {
		t.Errorf("Escalate() at calibrated=%.3f (threshold=%.3f) = %q, want %q",
			calibrated, threshold, action, ActionReview)
	}
}

// TestEscalate_CalibratedAllow covers the low band: calibrated confidence
// below threshold should allow.
func TestEscalate_CalibratedAllow(t *testing.T) {
	e := NewEscalator(nil)
	fitCalibrator(e.calibrator)

	result := &AuditResult{ExternalScore: 0.0}
	action := e.Escalate(result, SeverityHigh)

	if action != ActionAllow {
		t.Errorf("Escalate() at min calibrated score = %q, want %q (threshold=%.3f)",
			action, ActionAllow, e.calibrator.Threshold())
	}
}

// TestEscalate_NilResult confirms the fail-closed path is unaffected by the
// ordering fix.
func TestEscalate_NilResult(t *testing.T) {
	e := NewEscalator(nil)
	if action := e.Escalate(nil, SeverityHigh); action != ActionReview {
		t.Errorf("Escalate(nil, ...) = %q, want %q", action, ActionReview)
	}
}
