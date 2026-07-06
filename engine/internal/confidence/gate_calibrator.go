package confidence

// GateCalibrator is the "calibrate" stage of the extract → calibrate → gate
// pipeline. It adapts the isotonic-regression Calibrator to the confidence
// gate's orientation: it learns P(action is safe | raw confidence) from resolved
// human-review outcomes and returns a calibrated confidence with the same
// meaning as the raw score fed to the Gate (higher = safer, allow).
//
// It is deliberately non-parametric and monotone (higher raw confidence → higher
// calibrated confidence), and it is a no-op until enough outcomes have been
// observed to fit — so inserting it into the gate path never changes behavior
// until real ground-truth data exists.
type GateCalibrator struct {
	c *Calibrator
}

// NewGateCalibrator returns a fresh, unfitted gate calibrator.
func NewGateCalibrator() *GateCalibrator {
	return &GateCalibrator{c: NewCalibrator(500)}
}

// RecordReview feeds one resolved human-review outcome back into the calibrator.
// rawConfidence is the confidence the model reported for the flagged action;
// approved is true when the reviewer confirmed the action was in fact safe.
// The positive label is "safe", so the fitted map is P(safe | rawConfidence),
// monotone non-decreasing in confidence.
func (g *GateCalibrator) RecordReview(rawConfidence float64, approved bool) {
	if g == nil {
		return
	}
	g.c.Record(rawConfidence, approved)
}

// Calibrate maps a raw confidence to a calibrated confidence. Returns the raw
// value unchanged until the calibrator has been fitted from enough outcomes.
func (g *GateCalibrator) Calibrate(rawConfidence float64) float64 {
	if g == nil {
		return rawConfidence
	}
	return g.c.Calibrate(rawConfidence)
}

// IsFitted reports whether the calibrator has enough data to transform scores.
func (g *GateCalibrator) IsFitted() bool {
	return g != nil && g.c.IsFitted()
}
