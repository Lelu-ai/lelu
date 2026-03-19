package observability

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// BaselineManager handles behavioral baseline establishment and management
type BaselineManager struct {
	db     *sql.DB
	config BaselineConfig

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
		db:     db,
		config: config,

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
func (bm *BaselineManager) UpdateBaseline(_ context.Context, _, action, outcome string, confidence float64, latency time.Duration) error {
	// For now, we'll just trigger a refresh if enough time has passed
	// In a production system, this could incrementally update the baseline
	// or queue the data for batch processing

	// This is a simplified implementation - in practice you'd want to:
	// 1. Store the individual data point
	// 2. Check if baseline needs updating based on time/sample count
	// 3. Potentially trigger async baseline recalculation

	return nil // No-op for now, baseline updates happen via RefreshBaseline
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

// Additional helper methods would be implemented here for:
// - analyzeConfidenceDrift
// - analyzeLatencyDrift
// - analyzePatternDrift
// - calculateOverallDriftScore
// - determineDriftType
// - determineDriftSeverity
// - generateDriftExplanation
// - generateDriftRecommendations
// - calculateBaselineFromData
// - saveBaseline
// - getBaselineFromDB
// - startBaselineRefresher
// - startDriftDetector

// Placeholder implementations for brevity
func (bm *BaselineManager) analyzeConfidenceDrift(_ *BehavioralBaseline, _ []*BehaviorData) DriftMetric {
	// Implementation would analyze confidence drift
	return DriftMetric{MetricName: "confidence"}
}

func (bm *BaselineManager) analyzeLatencyDrift(_ *BehavioralBaseline, _ []*BehaviorData) DriftMetric {
	// Implementation would analyze latency drift
	return DriftMetric{MetricName: "latency"}
}

func (bm *BaselineManager) analyzePatternDrift(_ *BehavioralBaseline, recentData []*BehaviorData) DriftMetric {
	// Implementation would analyze pattern drift
	return DriftMetric{MetricName: "pattern"}
}

func (bm *BaselineManager) calculateOverallDriftScore(_ *DriftAnalysis) float64 {
	// Implementation would calculate overall drift score
	return 0.0
}

func (bm *BaselineManager) determineDriftType(_ *DriftAnalysis) string {
	// Implementation would determine primary drift type
	return "none"
}

func (bm *BaselineManager) determineDriftSeverity(_ float64) string {
	// Implementation would determine drift severity
	return "none"
}

func (bm *BaselineManager) generateDriftExplanation(_ *DriftAnalysis) string {
	// Implementation would generate human-readable explanation
	return "No significant drift detected"
}

func (bm *BaselineManager) generateDriftRecommendations(_ *DriftAnalysis) []string {
	// Implementation would generate actionable recommendations
	return []string{"Continue monitoring"}
}

func (bm *BaselineManager) calculateBaselineFromData(agentID string, _ []*BehaviorData) *BehavioralBaseline {
	// Implementation would calculate new baseline from data
	return &BehavioralBaseline{AgentID: agentID}
}

func (bm *BaselineManager) saveBaseline(_ context.Context, _ *BehavioralBaseline) error {
	// Implementation would save baseline to database
	return nil
}

func (bm *BaselineManager) getBaselineFromDB(_ context.Context, agentID string) (*BehavioralBaseline, error) {
	// Implementation would retrieve baseline from database
	return nil, nil
}

func (bm *BaselineManager) startBaselineRefresher() {
	// Implementation would run background baseline refresh
}

func (bm *BaselineManager) startDriftDetector() {
	// Implementation would run background drift detection
}
