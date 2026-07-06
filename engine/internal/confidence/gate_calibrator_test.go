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
