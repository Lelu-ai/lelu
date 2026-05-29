package observability

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// AnomalyDetector handles ML-powered behavioral anomaly detection
type AnomalyDetector struct {
	db     *sql.DB
	mutex  sync.RWMutex
	config AnomalyConfig

	// Behavioral baselines for each agent
	baselines map[string]*BehavioralBaseline

	// Prometheus metrics
	anomalyGauge   prometheus.GaugeVec
	anomalyCounter prometheus.CounterVec
	baselineGauge  prometheus.GaugeVec
}

// AnomalyConfig configures anomaly detection parameters
type AnomalyConfig struct {
	// Isolation Forest parameters
	ContaminationRate float64 // Expected proportion of anomalies (0.01 = 1%)
	NumTrees          int     // Number of isolation trees
	SubsampleSize     int     // Subsample size for each tree

	// Baseline parameters
	BaselineWindow     time.Duration // Time window for baseline calculation
	MinSamplesBaseline int           // Minimum samples needed for baseline
	BaselineUpdateFreq time.Duration // How often to update baselines

	// Anomaly thresholds
	AnomalyThreshold float64 // Threshold for anomaly score (0-1)
	SevereThreshold  float64 // Threshold for severe anomalies

	// Feature weights
	ConfidenceWeight float64 // Weight for confidence-based features
	LatencyWeight    float64 // Weight for latency-based features
	PatternWeight    float64 // Weight for pattern-based features
}

// BehavioralBaseline represents normal behavior patterns for an agent
type BehavioralBaseline struct {
	AgentID     string    `json:"agent_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	SampleCount int       `json:"sample_count"`

	// Statistical baselines
	ConfidenceMean   float64 `json:"confidence_mean"`
	ConfidenceStdDev float64 `json:"confidence_std_dev"`
	LatencyMean      float64 `json:"latency_mean"`
	LatencyStdDev    float64 `json:"latency_std_dev"`

	// Pattern baselines
	ActionFrequencies map[string]float64 `json:"action_frequencies"`
	HourlyPatterns    [24]float64        `json:"hourly_patterns"`
	DecisionOutcomes  map[string]float64 `json:"decision_outcomes"`

	// Advanced features
	ConfidenceDistribution []float64          `json:"confidence_distribution"`
	LatencyPercentiles     map[string]float64 `json:"latency_percentiles"`
}

// AnomalyResult represents the result of anomaly detection
type AnomalyResult struct {
	AgentID      string             `json:"agent_id"`
	Timestamp    time.Time          `json:"timestamp"`
	AnomalyScore float64            `json:"anomaly_score"` // 0-1, higher = more anomalous
	IsAnomaly    bool               `json:"is_anomaly"`
	Severity     string             `json:"severity"`    // "low", "medium", "high", "severe"
	Features     map[string]float64 `json:"features"`    // Feature values that contributed
	Explanation  string             `json:"explanation"` // Human-readable explanation

	// Context
	Action     string        `json:"action"`
	Confidence float64       `json:"confidence"`
	Latency    time.Duration `json:"latency"`
	Outcome    string        `json:"outcome"`
}

// FeatureVector represents behavioral features for anomaly detection
type FeatureVector struct {
	// Confidence features
	Confidence          float64 `json:"confidence"`
	ConfidenceDeviation float64 `json:"confidence_deviation"`

	// Latency features
	Latency          float64 `json:"latency"`
	LatencyDeviation float64 `json:"latency_deviation"`

	// Pattern features
	ActionRarity    float64 `json:"action_rarity"`
	TimeOfDayRarity float64 `json:"time_of_day_rarity"`
	OutcomeRarity   float64 `json:"outcome_rarity"`

	// Sequence features
	RecentErrorRate float64 `json:"recent_error_rate"`
	ConfidenceTrend float64 `json:"confidence_trend"`
	LatencyTrend    float64 `json:"latency_trend"`
}

// DefaultAnomalyConfig returns sensible defaults for anomaly detection
func DefaultAnomalyConfig() AnomalyConfig {
	return AnomalyConfig{
		ContaminationRate: 0.05, // Expect 5% anomalies
		NumTrees:          100,  // 100 isolation trees
		SubsampleSize:     256,  // 256 samples per tree

		BaselineWindow:     7 * 24 * time.Hour, // 1 week baseline
		MinSamplesBaseline: 100,                // Need 100 samples minimum
		BaselineUpdateFreq: 1 * time.Hour,      // Update hourly

		AnomalyThreshold: 0.6, // 60% threshold for anomaly
		SevereThreshold:  0.8, // 80% threshold for severe

		ConfidenceWeight: 0.3, // 30% weight on confidence
		LatencyWeight:    0.3, // 30% weight on latency
		PatternWeight:    0.4, // 40% weight on patterns
	}
}

// NewAnomalyDetector creates a new anomaly detector
func NewAnomalyDetector(db *sql.DB, config AnomalyConfig) *AnomalyDetector {
	ad := &AnomalyDetector{
		db:        db,
		config:    config,
		baselines: make(map[string]*BehavioralBaseline),

		anomalyGauge: *promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "ai_agent_anomaly_score",
				Help: "Current anomaly score for AI agents (0-1)",
			},
			[]string{"agent_id", "agent_type"},
		),

		anomalyCounter: *promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "ai_agent_anomalies_total",
				Help: "Total anomalies detected for AI agents",
			},
			[]string{"agent_id", "agent_type", "severity"},
		),

		baselineGauge: *promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "ai_agent_baseline_samples",
				Help: "Number of samples in behavioral baseline",
			},
			[]string{"agent_id", "agent_type"},
		),
	}

	// Start background baseline updates
	go ad.startBaselineUpdater()

	return ad
}

// DetectAnomaly performs anomaly detection on a single decision
func (ad *AnomalyDetector) DetectAnomaly(ctx context.Context, agentID, agentType, action string,
	confidence float64, latency time.Duration, outcome string) (*AnomalyResult, error) {

	// Get or create baseline for this agent
	baseline, err := ad.getBaseline(ctx, agentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get baseline: %w", err)
	}

	// If baseline is insufficient, return no anomaly
	if baseline.SampleCount < ad.config.MinSamplesBaseline {
		return &AnomalyResult{
			AgentID:      agentID,
			Timestamp:    time.Now(),
			AnomalyScore: 0.0,
			IsAnomaly:    false,
			Severity:     "none",
			Explanation:  "Insufficient baseline data for anomaly detection",
		}, nil
	}

	// Extract features
	features := ad.extractFeatures(baseline, action, confidence, latency, outcome)

	// Calculate anomaly score using Isolation Forest approach
	anomalyScore := ad.calculateAnomalyScore(features, baseline)

	// Determine if this is an anomaly
	isAnomaly := anomalyScore >= ad.config.AnomalyThreshold
	severity := ad.getSeverity(anomalyScore)

	// Generate explanation
	explanation := ad.generateExplanation(features, baseline, anomalyScore)

	result := &AnomalyResult{
		AgentID:      agentID,
		Timestamp:    time.Now(),
		AnomalyScore: anomalyScore,
		IsAnomaly:    isAnomaly,
		Severity:     severity,
		Features:     ad.featuresToMap(features),
		Explanation:  explanation,
		Action:       action,
		Confidence:   confidence,
		Latency:      latency,
		Outcome:      outcome,
	}

	// Update metrics
	ad.anomalyGauge.WithLabelValues(agentID, agentType).Set(anomalyScore)
	if isAnomaly {
		ad.anomalyCounter.WithLabelValues(agentID, agentType, severity).Inc()
	}

	// Store anomaly result if significant
	if isAnomaly {
		err = ad.storeAnomalyResult(ctx, result)
		if err != nil {
			return result, fmt.Errorf("failed to store anomaly result: %w", err)
		}
	}

	return result, nil
}

// extractFeatures extracts behavioral features from a decision
func (ad *AnomalyDetector) extractFeatures(baseline *BehavioralBaseline, action string,
	confidence float64, latency time.Duration, outcome string) *FeatureVector {

	features := &FeatureVector{
		Confidence: confidence,
		Latency:    latency.Seconds(),
	}

	// Confidence deviation from baseline
	if baseline.ConfidenceStdDev > 0 {
		features.ConfidenceDeviation = math.Abs(confidence-baseline.ConfidenceMean) / baseline.ConfidenceStdDev
	}

	// Latency deviation from baseline
	if baseline.LatencyStdDev > 0 {
		features.LatencyDeviation = math.Abs(latency.Seconds()-baseline.LatencyMean) / baseline.LatencyStdDev
	}

	// Action rarity (inverse of frequency)
	if freq, exists := baseline.ActionFrequencies[action]; exists && freq > 0 {
		features.ActionRarity = 1.0 / freq
	} else {
		features.ActionRarity = 10.0 // Very rare action
	}

	// Time of day rarity
	hour := time.Now().Hour()
	if baseline.HourlyPatterns[hour] > 0 {
		features.TimeOfDayRarity = 1.0 / baseline.HourlyPatterns[hour]
	} else {
		features.TimeOfDayRarity = 5.0 // Unusual time
	}

	// Outcome rarity
	if freq, exists := baseline.DecisionOutcomes[outcome]; exists && freq > 0 {
		features.OutcomeRarity = 1.0 / freq
	} else {
		features.OutcomeRarity = 5.0 // Unusual outcome
	}

	// TODO: Add sequence features (recent error rate, trends)
	// These would require maintaining recent decision history

	return features
}

// ─── Extended Isolation Forest ───────────────────────────────────────────────
//
// Implements a real Isolation Forest with random hyperplane splits (EIF-style).
// Anomalies are isolated in fewer splits → shorter average path length → higher score.
//
// Reference: Liu et al. (2008) + Hariri et al. (2019) Extended Isolation Forest.

// iTree is a single isolation tree node.
type iTree struct {
	left, right    *iTree
	splitFeature   int
	splitValue     float64
	splitNormal    []float64 // random normal vector for hyperplane split
	splitIntercept float64   // intercept for hyperplane: normal·x ≤ intercept
	size           int       // number of samples at this node (leaf)
	isLeaf         bool
}

// isolationForest holds a trained ensemble of isolation trees.
type isolationForest struct {
	trees      []*iTree
	numTrees   int
	sampleSize int
	heightLimit int
}

// featureToVec converts a FeatureVector to a float64 slice for the forest.
func featureToVec(f *FeatureVector) []float64 {
	return []float64{
		f.ConfidenceDeviation,
		f.LatencyDeviation,
		f.ActionRarity,
		f.TimeOfDayRarity,
		f.OutcomeRarity,
		f.RecentErrorRate,
		f.ConfidenceTrend,
		f.LatencyTrend,
	}
}

// buildITree recursively builds one isolation tree from a sample set.
func buildITree(data [][]float64, height, heightLimit int, rng *lcgRand) *iTree {
	n := len(data)
	if n == 0 {
		return &iTree{isLeaf: true, size: 0}
	}
	if height >= heightLimit || n <= 1 {
		return &iTree{isLeaf: true, size: n}
	}

	dim := len(data[0])

	// Generate a random normal vector for hyperplane split (EIF).
	normal := make([]float64, dim)
	norm := 0.0
	for i := range normal {
		v := rng.normFloat64()
		normal[i] = v
		norm += v * v
	}
	norm = math.Sqrt(norm)
	if norm > 0 {
		for i := range normal {
			normal[i] /= norm
		}
	}

	// Project all points onto the normal vector, find min/max.
	minProj, maxProj := math.MaxFloat64, -math.MaxFloat64
	for _, x := range data {
		p := dotProduct(normal, x)
		if p < minProj {
			minProj = p
		}
		if p > maxProj {
			maxProj = p
		}
	}

	if minProj == maxProj {
		return &iTree{isLeaf: true, size: n}
	}

	intercept := minProj + rng.float64()*(maxProj-minProj)

	leftData := data[:0:0]
	rightData := data[:0:0]
	for _, x := range data {
		if dotProduct(normal, x) <= intercept {
			leftData = append(leftData, x)
		} else {
			rightData = append(rightData, x)
		}
	}

	// Fallback to axis-aligned split if hyperplane doesn't separate.
	if len(leftData) == 0 || len(rightData) == 0 {
		feat := rng.intn(dim)
		minV, maxV := math.MaxFloat64, -math.MaxFloat64
		for _, x := range data {
			if x[feat] < minV {
				minV = x[feat]
			}
			if x[feat] > maxV {
				maxV = x[feat]
			}
		}
		splitVal := minV + rng.float64()*(maxV-minV)
		leftData = leftData[:0]
		rightData = rightData[:0]
		for _, x := range data {
			if x[feat] <= splitVal {
				leftData = append(leftData, x)
			} else {
				rightData = append(rightData, x)
			}
		}
		return &iTree{
			splitFeature: feat,
			splitValue:   splitVal,
			left:         buildITree(leftData, height+1, heightLimit, rng),
			right:        buildITree(rightData, height+1, heightLimit, rng),
		}
	}

	return &iTree{
		splitNormal:    normal,
		splitIntercept: intercept,
		left:           buildITree(leftData, height+1, heightLimit, rng),
		right:          buildITree(rightData, height+1, heightLimit, rng),
	}
}

// pathLength returns the path length for a single point in one tree.
func pathLength(node *iTree, x []float64, depth int) float64 {
	if node.isLeaf {
		return float64(depth) + cFactor(node.size)
	}
	var goLeft bool
	if node.splitNormal != nil {
		goLeft = dotProduct(node.splitNormal, x) <= node.splitIntercept
	} else {
		goLeft = x[node.splitFeature] <= node.splitValue
	}
	if goLeft {
		return pathLength(node.left, x, depth+1)
	}
	return pathLength(node.right, x, depth+1)
}

// cFactor is the expected path length for BST with n elements (normalization).
func cFactor(n int) float64 {
	if n <= 1 {
		return 0
	}
	fn := float64(n)
	return 2.0*(math.Log(fn-1)+0.5772156649) - 2.0*(fn-1)/fn
}

func dotProduct(a, b []float64) float64 {
	s := 0.0
	for i := range a {
		if i < len(b) {
			s += a[i] * b[i]
		}
	}
	return s
}

// trainForest builds a new isolation forest from sample data.
func trainForest(samples [][]float64, numTrees, sampleSize int, seed uint64) *isolationForest {
	if len(samples) == 0 {
		return nil
	}
	heightLimit := int(math.Ceil(math.Log2(float64(sampleSize))))
	rng := newLCG(seed)
	trees := make([]*iTree, numTrees)
	for t := range trees {
		// Subsample without replacement.
		n := sampleSize
		if n > len(samples) {
			n = len(samples)
		}
		sub := make([][]float64, n)
		perm := rng.perm(len(samples))
		for i := 0; i < n; i++ {
			sub[i] = samples[perm[i]]
		}
		trees[t] = buildITree(sub, 0, heightLimit, rng)
	}
	return &isolationForest{trees: trees, numTrees: numTrees, sampleSize: sampleSize, heightLimit: heightLimit}
}

// anomalyScore returns 0–1 where higher = more anomalous.
func (f *isolationForest) anomalyScore(x []float64) float64 {
	if f == nil || len(f.trees) == 0 {
		return 0
	}
	avgPath := 0.0
	for _, t := range f.trees {
		avgPath += pathLength(t, x, 0)
	}
	avgPath /= float64(len(f.trees))
	c := cFactor(f.sampleSize)
	if c == 0 {
		return 0.5
	}
	return math.Pow(2, -avgPath/c)
}

// ─── LCG random number generator (no stdlib/math/rand import needed) ─────────

type lcgRand struct{ state uint64 }

func newLCG(seed uint64) *lcgRand { return &lcgRand{seed | 1} }

func (r *lcgRand) next() uint64 {
	r.state = r.state*6364136223846793005 + 1442695040888963407
	return r.state
}

func (r *lcgRand) float64() float64 {
	return float64(r.next()>>11) / (1 << 53)
}

func (r *lcgRand) intn(n int) int {
	return int(r.next() % uint64(n))
}

func (r *lcgRand) normFloat64() float64 {
	// Box-Muller transform.
	u1 := r.float64()
	u2 := r.float64()
	if u1 < 1e-10 {
		u1 = 1e-10
	}
	return math.Sqrt(-2*math.Log(u1)) * math.Cos(2*math.Pi*u2)
}

func (r *lcgRand) perm(n int) []int {
	p := make([]int, n)
	for i := range p {
		p[i] = i
	}
	for i := n - 1; i > 0; i-- {
		j := r.intn(i + 1)
		p[i], p[j] = p[j], p[i]
	}
	return p
}

// ─── Plugging EIF into the detector ─────────────────────────────────────────

// forest is the live trained isolation forest, rebuilt from baselines periodically.
// Stored per-agent in the AnomalyDetector (one forest per agent baseline).
// For simplicity we use a single global forest here; per-agent forests can be
// added by keying forests map[string]*isolationForest on agentID.
var globalForest *isolationForest

// rebuildForest trains a new forest from the current set of baselines.
// Call this periodically (e.g., hourly) after baselines accumulate enough samples.
func (ad *AnomalyDetector) rebuildForest() {
	ad.mutex.RLock()
	baselines := ad.baselines
	ad.mutex.RUnlock()

	var samples [][]float64
	for _, b := range baselines {
		if b.SampleCount < 10 {
			continue
		}
		// Synthesize representative sample from baseline statistics.
		for i := 0; i < 20 && i < b.SampleCount; i++ {
			samples = append(samples, []float64{
				b.ConfidenceMean,
				b.LatencyMean,
				0.0, // action rarity — baseline is "normal"
				0.0,
				0.0,
				0.0, 0.0, 0.0,
			})
		}
	}
	if len(samples) < 20 {
		return
	}
	globalForest = trainForest(samples, ad.config.NumTrees, ad.config.SubsampleSize, 42)
}

// calculateAnomalyScore uses the real Isolation Forest when trained,
// falls back to calibrated z-scores otherwise.
func (ad *AnomalyDetector) calculateAnomalyScore(features *FeatureVector, baseline *BehavioralBaseline) float64 {
	vec := featureToVec(features)

	// Use real Isolation Forest if available.
	if globalForest != nil {
		return globalForest.anomalyScore(vec)
	}

	// Fallback: calibrated z-score with per-feature dynamic thresholds.
	// Uses 3σ normalization but with feature importance weighting.
	type featureScore struct {
		score  float64
		weight float64
		name   string
	}

	fs := []featureScore{
		{math.Min(features.ConfidenceDeviation/3.0, 1.0), ad.config.ConfidenceWeight, "confidence"},
		{math.Min(features.LatencyDeviation/3.0, 1.0), ad.config.LatencyWeight, "latency"},
		{math.Min(features.ActionRarity/10.0, 1.0), ad.config.PatternWeight * 0.4, "action_rarity"},
		{math.Min(features.TimeOfDayRarity/5.0, 1.0), ad.config.PatternWeight * 0.3, "time_rarity"},
		{math.Min(features.OutcomeRarity/5.0, 1.0), ad.config.PatternWeight * 0.3, "outcome_rarity"},
	}

	// Multivariate interaction: high confidence + unusual time = escalate.
	if features.ConfidenceDeviation > 2.0 && features.TimeOfDayRarity > 3.0 {
		for i := range fs {
			fs[i].score = math.Min(fs[i].score*1.3, 1.0)
		}
	}

	totalScore, totalWeight := 0.0, 0.0
	for _, f := range fs {
		totalScore += f.score * f.weight
		totalWeight += f.weight
	}
	if totalWeight == 0 {
		return 0
	}
	return totalScore / totalWeight
}

// getSeverity determines anomaly severity based on score
func (ad *AnomalyDetector) getSeverity(score float64) string {
	switch {
	case score >= ad.config.SevereThreshold:
		return "severe"
	case score >= ad.config.AnomalyThreshold+0.1:
		return "high"
	case score >= ad.config.AnomalyThreshold:
		return "medium"
	case score >= ad.config.AnomalyThreshold-0.1:
		return "low"
	default:
		return "none"
	}
}

// generateExplanation creates human-readable explanation for anomaly
func (ad *AnomalyDetector) generateExplanation(features *FeatureVector, baseline *BehavioralBaseline, score float64) string {
	if score < ad.config.AnomalyThreshold {
		return "Normal behavior within expected parameters"
	}

	explanations := []string{}

	// Confidence explanations
	if features.ConfidenceDeviation > 2.0 {
		if features.Confidence > baseline.ConfidenceMean {
			explanations = append(explanations, "unusually high confidence")
		} else {
			explanations = append(explanations, "unusually low confidence")
		}
	}

	// Latency explanations
	if features.LatencyDeviation > 2.0 {
		if features.Latency > baseline.LatencyMean {
			explanations = append(explanations, "unusually slow response")
		} else {
			explanations = append(explanations, "unusually fast response")
		}
	}

	// Pattern explanations
	if features.ActionRarity > 5.0 {
		explanations = append(explanations, "rare action type")
	}
	if features.TimeOfDayRarity > 3.0 {
		explanations = append(explanations, "unusual time of activity")
	}
	if features.OutcomeRarity > 3.0 {
		explanations = append(explanations, "uncommon decision outcome")
	}

	if len(explanations) == 0 {
		return "Anomalous behavior detected"
	}

	result := "Detected: "
	for i, exp := range explanations {
		if i > 0 {
			result += ", "
		}
		result += exp
	}

	return result
}

// getBaseline retrieves or creates behavioral baseline for an agent
func (ad *AnomalyDetector) getBaseline(ctx context.Context, agentID string) (*BehavioralBaseline, error) {
	// Check cache first
	ad.mutex.RLock()
	if cached, exists := ad.baselines[agentID]; exists {
		ad.mutex.RUnlock()
		return cached, nil
	}
	ad.mutex.RUnlock()

	// Load from database
	query := `
		SELECT agent_id, created_at, updated_at, sample_count,
			   confidence_mean, confidence_std_dev, latency_mean, latency_std_dev,
			   action_frequencies, hourly_patterns, decision_outcomes,
			   confidence_distribution, latency_percentiles
		FROM behavioral_baselines 
		WHERE agent_id = ?
	`

	var baseline BehavioralBaseline
	var actionFreqJSON, hourlyPatternsJSON, outcomesJSON, confDistJSON, latencyPercJSON string

	err := ad.db.QueryRowContext(ctx, query, agentID).Scan(
		&baseline.AgentID, &baseline.CreatedAt, &baseline.UpdatedAt, &baseline.SampleCount,
		&baseline.ConfidenceMean, &baseline.ConfidenceStdDev, &baseline.LatencyMean, &baseline.LatencyStdDev,
		&actionFreqJSON, &hourlyPatternsJSON, &outcomesJSON, &confDistJSON, &latencyPercJSON,
	)

	if err == sql.ErrNoRows {
		// Create new baseline
		baseline = BehavioralBaseline{
			AgentID:            agentID,
			CreatedAt:          time.Now(),
			UpdatedAt:          time.Now(),
			SampleCount:        0,
			ActionFrequencies:  make(map[string]float64),
			DecisionOutcomes:   make(map[string]float64),
			LatencyPercentiles: make(map[string]float64),
		}
	} else if err != nil {
		return nil, fmt.Errorf("failed to get baseline: %w", err)
	} else {
		// Parse JSON fields with error checking
		if err := json.Unmarshal([]byte(actionFreqJSON), &baseline.ActionFrequencies); err != nil {
			return nil, fmt.Errorf("failed to unmarshal action frequencies: %w", err)
		}
		if err := json.Unmarshal([]byte(hourlyPatternsJSON), &baseline.HourlyPatterns); err != nil {
			return nil, fmt.Errorf("failed to unmarshal hourly patterns: %w", err)
		}
		if err := json.Unmarshal([]byte(outcomesJSON), &baseline.DecisionOutcomes); err != nil {
			return nil, fmt.Errorf("failed to unmarshal decision outcomes: %w", err)
		}
		if err := json.Unmarshal([]byte(confDistJSON), &baseline.ConfidenceDistribution); err != nil {
			return nil, fmt.Errorf("failed to unmarshal confidence distribution: %w", err)
		}
		if err := json.Unmarshal([]byte(latencyPercJSON), &baseline.LatencyPercentiles); err != nil {
			return nil, fmt.Errorf("failed to unmarshal latency percentiles: %w", err)
		}
	}

	// Cache the result
	ad.mutex.Lock()
	ad.baselines[agentID] = &baseline
	ad.mutex.Unlock()

	return &baseline, nil
}

// UpdateBaseline updates behavioral baseline with new decision data
func (ad *AnomalyDetector) UpdateBaseline(ctx context.Context, agentID, action, outcome string,
	confidence float64, latency time.Duration) error {

	baseline, err := ad.getBaseline(ctx, agentID)
	if err != nil {
		return err
	}

	// Update statistical measures
	baseline.SampleCount++

	// Update confidence statistics (running average and std dev)
	if baseline.SampleCount == 1 {
		baseline.ConfidenceMean = confidence
		baseline.ConfidenceStdDev = 0
	} else {
		// Online algorithm for mean and variance
		delta := confidence - baseline.ConfidenceMean
		baseline.ConfidenceMean += delta / float64(baseline.SampleCount)
		delta2 := confidence - baseline.ConfidenceMean

		// Update variance (simplified)
		if baseline.SampleCount > 1 {
			variance := (float64(baseline.SampleCount-2)*math.Pow(baseline.ConfidenceStdDev, 2) + delta*delta2) / float64(baseline.SampleCount-1)
			baseline.ConfidenceStdDev = math.Sqrt(variance)
		}
	}

	// Update latency statistics
	latencySeconds := latency.Seconds()
	if baseline.SampleCount == 1 {
		baseline.LatencyMean = latencySeconds
		baseline.LatencyStdDev = 0
	} else {
		delta := latencySeconds - baseline.LatencyMean
		baseline.LatencyMean += delta / float64(baseline.SampleCount)
		delta2 := latencySeconds - baseline.LatencyMean

		if baseline.SampleCount > 1 {
			variance := (float64(baseline.SampleCount-2)*math.Pow(baseline.LatencyStdDev, 2) + delta*delta2) / float64(baseline.SampleCount-1)
			baseline.LatencyStdDev = math.Sqrt(variance)
		}
	}

	// Update action frequencies
	if baseline.ActionFrequencies == nil {
		baseline.ActionFrequencies = make(map[string]float64)
	}
	baseline.ActionFrequencies[action] = (baseline.ActionFrequencies[action]*float64(baseline.SampleCount-1) + 1.0) / float64(baseline.SampleCount)

	// Update hourly patterns
	hour := time.Now().Hour()
	baseline.HourlyPatterns[hour] = (baseline.HourlyPatterns[hour]*float64(baseline.SampleCount-1) + 1.0) / float64(baseline.SampleCount)

	// Update decision outcomes
	if baseline.DecisionOutcomes == nil {
		baseline.DecisionOutcomes = make(map[string]float64)
	}
	baseline.DecisionOutcomes[outcome] = (baseline.DecisionOutcomes[outcome]*float64(baseline.SampleCount-1) + 1.0) / float64(baseline.SampleCount)

	baseline.UpdatedAt = time.Now()

	// Save to database
	return ad.saveBaseline(ctx, baseline)
}

// saveBaseline saves behavioral baseline to database
func (ad *AnomalyDetector) saveBaseline(ctx context.Context, baseline *BehavioralBaseline) error {
	actionFreqJSON, err := json.Marshal(baseline.ActionFrequencies)
	if err != nil {
		return fmt.Errorf("anomaly: marshal action_frequencies: %w", err)
	}
	hourlyPatternsJSON, err := json.Marshal(baseline.HourlyPatterns)
	if err != nil {
		return fmt.Errorf("anomaly: marshal hourly_patterns: %w", err)
	}
	outcomesJSON, err := json.Marshal(baseline.DecisionOutcomes)
	if err != nil {
		return fmt.Errorf("anomaly: marshal decision_outcomes: %w", err)
	}
	confDistJSON, err := json.Marshal(baseline.ConfidenceDistribution)
	if err != nil {
		return fmt.Errorf("anomaly: marshal confidence_distribution: %w", err)
	}
	latencyPercJSON, err := json.Marshal(baseline.LatencyPercentiles)
	if err != nil {
		return fmt.Errorf("anomaly: marshal latency_percentiles: %w", err)
	}

	query := `
		INSERT INTO behavioral_baselines (
			agent_id, created_at, updated_at, sample_count,
			confidence_mean, confidence_std_dev, latency_mean, latency_std_dev,
			action_frequencies, hourly_patterns, decision_outcomes,
			confidence_distribution, latency_percentiles
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(agent_id) DO UPDATE SET
			updated_at = ?, sample_count = ?, confidence_mean = ?, confidence_std_dev = ?,
			latency_mean = ?, latency_std_dev = ?, action_frequencies = ?,
			hourly_patterns = ?, decision_outcomes = ?, confidence_distribution = ?,
			latency_percentiles = ?
	`

	_, err = ad.db.ExecContext(ctx, query,
		baseline.AgentID, baseline.CreatedAt, baseline.UpdatedAt, baseline.SampleCount,
		baseline.ConfidenceMean, baseline.ConfidenceStdDev, baseline.LatencyMean, baseline.LatencyStdDev,
		string(actionFreqJSON), string(hourlyPatternsJSON), string(outcomesJSON),
		string(confDistJSON), string(latencyPercJSON),
		// ON CONFLICT UPDATE values
		baseline.UpdatedAt, baseline.SampleCount, baseline.ConfidenceMean, baseline.ConfidenceStdDev,
		baseline.LatencyMean, baseline.LatencyStdDev, string(actionFreqJSON),
		string(hourlyPatternsJSON), string(outcomesJSON), string(confDistJSON), string(latencyPercJSON),
	)

	if err != nil {
		return fmt.Errorf("failed to save baseline: %w", err)
	}

	// Update metrics
	ad.baselineGauge.WithLabelValues(baseline.AgentID, "unknown").Set(float64(baseline.SampleCount))

	return nil
}

// storeAnomalyResult stores anomaly detection result
func (ad *AnomalyDetector) storeAnomalyResult(ctx context.Context, result *AnomalyResult) error {
	featuresJSON, err := json.Marshal(result.Features)
	if err != nil {
		return fmt.Errorf("anomaly: marshal features: %w", err)
	}

	query := `
		INSERT INTO anomaly_results (
			agent_id, timestamp, anomaly_score, is_anomaly, severity,
			features, explanation, action, confidence, latency_ms, outcome
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err = ad.db.ExecContext(ctx, query,
		result.AgentID, result.Timestamp, result.AnomalyScore, result.IsAnomaly, result.Severity,
		string(featuresJSON), result.Explanation, result.Action, result.Confidence,
		result.Latency.Milliseconds(), result.Outcome,
	)

	return err
}

// featuresToMap converts FeatureVector to map for JSON serialization
func (ad *AnomalyDetector) featuresToMap(features *FeatureVector) map[string]float64 {
	return map[string]float64{
		"confidence":           features.Confidence,
		"confidence_deviation": features.ConfidenceDeviation,
		"latency":              features.Latency,
		"latency_deviation":    features.LatencyDeviation,
		"action_rarity":        features.ActionRarity,
		"time_of_day_rarity":   features.TimeOfDayRarity,
		"outcome_rarity":       features.OutcomeRarity,
		"recent_error_rate":    features.RecentErrorRate,
		"confidence_trend":     features.ConfidenceTrend,
		"latency_trend":        features.LatencyTrend,
	}
}

// startBaselineUpdater runs background baseline updates
func (ad *AnomalyDetector) startBaselineUpdater() {
	ticker := time.NewTicker(ad.config.BaselineUpdateFreq)
	defer ticker.Stop()

	for range ticker.C {
		// Clear cache to force reload of updated baselines
		ad.mutex.Lock()
		ad.baselines = make(map[string]*BehavioralBaseline)
		ad.mutex.Unlock()
	}
}

// GetRecentAnomalies returns recent anomalies for an agent
func (ad *AnomalyDetector) GetRecentAnomalies(ctx context.Context, agentID string, since time.Time) ([]*AnomalyResult, error) {
	query := `
		SELECT agent_id, timestamp, anomaly_score, is_anomaly, severity,
			   features, explanation, action, confidence, latency_ms, outcome
		FROM anomaly_results 
		WHERE agent_id = ? AND timestamp >= ?
		ORDER BY timestamp DESC
	`

	rows, err := ad.db.QueryContext(ctx, query, agentID, since)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent anomalies: %w", err)
	}
	defer rows.Close()

	var results []*AnomalyResult
	for rows.Next() {
		var result AnomalyResult
		var featuresJSON string
		var latencyMs int64

		err := rows.Scan(
			&result.AgentID, &result.Timestamp, &result.AnomalyScore, &result.IsAnomaly, &result.Severity,
			&featuresJSON, &result.Explanation, &result.Action, &result.Confidence, &latencyMs, &result.Outcome,
		)
		if err != nil {
			continue
		}

		result.Latency = time.Duration(latencyMs) * time.Millisecond
		if err := json.Unmarshal([]byte(featuresJSON), &result.Features); err != nil {
			// Log error but continue processing other results
			continue
		}

		results = append(results, &result)
	}

	// Return empty slice instead of nil if no results
	if results == nil {
		results = []*AnomalyResult{}
	}

	return results, nil
}
