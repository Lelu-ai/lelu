package confidence

import (
	"math"
	"sort"
	"sync"
)

// Calibrator maps raw confidence scores to calibrated threat probabilities
// using isotonic regression (pool adjacent violators algorithm).
//
// Why isotonic regression over Platt scaling:
//   - Non-parametric: no assumption about score distribution
//   - Monotone constraint: higher raw score → higher calibrated probability
//   - Works well with small datasets (50+ samples sufficient)
//   - Proven superior for well-separated classifiers (Niculescu-Mizil & Caruana, ICML 2005)
type Calibrator struct {
	mu sync.RWMutex

	// Fitted isotonic regression breakpoints.
	// xBreaks[i] → yBreaks[i]: raw score → calibrated probability
	xBreaks []float64
	yBreaks []float64

	// Feedback buffer: (rawScore, wasThreeat) pairs from human review outcomes.
	buffer   []calibrationPoint
	maxBuf   int
	fitted   bool

	// Dynamic decision threshold — updated via feedback loop.
	// Initialized to 0.5, converges to optimal TPR/FPR operating point.
	threshold float64
}

type calibrationPoint struct {
	score  float64 // raw score from escalator
	threat bool    // ground truth: was this actually a threat?
}

// NewCalibrator returns an unfitted calibrator with sensible defaults.
func NewCalibrator(maxBuffer int) *Calibrator {
	if maxBuffer <= 0 {
		maxBuffer = 500
	}
	return &Calibrator{
		maxBuf:    maxBuffer,
		threshold: 0.5,
	}
}

// Record adds a labelled observation to the calibration buffer.
// Call this after a human reviewer makes a decision on a flagged request.
func (c *Calibrator) Record(rawScore float64, wasThreat bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.buffer = append(c.buffer, calibrationPoint{rawScore, wasThreat})
	if len(c.buffer) > c.maxBuf {
		// Drop oldest observations.
		c.buffer = c.buffer[len(c.buffer)-c.maxBuf:]
	}

	// Refit every 50 new observations.
	if len(c.buffer)%50 == 0 && len(c.buffer) >= 50 {
		c.fitLocked()
		c.updateThresholdLocked(0.05) // target FPR ≤ 5%
	}
}

// Calibrate maps a raw score to a calibrated threat probability.
// Returns the raw score unchanged if not yet fitted (insufficient data).
func (c *Calibrator) Calibrate(rawScore float64) float64 {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if !c.fitted || len(c.xBreaks) == 0 {
		return rawScore
	}
	return c.interpolateLocked(rawScore)
}

// Threshold returns the current optimal decision threshold.
func (c *Calibrator) Threshold() float64 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.threshold
}

// IsFitted reports whether the calibrator has been trained.
func (c *Calibrator) IsFitted() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.fitted
}

// fitLocked runs the Pool Adjacent Violators (PAV) algorithm.
// Must be called with c.mu held for writing.
func (c *Calibrator) fitLocked() {
	if len(c.buffer) < 10 {
		return
	}

	// Sort by raw score ascending.
	sorted := make([]calibrationPoint, len(c.buffer))
	copy(sorted, c.buffer)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].score < sorted[j].score
	})

	// Group into bins of ~10 for stable isotonic fit.
	binSize := 10
	type bin struct {
		xMean float64
		yMean float64
	}
	var bins []bin
	for i := 0; i < len(sorted); i += binSize {
		end := i + binSize
		if end > len(sorted) {
			end = len(sorted)
		}
		chunk := sorted[i:end]
		xSum, ySum := 0.0, 0.0
		for _, p := range chunk {
			xSum += p.score
			if p.threat {
				ySum += 1.0
			}
		}
		n := float64(len(chunk))
		bins = append(bins, bin{xSum / n, ySum / n})
	}

	// Pool Adjacent Violators: enforce monotone non-decreasing y.
	type block struct {
		xMean, yMean float64
		count        int
	}
	blocks := make([]block, len(bins))
	for i, b := range bins {
		blocks[i] = block{b.xMean, b.yMean, 1}
	}

	for {
		merged := false
		i := 0
		var newBlocks []block
		for i < len(blocks) {
			if i+1 < len(blocks) && blocks[i].yMean > blocks[i+1].yMean {
				// Violation: merge blocks i and i+1.
				n1 := float64(blocks[i].count)
				n2 := float64(blocks[i+1].count)
				merged = true
				newBlocks = append(newBlocks, block{
					xMean: (blocks[i].xMean*n1 + blocks[i+1].xMean*n2) / (n1 + n2),
					yMean: (blocks[i].yMean*n1 + blocks[i+1].yMean*n2) / (n1 + n2),
					count: blocks[i].count + blocks[i+1].count,
				})
				i += 2
			} else {
				newBlocks = append(newBlocks, blocks[i])
				i++
			}
		}
		blocks = newBlocks
		if !merged {
			break
		}
	}

	// Extract breakpoints.
	c.xBreaks = make([]float64, len(blocks))
	c.yBreaks = make([]float64, len(blocks))
	for i, b := range blocks {
		c.xBreaks[i] = b.xMean
		c.yBreaks[i] = b.yMean
	}
	c.fitted = true
}

// interpolateLocked linearly interpolates the fitted isotonic curve.
// Must be called with c.mu held for reading.
func (c *Calibrator) interpolateLocked(x float64) float64 {
	n := len(c.xBreaks)
	if x <= c.xBreaks[0] {
		return c.yBreaks[0]
	}
	if x >= c.xBreaks[n-1] {
		return c.yBreaks[n-1]
	}
	// Binary search for the segment.
	lo, hi := 0, n-1
	for lo < hi-1 {
		mid := (lo + hi) / 2
		if c.xBreaks[mid] <= x {
			lo = mid
		} else {
			hi = mid
		}
	}
	// Linear interpolation between lo and hi.
	t := (x - c.xBreaks[lo]) / (c.xBreaks[hi] - c.xBreaks[lo])
	return c.yBreaks[lo] + t*(c.yBreaks[hi]-c.yBreaks[lo])
}

// updateThresholdLocked finds the threshold that maximises TPR with FPR ≤ maxFPR.
// Must be called with c.mu held for writing.
func (c *Calibrator) updateThresholdLocked(maxFPR float64) {
	if len(c.buffer) < 20 {
		return
	}

	// Count positives and negatives.
	totalPos, totalNeg := 0, 0
	for _, p := range c.buffer {
		if p.threat {
			totalPos++
		} else {
			totalNeg++
		}
	}
	if totalPos == 0 || totalNeg == 0 {
		return
	}

	// Evaluate 100 threshold candidates.
	bestThreshold := 0.5
	bestTPR := 0.0
	for i := 0; i <= 100; i++ {
		t := float64(i) / 100.0
		tp, fp := 0, 0
		for _, p := range c.buffer {
			cal := c.interpolateLocked(p.score)
			if cal >= t {
				if p.threat {
					tp++
				} else {
					fp++
				}
			}
		}
		tpr := float64(tp) / float64(totalPos)
		fpr := float64(fp) / float64(totalNeg)
		if fpr <= maxFPR && tpr > bestTPR {
			bestTPR = tpr
			bestThreshold = t
		}
	}

	// Smooth update: don't jump more than 0.1 per refit.
	delta := bestThreshold - c.threshold
	delta = math.Max(-0.1, math.Min(0.1, delta))
	c.threshold = c.threshold + delta
}
