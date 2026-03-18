package observability

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"sort"
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
	anomalyGauge     prometheus.GaugeVec
	anomalyCounter   prometheus.CounterVec
	baselineGauge    prometheus.GaugeVec
}

// AnomalyConfig configures anomaly detection parameters
type AnomalyConfig struct {
	// Isolation Forest parameters
	ContaminationRate    float64       // Expected proportion of anomalies (0.01 = 1%)
	NumTrees            int           // Number of isolation trees
	SubsampleSize       int           // Subsample size for each tree
	
	// Baseline parameters
	BaselineWindow      time.Duration // Time window for baseline calculation
	MinSamplesBaseline  int           // Minimum samples needed for baseline
	BaselineUpdateFreq  time.Duration // How often to update baselines
	
	// Anomaly thresholds
	AnomalyThreshold    float64       // Threshold for anomaly score (0-1)
	SevereThreshold     float64       // Threshold for severe anomalies
	
	// Feature weights
	ConfidenceWeight    float64       // Weight for confidence-based features
	LatencyWeight       float64       // Weight for latency-based features
	PatternWeight       float64       // Weight for pattern-based features
}

// BehavioralBaseline represents normal behavior patterns for an agent
type BehavioralBaseline struct {
	AgentID              string                 `json:"agent_id"`
	CreatedAt            time.Time              `json:"created_at"`
	UpdatedAt            time.Time              `json:"updated_at"`
	SampleCount          int                    `json:"sample_count"`
	
	// Statistical baselines
	ConfidenceMean       float64                `json:"confidence_mean"`
	ConfidenceStdDev     float64                `json:"confidence_std_dev"`
	LatencyMean          float64                `json:"latency_mean"`
	LatencyStdDev        float64                `json:"latency_std_dev"`
	
	// Pattern baselines
	ActionFrequencies    map[string]float64     `json:"action_frequencies"`
	HourlyPatterns       [24]float64            `json:"hourly_patterns"`
	DecisionOutcomes     map[string]float64     `json:"decision_outcomes"`
	
	// Advanced features
	ConfidenceDistribution []float64            `json:"confidence_distribution"`
	LatencyPercentiles     map[string]float64   `json:"latency_percentiles"`
}

// AnomalyResult represents the result of anomaly detection
type AnomalyResult struct {
	AgentID        string                 `json:"agent_id"`
	Timestamp      time.Time              `json:"timestamp"`
	AnomalyScore   float64                `json:"anomaly_score"`   // 0-1, higher = more anomalous
	IsAnomaly      bool                   `json:"is_anomaly"`
	Severity       string                 `json:"severity"`        // "low", "medium", "high", "severe"
	Features       map[string]float64     `json:"features"`        // Feature values that contributed
	Explanation    string                 `json:"explanation"`     // Human-readable explanation
	
	// Context
	Action         string                 `json:"action"`
	Confidence     float64                `json:"confidence"`
	Latency        time.Duration          `json:"latency"`
	Outcome        string                 `json:"outcome"`
}

// FeatureVector represents behavioral features for anomaly detection
type FeatureVector struct {
	// Confidence features
	Confidence           float64   `json:"confidence"`
	ConfidenceDeviation  float64   `json:"confidence_deviation"`
	
	// Latency features  
	Latency              float64   `json:"latency"`
	LatencyDeviation     float64   `json:"latency_deviation"`
	
	// Pattern features
	ActionRarity         float64   `json:"action_rarity"`
	TimeOfDayRarity      float64   `json:"time_of_day_rarity"`
	OutcomeRarity        float64   `json:"outcome_rarity"`
	
	// Sequence features
	RecentErrorRate      float64   `json:"recent_error_rate"`
	ConfidenceTrend      float64   `json:"confidence_trend"`
	LatencyTrend         float64   `json:"latency_trend"`
}

// DefaultAnomalyConfig returns sensible defaults for anomaly detection
func DefaultAnomalyConfig() AnomalyConfig {
	return AnomalyConfig{
		ContaminationRate:   0.05,  // Expect 5% anomalies
		NumTrees:           100,    // 100 isolation trees
		SubsampleSize:      256,    // 256 samples per tree
		
		BaselineWindow:     7 * 24 * time.Hour, // 1 week baseline
		MinSamplesBaseline: 100,                 // Need 100 samples minimum
		BaselineUpdateFreq: 1 * time.Hour,      // Update hourly
		
		AnomalyThreshold:   0.6,    // 60% threshold for anomaly
		SevereThreshold:    0.8,    // 80% threshold for severe
		
		ConfidenceWeight:   0.3,    // 30% weight on confidence
		LatencyWeight:      0.3,    // 30% weight on latency  
		PatternWeight:      0.4,    // 40% weight on patterns
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

// calculateAnomalyScore computes anomaly score using simplified Isolation Forest
func (ad *AnomalyDetector) calculateAnomalyScore(features *FeatureVector, baseline *BehavioralBaseline) float64 {
	// Simplified anomaly scoring based on feature deviations
	// In a full implementation, this would use actual Isolation Forest algorithm
	
	scores := []float64{}
	
	// Confidence anomaly
	if features.ConfidenceDeviation > 0 {
		confScore := math.Min(features.ConfidenceDeviation/3.0, 1.0) // 3 std devs = max score
		scores = append(scores, confScore*ad.config.ConfidenceWeight)
	}
	
	// Latency anomaly
	if features.LatencyDeviation > 0 {
		latencyScore := math.Min(features.LatencyDeviation/3.0, 1.0)
		scores = append(scores, latencyScore*ad.config.LatencyWeight)
	}
	
	// Pattern anomalies
	patternScore := (math.Min(features.ActionRarity/10.0, 1.0) +
		math.Min(features.TimeOfDayRarity/5.0, 1.0) +
		math.Min(features.OutcomeRarity/5.0, 1.0)) / 3.0
	scores = append(scores, patternScore*ad.config.PatternWeight)
	
	// Combine scores (weighted average)
	totalScore := 0.0
	totalWeight := 0.0
	
	for _, score := range scores {
		totalScore += score
		totalWeight += 1.0
	}
	
	if totalWeight > 0 {
		return totalScore / totalWeight
	}
	
	return 0.0
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
		// Parse JSON fields
		json.Unmarshal([]byte(actionFreqJSON), &baseline.ActionFrequencies)
		json.Unmarshal([]byte(hourlyPatternsJSON), &baseline.HourlyPatterns)
		json.Unmarshal([]byte(outcomesJSON), &baseline.DecisionOutcomes)
		json.Unmarshal([]byte(confDistJSON), &baseline.ConfidenceDistribution)
		json.Unmarshal([]byte(latencyPercJSON), &baseline.LatencyPercentiles)
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
	// Convert maps to JSON
	actionFreqJSON, _ := json.Marshal(baseline.ActionFrequencies)
	hourlyPatternsJSON, _ := json.Marshal(baseline.HourlyPatterns)
	outcomesJSON, _ := json.Marshal(baseline.DecisionOutcomes)
	confDistJSON, _ := json.Marshal(baseline.ConfidenceDistribution)
	latencyPercJSON, _ := json.Marshal(baseline.LatencyPercentiles)
	
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
	
	_, err := ad.db.ExecContext(ctx, query,
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
	featuresJSON, _ := json.Marshal(result.Features)
	
	query := `
		INSERT INTO anomaly_results (
			agent_id, timestamp, anomaly_score, is_anomaly, severity,
			features, explanation, action, confidence, latency_ms, outcome
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	
	_, err := ad.db.ExecContext(ctx, query,
		result.AgentID, result.Timestamp, result.AnomalyScore, result.IsAnomaly, result.Severity,
		string(featuresJSON), result.Explanation, result.Action, result.Confidence,
		result.Latency.Milliseconds(), result.Outcome,
	)
	
	return err
}

// featuresToMap converts FeatureVector to map for JSON serialization
func (ad *AnomalyDetector) featuresToMap(features *FeatureVector) map[string]float64 {
	return map[string]float64{
		"confidence":            features.Confidence,
		"confidence_deviation":  features.ConfidenceDeviation,
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
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		
		// Clear cache to force reload of updated baselines
		ad.mutex.Lock()
		ad.baselines = make(map[string]*BehavioralBaseline)
		ad.mutex.Unlock()
		
		cancel()
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
		json.Unmarshal([]byte(featuresJSON), &result.Features)
		
		results = append(results, &result)
	}
	
	return results, nil
}