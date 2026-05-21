package observability

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// BaselineManager handles behavioral baseline establishment and management
type BaselineManager struct {
	db       *sql.DB
	config   BaselineConfig
	shutdown chan struct{}

	// Prometheus metrics
	baselineHealthGauge prometheus.GaugeVec
	baselineAgeGauge    prometheus.GaugeVec
	baselineDriftGauge  prometheus.GaugeVec
}

// BaselineConfig configures baseline management parameters
type BaselineConfig struct {
	// Baseline establishment
	MinSamplesForBaseline int           // Minimum samples needed for reliable baseline
	BaselineWindow        time.Duration // Time window for baseline calculation
	MaxBaselineAge        time.Duration // Maximum age before baseline refresh

	// Drift detection
	DriftDetectionWindow time.Duration // Window for drift detection
	DriftThreshold       float64       // Threshold for significant drift
	DriftSensitivity     float64       // Sensitivity for drift detection

	// Baseline quality
	MinConfidenceVariance float64 // Minimum variance for confidence baseline
	MinLatencyVariance    float64 // Minimum variance for latency baseline
	MinActionDiversity    int     // Minimum number of different actions

	// Update frequency
	BaselineRefreshInterval time.Duration // How often to refresh baselines
	DriftCheckInterval      time.Duration // How often to check for drift
}

// BaselineHealth represents the health status of a behavioral baseline
type BaselineHealth struct {
	AgentID       string        `json:"agent_id"`
	OverallHealth float64       `json:"overall_health"` // 0-1 health score
	SampleCount   int           `json:"sample_count"`
	Age           time.Duration `json:"age"`
	LastUpdated   time.Time     `json:"last_updated"`

	// Quality metrics
	ConfidenceVariance float64 `json:"confidence_variance"`
	LatencyVariance    float64 `json:"latency_variance"`
	ActionDiversity    int     `json:"action_diversity"`
	TemporalCoverage   float64 `json:"temporal_coverage"` // How well it covers different times

	// Drift metrics
	ConfidenceDrift float64 `json:"confidence_drift"`
	LatencyDrift    float64 `json:"latency_drift"`
	PatternDrift    float64 `json:"pattern_drift"`

	// Recommendations
	NeedsRefresh       bool     `json:"needs_refresh"`
	RecommendedActions []string `json:"recommended_actions"`
}

// DriftAnalysis represents drift detection results
type DriftAnalysis struct {
	AgentID    string    `json:"agent_id"`
	DetectedAt time.Time `json:"detected_at"`
	DriftScore float64   `json:"drift_score"` // 0-1, higher = more drift
	DriftType  string    `json:"drift_type"`  // "confidence", "latency", "pattern", "combined"
	Severity   string    `json:"severity"`    // "low", "medium", "high", "critical"

	// Specific drift metrics
	ConfidenceDrift DriftMetric `json:"confidence_drift"`
	LatencyDrift    DriftMetric `json:"latency_drift"`
	PatternDrift    DriftMetric `json:"pattern_drift"`

	// Context
	BaselineAge     time.Duration `json:"baseline_age"`
	RecentSamples   int           `json:"recent_samples"`
	Explanation     string        `json:"explanation"`
	Recommendations []string      `json:"recommendations"`
}

// DriftMetric represents drift in a specific metric
type DriftMetric struct {
	MetricName      string  `json:"metric_name"`
	BaselineValue   float64 `json:"baseline_value"`
	CurrentValue    float64 `json:"current_value"`
	DriftMagnitude  float64 `json:"drift_magnitude"`  // Absolute change
	DriftPercentage float64 `json:"drift_percentage"` // Percentage change
	IsSignificant   bool    `json:"is_significant"`
}

// DefaultBaselineConfig returns sensible defaults for baseline management
func DefaultBaselineConfig() BaselineConfig {
	return BaselineConfig{
		MinSamplesForBaseline: 100,                 // Need 100 samples minimum
		BaselineWindow:        7 * 24 * time.Hour,  // 1 week baseline window
		MaxBaselineAge:        30 * 24 * time.Hour, // Refresh after 30 days

		DriftDetectionWindow: 24 * time.Hour, // Check drift over 24 hours
		DriftThreshold:       0.2,            // 20% change is significant
		DriftSensitivity:     0.1,            // 10% sensitivity

		MinConfidenceVariance: 0.01, // Minimum confidence variance
		MinLatencyVariance:    0.1,  // Minimum latency variance (seconds)
		MinActionDiversity:    3,    // At least 3 different actions

		BaselineRefreshInterval: 6 * time.Hour, // Refresh every 6 hours
		DriftCheckInterval:      1 * time.Hour, // Check drift hourly
	}
}

// NewBaselineManager creates a new baseline manager
func NewBaselineManager(db *sql.DB, config BaselineConfig) *BaselineManager {
	bm := &BaselineManager{
		db:       db,
		config:   config,
		shutdown: make(chan struct{}),

		baselineHealthGauge: *promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "ai_agent_baseline_health",
				Help: "Health score of agent behavioral baselines (0-1)",
			},
			[]string{"agent_id", "agent_type"},
		),

		baselineAgeGauge: *promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "ai_agent_baseline_age_hours",
				Help: "Age of agent behavioral baselines in hours",
			},
			[]string{"agent_id", "agent_type"},
		),

		baselineDriftGauge: *promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "ai_agent_baseline_drift_score",
				Help: "Drift score for agent behavioral baselines (0-1)",
			},
			[]string{"agent_id", "agent_type", "drift_type"},
		),
	}

	// Start background processes
	go bm.startBaselineRefresher()
	go bm.startDriftDetector()

	return bm
}

// Shutdown stops background goroutines. Safe to call once.
func (bm *BaselineManager) Shutdown() {
	close(bm.shutdown)
}

// AssessBaselineHealth evaluates the health of an agent's behavioral baseline
func (bm *BaselineManager) AssessBaselineHealth(ctx context.Context, agentID string) (*BaselineHealth, error) {
	// Get baseline from database
	baseline, err := bm.getBaselineFromDB(ctx, agentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get baseline: %w", err)
	}

	if baseline == nil {
		return &BaselineHealth{
			AgentID:            agentID,
			OverallHealth:      0.0,
			NeedsRefresh:       true,
			RecommendedActions: []string{"Establish initial baseline - insufficient data"},
		}, nil
	}

	health := &BaselineHealth{
		AgentID:     agentID,
		SampleCount: baseline.SampleCount,
		Age:         time.Since(baseline.CreatedAt),
		LastUpdated: baseline.UpdatedAt,
	}

	// Calculate quality metrics
	health.ConfidenceVariance = math.Pow(baseline.ConfidenceStdDev, 2)
	health.LatencyVariance = math.Pow(baseline.LatencyStdDev, 2)
	health.ActionDiversity = len(baseline.ActionFrequencies)
	health.TemporalCoverage = bm.calculateTemporalCoverage(baseline.HourlyPatterns)

	// Calculate drift metrics
	health.ConfidenceDrift, health.LatencyDrift, health.PatternDrift = bm.calculateDriftMetrics(ctx, agentID, baseline)

	// Calculate overall health score
	health.OverallHealth = bm.calculateOverallHealth(health)

	// Determine if refresh is needed
	health.NeedsRefresh = bm.needsRefresh(health)

	// Generate recommendations
	health.RecommendedActions = bm.generateHealthRecommendations(health)

	// Update metrics
	bm.baselineHealthGauge.WithLabelValues(agentID, "unknown").Set(health.OverallHealth)
	bm.baselineAgeGauge.WithLabelValues(agentID, "unknown").Set(health.Age.Hours())

	return health, nil
}

// DetectDrift analyzes recent behavior for drift from established baseline
func (bm *BaselineManager) DetectDrift(ctx context.Context, agentID string) (*DriftAnalysis, error) {
	// Get current baseline
	baseline, err := bm.getBaselineFromDB(ctx, agentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get baseline: %w", err)
	}

	if baseline == nil || baseline.SampleCount < bm.config.MinSamplesForBaseline {
		return &DriftAnalysis{
			AgentID:     agentID,
			DetectedAt:  time.Now(),
			DriftScore:  0.0,
			DriftType:   "none",
			Severity:    "none",
			Explanation: "Insufficient baseline data for drift detection",
		}, nil
	}

	// Get recent behavior data
	recentData, err := bm.getRecentBehaviorData(ctx, agentID, bm.config.DriftDetectionWindow)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent data: %w", err)
	}

	if len(recentData) == 0 {
		return &DriftAnalysis{
			AgentID:     agentID,
			DetectedAt:  time.Now(),
			DriftScore:  0.0,
			DriftType:   "none",
			Severity:    "none",
			Explanation: "No recent activity for drift analysis",
		}, nil
	}

	analysis := &DriftAnalysis{
		AgentID:       agentID,
		DetectedAt:    time.Now(),
		BaselineAge:   time.Since(baseline.CreatedAt),
		RecentSamples: len(recentData),
	}

	// Analyze confidence drift
	analysis.ConfidenceDrift = bm.analyzeConfidenceDrift(baseline, recentData)

	// Analyze latency drift
	analysis.LatencyDrift = bm.analyzeLatencyDrift(baseline, recentData)

	// Analyze pattern drift
	analysis.PatternDrift = bm.analyzePatternDrift(baseline, recentData)

	// Calculate overall drift score
	analysis.DriftScore = bm.calculateOverallDriftScore(analysis)

	// Determine drift type and severity
	analysis.DriftType = bm.determineDriftType(analysis)
	analysis.Severity = bm.determineDriftSeverity(analysis.DriftScore)

	// Generate explanation and recommendations
	analysis.Explanation = bm.generateDriftExplanation(analysis)
	analysis.Recommendations = bm.generateDriftRecommendations(analysis)

	// Update metrics
	bm.baselineDriftGauge.WithLabelValues(agentID, "unknown", "confidence").Set(analysis.ConfidenceDrift.DriftMagnitude)
	bm.baselineDriftGauge.WithLabelValues(agentID, "unknown", "latency").Set(analysis.LatencyDrift.DriftMagnitude)
	bm.baselineDriftGauge.WithLabelValues(agentID, "unknown", "pattern").Set(analysis.PatternDrift.DriftMagnitude)

	return analysis, nil
}

// RefreshBaseline recalculates baseline using recent data
func (bm *BaselineManager) RefreshBaseline(ctx context.Context, agentID string) error {
	// Get recent behavior data for baseline calculation
	recentData, err := bm.getRecentBehaviorData(ctx, agentID, bm.config.BaselineWindow)
	if err != nil {
		return fmt.Errorf("failed to get recent data: %w", err)
	}

	if len(recentData) < bm.config.MinSamplesForBaseline {
		return fmt.Errorf("insufficient data for baseline refresh: %d samples (need %d)",
			len(recentData), bm.config.MinSamplesForBaseline)
	}

	// Calculate new baseline statistics
	newBaseline := bm.calculateBaselineFromData(agentID, recentData)

	// Save new baseline
	return bm.saveBaseline(ctx, newBaseline)
}

// UpdateBaseline updates baseline with a single decision data point
// UpdateBaseline records a single decision data point to agent_decisions so
// that drift detection and baseline refresh can use it later.
func (bm *BaselineManager) UpdateBaseline(ctx context.Context, agentID, action, outcome string, confidence float64, latency time.Duration) error {
	_, err := bm.db.ExecContext(ctx, `
		INSERT INTO agent_decisions (agent_id, action, confidence, latency_ms, outcome)
		VALUES (?, ?, ?, ?, ?)
	`, agentID, action, confidence, latency.Milliseconds(), outcome)
	if err != nil {
		return fmt.Errorf("baseline: record decision: %w", err)
	}
	return nil
}

// calculateTemporalCoverage calculates how well the baseline covers different time periods
func (bm *BaselineManager) calculateTemporalCoverage(hourlyPatterns [24]float64) float64 {
	nonZeroHours := 0
	for _, pattern := range hourlyPatterns {
		if pattern > 0 {
			nonZeroHours++
		}
	}
	return float64(nonZeroHours) / 24.0
}

// calculateDriftMetrics calculates drift metrics for confidence, latency, and patterns
func (bm *BaselineManager) calculateDriftMetrics(ctx context.Context, agentID string, baseline *BehavioralBaseline) (float64, float64, float64) {
	// Get recent data for drift calculation
	recentData, err := bm.getRecentBehaviorData(ctx, agentID, bm.config.DriftDetectionWindow)
	if err != nil || len(recentData) == 0 {
		return 0.0, 0.0, 0.0
	}

	// Calculate recent statistics
	recentConfidenceMean := 0.0
	recentLatencyMean := 0.0
	for _, data := range recentData {
		recentConfidenceMean += data.Confidence
		recentLatencyMean += data.Latency.Seconds()
	}
	recentConfidenceMean /= float64(len(recentData))
	recentLatencyMean /= float64(len(recentData))

	// Calculate drift magnitudes
	confidenceDrift := math.Abs(recentConfidenceMean - baseline.ConfidenceMean)
	latencyDrift := math.Abs(recentLatencyMean - baseline.LatencyMean)

	// Pattern drift (simplified - could be more sophisticated)
	patternDrift := 0.0
	recentActionFreq := make(map[string]int)
	for _, data := range recentData {
		recentActionFreq[data.Action]++
	}

	// Compare action frequency distributions
	for action, baselineFreq := range baseline.ActionFrequencies {
		recentFreq := float64(recentActionFreq[action]) / float64(len(recentData))
		patternDrift += math.Abs(recentFreq - baselineFreq)
	}

	return confidenceDrift, latencyDrift, patternDrift
}

// calculateOverallHealth computes overall health score from individual metrics
func (bm *BaselineManager) calculateOverallHealth(health *BaselineHealth) float64 {
	scores := []float64{}

	// Sample count score
	sampleScore := math.Min(float64(health.SampleCount)/float64(bm.config.MinSamplesForBaseline), 1.0)
	scores = append(scores, sampleScore)

	// Age score (newer is better, but not too new)
	ageHours := health.Age.Hours()
	ageScore := 1.0
	if ageHours > bm.config.MaxBaselineAge.Hours() {
		ageScore = math.Max(0.0, 1.0-(ageHours-bm.config.MaxBaselineAge.Hours())/(7*24)) // Decay over week
	}
	scores = append(scores, ageScore)

	// Variance scores (need sufficient variance for meaningful baseline)
	confVarianceScore := math.Min(health.ConfidenceVariance/bm.config.MinConfidenceVariance, 1.0)
	latencyVarianceScore := math.Min(health.LatencyVariance/bm.config.MinLatencyVariance, 1.0)
	scores = append(scores, confVarianceScore, latencyVarianceScore)

	// Diversity score
	diversityScore := math.Min(float64(health.ActionDiversity)/float64(bm.config.MinActionDiversity), 1.0)
	scores = append(scores, diversityScore)

	// Temporal coverage score
	scores = append(scores, health.TemporalCoverage)

	// Drift penalty (lower drift = higher health)
	driftPenalty := (health.ConfidenceDrift + health.LatencyDrift + health.PatternDrift) / 3.0
	driftScore := math.Max(0.0, 1.0-driftPenalty)
	scores = append(scores, driftScore)

	// Calculate weighted average
	totalScore := 0.0
	for _, score := range scores {
		totalScore += score
	}

	return totalScore / float64(len(scores))
}

// needsRefresh determines if baseline needs to be refreshed
func (bm *BaselineManager) needsRefresh(health *BaselineHealth) bool {
	// Age-based refresh
	if health.Age > bm.config.MaxBaselineAge {
		return true
	}

	// Health-based refresh
	if health.OverallHealth < 0.6 {
		return true
	}

	// Drift-based refresh
	totalDrift := health.ConfidenceDrift + health.LatencyDrift + health.PatternDrift
	return totalDrift > bm.config.DriftThreshold*3
}

// generateHealthRecommendations generates actionable recommendations for baseline health
func (bm *BaselineManager) generateHealthRecommendations(health *BaselineHealth) []string {
	recommendations := []string{}

	if health.SampleCount < bm.config.MinSamplesForBaseline {
		recommendations = append(recommendations,
			fmt.Sprintf("Collect more samples (%d/%d)", health.SampleCount, bm.config.MinSamplesForBaseline))
	}

	if health.Age > bm.config.MaxBaselineAge {
		recommendations = append(recommendations, "Refresh baseline - data is stale")
	}

	if health.ActionDiversity < bm.config.MinActionDiversity {
		recommendations = append(recommendations, "Increase action diversity for better baseline")
	}

	if health.TemporalCoverage < 0.5 {
		recommendations = append(recommendations, "Collect data across more time periods")
	}

	if health.ConfidenceDrift > bm.config.DriftThreshold {
		recommendations = append(recommendations, "Investigate confidence drift")
	}

	if health.LatencyDrift > bm.config.DriftThreshold {
		recommendations = append(recommendations, "Investigate latency drift")
	}

	if health.PatternDrift > bm.config.DriftThreshold {
		recommendations = append(recommendations, "Investigate behavioral pattern changes")
	}

	if len(recommendations) == 0 {
		recommendations = append(recommendations, "Baseline health is good")
	}

	return recommendations
}

// BehaviorData represents a single behavioral data point
type BehaviorData struct {
	Timestamp  time.Time
	Action     string
	Confidence float64
	Latency    time.Duration
	Outcome    string
}

// getRecentBehaviorData retrieves recent behavioral data for an agent
func (bm *BaselineManager) getRecentBehaviorData(ctx context.Context, agentID string, window time.Duration) ([]*BehaviorData, error) {
	query := `
		SELECT timestamp, action, confidence, latency_ms, outcome
		FROM agent_decisions 
		WHERE agent_id = ? AND timestamp >= ?
		ORDER BY timestamp DESC
	`

	since := time.Now().Add(-window)
	rows, err := bm.db.QueryContext(ctx, query, agentID, since)
	if err != nil {
		return nil, fmt.Errorf("failed to query recent behavior data: %w", err)
	}
	defer rows.Close()

	var data []*BehaviorData
	for rows.Next() {
		var bd BehaviorData
		var latencyMs int64

		err := rows.Scan(&bd.Timestamp, &bd.Action, &bd.Confidence, &latencyMs, &bd.Outcome)
		if err != nil {
			continue
		}

		bd.Latency = time.Duration(latencyMs) * time.Millisecond
		data = append(data, &bd)
	}

	return data, nil
}

func (bm *BaselineManager) analyzeConfidenceDrift(baseline *BehavioralBaseline, recentData []*BehaviorData) DriftMetric {
	if len(recentData) == 0 {
		return DriftMetric{MetricName: "confidence"}
	}
	var sum float64
	for _, d := range recentData {
		sum += d.Confidence
	}
	recentMean := sum / float64(len(recentData))
	magnitude := math.Abs(recentMean - baseline.ConfidenceMean)
	pct := 0.0
	if baseline.ConfidenceMean > 0 {
		pct = magnitude / baseline.ConfidenceMean
	}
	return DriftMetric{
		MetricName:      "confidence",
		BaselineValue:   baseline.ConfidenceMean,
		CurrentValue:    recentMean,
		DriftMagnitude:  magnitude,
		DriftPercentage: pct,
		IsSignificant:   magnitude > bm.config.DriftThreshold,
	}
}

func (bm *BaselineManager) analyzeLatencyDrift(baseline *BehavioralBaseline, recentData []*BehaviorData) DriftMetric {
	if len(recentData) == 0 {
		return DriftMetric{MetricName: "latency"}
	}
	var sum float64
	for _, d := range recentData {
		sum += d.Latency.Seconds()
	}
	recentMean := sum / float64(len(recentData))
	magnitude := math.Abs(recentMean - baseline.LatencyMean)
	pct := 0.0
	if baseline.LatencyMean > 0 {
		pct = magnitude / baseline.LatencyMean
	}
	return DriftMetric{
		MetricName:      "latency",
		BaselineValue:   baseline.LatencyMean,
		CurrentValue:    recentMean,
		DriftMagnitude:  magnitude,
		DriftPercentage: pct,
		IsSignificant:   pct > bm.config.DriftThreshold,
	}
}

func (bm *BaselineManager) analyzePatternDrift(baseline *BehavioralBaseline, recentData []*BehaviorData) DriftMetric {
	if len(recentData) == 0 {
		return DriftMetric{MetricName: "pattern"}
	}
	recentFreq := make(map[string]float64)
	for _, d := range recentData {
		recentFreq[d.Action]++
	}
	n := float64(len(recentData))
	for k := range recentFreq {
		recentFreq[k] /= n
	}
	// Total variation distance between distributions.
	tvd := 0.0
	seen := make(map[string]bool)
	for action, baseFreq := range baseline.ActionFrequencies {
		tvd += math.Abs(baseFreq - recentFreq[action])
		seen[action] = true
	}
	for action, recentF := range recentFreq {
		if !seen[action] {
			tvd += recentF
		}
	}
	// TVD is in [0,2]; divide by 2 to normalize to [0,1].
	magnitude := math.Min(tvd/2.0, 1.0)
	return DriftMetric{
		MetricName:      "pattern",
		DriftMagnitude:  magnitude,
		DriftPercentage: magnitude,
		IsSignificant:   magnitude > bm.config.DriftThreshold,
	}
}

func (bm *BaselineManager) calculateOverallDriftScore(analysis *DriftAnalysis) float64 {
	// Normalize: confidence magnitude is already [0,1]; latency uses percentage; pattern is [0,1].
	confScore := math.Min(analysis.ConfidenceDrift.DriftMagnitude, 1.0)
	latScore := math.Min(analysis.LatencyDrift.DriftPercentage, 1.0)
	patScore := math.Min(analysis.PatternDrift.DriftMagnitude, 1.0)
	return confScore*0.4 + latScore*0.3 + patScore*0.3
}

func (bm *BaselineManager) determineDriftType(analysis *DriftAnalysis) string {
	t := bm.config.DriftSensitivity
	confSig := analysis.ConfidenceDrift.DriftMagnitude > t
	latSig := analysis.LatencyDrift.DriftPercentage > t
	patSig := analysis.PatternDrift.DriftMagnitude > t

	count := 0
	if confSig {
		count++
	}
	if latSig {
		count++
	}
	if patSig {
		count++
	}
	if count >= 2 {
		return "combined"
	}
	if confSig {
		return "confidence"
	}
	if latSig {
		return "latency"
	}
	if patSig {
		return "pattern"
	}
	return "none"
}

func (bm *BaselineManager) determineDriftSeverity(score float64) string {
	switch {
	case score < 0.1:
		return "none"
	case score < 0.3:
		return "low"
	case score < 0.5:
		return "medium"
	case score < 0.7:
		return "high"
	default:
		return "critical"
	}
}

func (bm *BaselineManager) generateDriftExplanation(analysis *DriftAnalysis) string {
	if analysis.DriftType == "none" {
		return "No significant behavioral drift detected."
	}
	var parts []string
	if analysis.ConfidenceDrift.IsSignificant {
		parts = append(parts, fmt.Sprintf("confidence shifted from %.2f to %.2f (%.0f%% change)",
			analysis.ConfidenceDrift.BaselineValue, analysis.ConfidenceDrift.CurrentValue,
			analysis.ConfidenceDrift.DriftPercentage*100))
	}
	if analysis.LatencyDrift.IsSignificant {
		parts = append(parts, fmt.Sprintf("latency shifted from %.3fs to %.3fs (%.0f%% change)",
			analysis.LatencyDrift.BaselineValue, analysis.LatencyDrift.CurrentValue,
			analysis.LatencyDrift.DriftPercentage*100))
	}
	if analysis.PatternDrift.IsSignificant {
		parts = append(parts, fmt.Sprintf("action pattern divergence %.0f%%",
			analysis.PatternDrift.DriftPercentage*100))
	}
	if len(parts) == 0 {
		return fmt.Sprintf("%s drift detected (score=%.2f)", analysis.DriftType, analysis.DriftScore)
	}
	return "Behavioral drift: " + strings.Join(parts, "; ") + "."
}

func (bm *BaselineManager) generateDriftRecommendations(analysis *DriftAnalysis) []string {
	var recs []string
	switch analysis.Severity {
	case "critical":
		recs = append(recs, "Immediately review agent authorization policies")
		recs = append(recs, "Consider temporarily restricting agent permissions")
	case "high":
		recs = append(recs, "Investigate root cause of behavioral changes")
		recs = append(recs, "Review recent policy or environment changes")
	case "medium":
		recs = append(recs, "Monitor closely over the next 24 hours")
	case "low":
		recs = append(recs, "Consider refreshing baseline if drift persists")
	}
	if analysis.ConfidenceDrift.IsSignificant {
		if analysis.ConfidenceDrift.CurrentValue < analysis.ConfidenceDrift.BaselineValue {
			recs = append(recs, "Agent confidence declining — check for model uncertainty")
		} else {
			recs = append(recs, "Agent confidence unusually high — check for overconfidence")
		}
	}
	if analysis.LatencyDrift.IsSignificant && analysis.LatencyDrift.CurrentValue > analysis.LatencyDrift.BaselineValue {
		recs = append(recs, "Latency increased — investigate infrastructure or model performance")
	}
	if analysis.PatternDrift.IsSignificant {
		recs = append(recs, "Action patterns changed — verify against expected behavior")
	}
	if analysis.DriftType == "combined" {
		recs = append(recs, "Multiple metrics drifting — may indicate a systemic change")
	}
	if len(recs) == 0 {
		recs = append(recs, "Continue monitoring")
	}
	return recs
}

func (bm *BaselineManager) calculateBaselineFromData(agentID string, data []*BehaviorData) *BehavioralBaseline {
	baseline := &BehavioralBaseline{
		AgentID:           agentID,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
		SampleCount:       len(data),
		ActionFrequencies: make(map[string]float64),
		DecisionOutcomes:  make(map[string]float64),
	}
	if len(data) == 0 {
		return baseline
	}
	n := float64(len(data))
	actionCounts := make(map[string]int)
	outcomeCounts := make(map[string]int)
	latencies := make([]float64, len(data))

	// First pass: sums for means.
	for i, d := range data {
		baseline.ConfidenceMean += d.Confidence
		baseline.LatencyMean += d.Latency.Seconds()
		latencies[i] = d.Latency.Seconds()
		actionCounts[d.Action]++
		outcomeCounts[d.Outcome]++
		baseline.HourlyPatterns[d.Timestamp.Hour()]++
	}
	baseline.ConfidenceMean /= n
	baseline.LatencyMean /= n

	// Second pass: variance.
	var confVar, latVar float64
	for _, d := range data {
		confVar += math.Pow(d.Confidence-baseline.ConfidenceMean, 2)
		latVar += math.Pow(d.Latency.Seconds()-baseline.LatencyMean, 2)
	}
	if n > 1 {
		baseline.ConfidenceStdDev = math.Sqrt(confVar / (n - 1))
		baseline.LatencyStdDev = math.Sqrt(latVar / (n - 1))
	}

	// Action frequencies as fractions.
	for action, count := range actionCounts {
		baseline.ActionFrequencies[action] = float64(count) / n
	}
	for outcome, count := range outcomeCounts {
		baseline.DecisionOutcomes[outcome] = float64(count) / n
	}
	for h := range baseline.HourlyPatterns {
		baseline.HourlyPatterns[h] /= n
	}

	// Confidence distribution in 10 buckets of width 0.1.
	buckets := make([]float64, 10)
	for _, d := range data {
		b := int(math.Min(d.Confidence*10, 9))
		buckets[b]++
	}
	for i := range buckets {
		buckets[i] /= n
	}
	baseline.ConfidenceDistribution = buckets

	// Latency percentiles.
	sort.Float64s(latencies)
	baseline.LatencyPercentiles = map[string]float64{
		"p50": baselinePercentile(latencies, 0.50),
		"p90": baselinePercentile(latencies, 0.90),
		"p95": baselinePercentile(latencies, 0.95),
		"p99": baselinePercentile(latencies, 0.99),
	}
	return baseline
}

func baselinePercentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	idx := int(math.Round(p * float64(len(sorted)-1)))
	return sorted[idx]
}

func (bm *BaselineManager) saveBaseline(ctx context.Context, baseline *BehavioralBaseline) error {
	actionFreqJSON, err := json.Marshal(baseline.ActionFrequencies)
	if err != nil {
		return fmt.Errorf("baseline: marshal action_frequencies: %w", err)
	}
	hourlyJSON, err := json.Marshal(baseline.HourlyPatterns)
	if err != nil {
		return fmt.Errorf("baseline: marshal hourly_patterns: %w", err)
	}
	outcomesJSON, err := json.Marshal(baseline.DecisionOutcomes)
	if err != nil {
		return fmt.Errorf("baseline: marshal decision_outcomes: %w", err)
	}
	confDistJSON, err := json.Marshal(baseline.ConfidenceDistribution)
	if err != nil {
		return fmt.Errorf("baseline: marshal confidence_distribution: %w", err)
	}
	latencyPercJSON, err := json.Marshal(baseline.LatencyPercentiles)
	if err != nil {
		return fmt.Errorf("baseline: marshal latency_percentiles: %w", err)
	}

	_, err = bm.db.ExecContext(ctx, `
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
	`,
		baseline.AgentID, baseline.CreatedAt, baseline.UpdatedAt, baseline.SampleCount,
		baseline.ConfidenceMean, baseline.ConfidenceStdDev, baseline.LatencyMean, baseline.LatencyStdDev,
		string(actionFreqJSON), string(hourlyJSON), string(outcomesJSON),
		string(confDistJSON), string(latencyPercJSON),
		baseline.UpdatedAt, baseline.SampleCount, baseline.ConfidenceMean, baseline.ConfidenceStdDev,
		baseline.LatencyMean, baseline.LatencyStdDev, string(actionFreqJSON),
		string(hourlyJSON), string(outcomesJSON), string(confDistJSON), string(latencyPercJSON),
	)
	return err
}

func (bm *BaselineManager) getBaselineFromDB(ctx context.Context, agentID string) (*BehavioralBaseline, error) {
	var b BehavioralBaseline
	var actionFreqJSON, hourlyJSON, outcomesJSON, confDistJSON, latencyPercJSON string

	err := bm.db.QueryRowContext(ctx, `
		SELECT agent_id, created_at, updated_at, sample_count,
		       confidence_mean, confidence_std_dev, latency_mean, latency_std_dev,
		       action_frequencies, hourly_patterns, decision_outcomes,
		       confidence_distribution, latency_percentiles
		FROM behavioral_baselines WHERE agent_id = ?
	`, agentID).Scan(
		&b.AgentID, &b.CreatedAt, &b.UpdatedAt, &b.SampleCount,
		&b.ConfidenceMean, &b.ConfidenceStdDev, &b.LatencyMean, &b.LatencyStdDev,
		&actionFreqJSON, &hourlyJSON, &outcomesJSON, &confDistJSON, &latencyPercJSON,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("baseline: query: %w", err)
	}

	if b.ActionFrequencies == nil {
		b.ActionFrequencies = make(map[string]float64)
	}
	if b.DecisionOutcomes == nil {
		b.DecisionOutcomes = make(map[string]float64)
	}
	_ = json.Unmarshal([]byte(actionFreqJSON), &b.ActionFrequencies)
	_ = json.Unmarshal([]byte(hourlyJSON), &b.HourlyPatterns)
	_ = json.Unmarshal([]byte(outcomesJSON), &b.DecisionOutcomes)
	_ = json.Unmarshal([]byte(confDistJSON), &b.ConfidenceDistribution)
	_ = json.Unmarshal([]byte(latencyPercJSON), &b.LatencyPercentiles)

	return &b, nil
}

func (bm *BaselineManager) startBaselineRefresher() {
	ticker := time.NewTicker(bm.config.BaselineRefreshInterval)
	defer ticker.Stop()
	for {
		select {
		case <-bm.shutdown:
			return
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			bm.refreshAllBaselines(ctx)
			cancel()
		}
	}
}

func (bm *BaselineManager) refreshAllBaselines(ctx context.Context) {
	rows, err := bm.db.QueryContext(ctx, `SELECT DISTINCT agent_id FROM agent_decisions`)
	if err != nil {
		return
	}
	defer rows.Close()
	var agents []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			agents = append(agents, id)
		}
	}
	for _, agentID := range agents {
		// RefreshBaseline returns an error if there are not enough samples; skip silently.
		_ = bm.RefreshBaseline(ctx, agentID)
	}
}

func (bm *BaselineManager) startDriftDetector() {
	ticker := time.NewTicker(bm.config.DriftCheckInterval)
	defer ticker.Stop()
	for {
		select {
		case <-bm.shutdown:
			return
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			bm.detectDriftForAllAgents(ctx)
			cancel()
		}
	}
}

func (bm *BaselineManager) detectDriftForAllAgents(ctx context.Context) {
	rows, err := bm.db.QueryContext(ctx,
		`SELECT agent_id FROM behavioral_baselines WHERE sample_count >= ?`,
		bm.config.MinSamplesForBaseline)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var agentID string
		if rows.Scan(&agentID) != nil {
			continue
		}
		analysis, err := bm.DetectDrift(ctx, agentID)
		if err != nil || analysis == nil {
			continue
		}
		if analysis.DriftScore >= bm.config.DriftThreshold {
			// Significant drift detected; callers (AlertManager) will act on this
			// when they poll DetectDrift from CheckDriftAlert.
			_ = analysis
		}
	}
}
