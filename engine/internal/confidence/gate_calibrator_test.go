package confidence

import (
	"context"
	"testing"
)

// The calibrate stage must be a no-op until fitted, so inserting it into the
// gate path never changes decisions until real outcomes have been recorded.
func TestGateCalibrator_NoOpUntilFitted(t *testing.T) {
	gc := NewGateCalibrator()
	if gc.IsFitted() {
		t.Fatal("new calibrator should be unfitted")
	}
	for _, s := range []float64{0.0, 0.31, 0.5, 0.734, 0.9, 1.0} {
		if got := gc.Calibrate(s); got != s {
			t.Errorf("unfitted Calibrate(%v) = %v, want raw score unchanged", s, got)
		}
	}
	// A nil calibrator is also a safe no-op.
	var nilGC *GateCalibrator
	if got := nilGC.Calibrate(0.42); got != 0.42 {
		t.Errorf("nil Calibrate(0.42) = %v, want 0.42", got)
	}
}

// After enough human-review outcomes, calibration is monotone (higher raw
// confidence → higher calibrated confidence) and drives the extract→calibrate→
// gate pipeline to the paper's four outcomes.
func TestGateCalibrator_PipelineAfterFeedback(t *testing.T) {
	ctx := context.Background()
	gate := New()
	gc := NewGateCalibrator()

	// Reviewers confirm: high-confidence flagged actions were safe (approved),
	// low-confidence ones were not (denied).
	for i := 0; i < 120; i++ {
		gc.RecordReview(0.88, true)
		gc.RecordReview(0.55, false)
	}
	if !gc.IsFitted() {
		t.Fatal("calibrator should be fitted after 240 outcomes")
	}

	hi := gc.Calibrate(0.88)
	lo := gc.Calibrate(0.55)
	if !(hi > lo) {
		t.Fatalf("calibration not monotone: Calibrate(0.88)=%v <= Calibrate(0.55)=%v", hi, lo)
	}

	// The calibrated score must still produce a valid gate decision.
	dec, err := gate.Evaluate(ctx, hi, nil)
	if err != nil {
		t.Fatalf("gate.Evaluate on calibrated score: %v", err)
	}
	if dec.Level != LevelFullPermission {
		t.Errorf("high calibrated confidence should gate to full_permission, got %s", dec.Level)
	}
}

// The review queue only ever feeds RecordReview a censored band of scores —
// items outside [MissingConfidenceReview's band] never reach a human
// reviewer at all, so an ordinary early-deployment run of all-approved (or
// all-denied) reviews is a single-class buffer, not a pathological one. A
// monotone fit over one class is a flat curve at that class's value, which
// interpolateLocked would previously extrapolate to any input, including
// scores that were never part of the review band at all — e.g. Calibrate(0.0)
// returning ~1.0 ("full_permission") after 50 all-approved reviews in the
// [0.70, 0.90) band. The calibrator must refuse to fit until it has seen both
// classes.
func TestGateCalibrator_SingleClassBufferNeverFits(t *testing.T) {
	gc := NewGateCalibrator()

	// An ordinary early-deployment run: every reviewed action so far was
	// approved. Vary the raw score within the plausible review band so this
	// isn't just one repeated point.
	for i := 0; i < 60; i++ {
		score := 0.70 + 0.19*float64(i%5)/4.0 // spans [0.70, 0.89]
		gc.RecordReview(score, true)          // true = "approved" (safe), per RecordReview's contract
	}

	if gc.IsFitted() {
		t.Fatal("calibrator fitted on a single-class (all-approved) buffer — it should refuse until both classes are observed")
	}

	// Because it never fit, Calibrate must still be the raw-score no-op —
	// specifically, a raw confidence of 0.0 (never part of the reviewed band)
	// must not come back as anything close to "fully trusted."
	if got := gc.Calibrate(0.0); got != 0.0 {
		t.Fatalf("Calibrate(0.0) = %v after an all-approved review run, want 0.0 (raw, unfitted) — a full confidence-gate bypass", got)
	}
}

// Once fitted, the calibrator must never claim calibration for raw scores
// outside the range it was actually fitted on — that would be extrapolating
// a curve fitted on, say, [0.70, 0.90) to scores like 0.0 or 1.0 that were
// never observed.
func TestGateCalibrator_NeverExtrapolatesOutsideFittedRange(t *testing.T) {
	gc := NewGateCalibrator()
	for i := 0; i < 120; i++ {
		gc.RecordReview(0.88, true)
		gc.RecordReview(0.55, false)
	}
	if !gc.IsFitted() {
		t.Fatal("calibrator should be fitted after 240 mixed-outcome reviews")
	}

	for _, raw := range []float64{0.0, 0.05, 0.95, 1.0} {
		if got := gc.Calibrate(raw); got != raw {
			t.Errorf("Calibrate(%v) = %v outside the fitted support — want the raw score unchanged, not an extrapolated value", raw, got)
		}
	}
}
