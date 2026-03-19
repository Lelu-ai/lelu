package observability

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// PredictiveAnalytics provides AI-powered insights and predictions
// This implements Phase 3 of the Advanced Observability roadmap
type PredictiveAnalytics struct {
	db     *sql.DB
	config PredictiveConfig
	mutex  sync.RWMutex

	// Prediction models
	confidencePredictor  *ConfidencePredictionModel
	humanReviewPredictor *HumanReviewPredictionModel
	policyOptimizer      *PolicyOptimizationModel

	// Prometheus metrics
	predictionAccuracy prometheus.GaugeVec
	predictionLatency  prometheus.HistogramVec
	predictionCount    prometheus.CounterVec
}

// PredictiveConfig configures predictive analytics
type PredictiveConfig struct {
	// Model parameters
	ConfidenceModelWindow time.Duration // Historical window for confidence prediction
	ReviewModelWindow     time.Duration // Historical window for review prediction
	MinSamplesForModel    int           // Minimum samples needed for predictions

	// Prediction thresholds
	ConfidencePredictionThreshold float64 // Threshold for confidence predictions
	ReviewPredictionThreshold     float64 // Threshold for review predictions
	PolicyOptimizationThreshold   float64 // Threshold for policy optimization

	// Update frequency
	ModelUpdateInterval time.Duration // How often to retrain models
	PredictionCacheTime time.Duration // How long to cache predictions

	// Feature engineering
	EnableTemporalFeatures   bool // Include time-based features
	EnableContextFeatures    bool // Include context-based features
	EnableHistoricalFeatures bool // Include historical features
}

// ConfidencePredictionModel predicts confidence scores for new requests
type ConfidencePredictionModel struct {
	// Model parameters (simplified linear regression for now)
	Weights    map[string]float64 `json:"weights"`
	Bias       float64            `json:"bias"`
	TrainedAt  time.Time          `json:"trained_at"`
	Accuracy   float64            `json:"accuracy"`
	SampleSize int                `json:"sample_size"`
}

// HumanReviewPredictionModel predicts which actions need human review
type HumanReviewPredictionModel struct {
	// Model parameters
	Weights    map[string]float64 `json:"weights"`
	Bias       float64            `json:"bias"`
	TrainedAt  time.Time          `json:"trained_at"`
	Precision  float64            `json:"precision"`
	Recall     float64            `json:"recall"`
	SampleSize int                `json:"sample_size"`
}

// PolicyOptimizationModel suggests policy improvements
type PolicyOptimizationModel struct {
	// Policy effectiveness tracking
	PolicyScores    map[string]float64 `json:"policy_scores"`
	LastOptimized   time.Time          `json:"last_optimized"`
	Recommendations []string           `json:"recommendations"`
}

// ConfidencePrediction represents a predicted confidence score
type ConfidencePrediction struct {
	AgentID             string             `json:"agent_id"`
	Action              string             `json:"action"`
	PredictedConfidence float64            `json:"predicted_confidence"`
	ActualConfidence    *float64           `json:"actual_confidence,omitempty"`
	PredictionError     *float64           `json:"prediction_error,omitempty"`
	Features            map[string]float64 `json:"features"`
	Timestamp           time.Time          `json:"timestamp"`
}

// HumanReviewPrediction represents a prediction of human review need
type HumanReviewPrediction struct {
	AgentID           string             `json:"agent_id"`
	Action            string             `json:"action"`
	NeedsReview       bool               `json:"needs_review"`
	ReviewProbability float64            `json:"review_probability"`
	Confidence        float64            `json:"confidence"`
	RiskFactors       []string           `json:"risk_factors"`
	Features          map[string]float64 `json:"features"`
	Timestamp         time.Time          `json:"timestamp"`
}

// PolicyOptimizationSuggestion represents a policy improvement suggestion
type PolicyOptimizationSuggestion struct {
	PolicyName     string    `json:"policy_name"`
	CurrentScore   float64   `json:"current_score"`
	Suggestion     string    `json:"suggestion"`
	ExpectedImpact float64   `json:"expected_impact"`
	Priority       string    `json:"priority"` // "low", "medium", "high", "critical"
	Rationale      string    `json:"rationale"`
	Timestamp      time.Time `json:"timestamp"`
}

// DefaultPredictiveConfig returns sensible defaults
func DefaultPredictiveConfig() PredictiveConfig {
	return PredictiveConfig{
		ConfidenceModelWindow: 30 * 24 * time.Hour, // 30 days
		ReviewModelWindow:     14 * 24 * time.Hour, // 14 days
		MinSamplesForModel:    100,                 // Need 100 samples minimum

		ConfidencePredictionThreshold: 0.7, // 70% confidence threshold
		ReviewPredictionThreshold:     0.6, // 60% review probability threshold
		PolicyOptimizationThreshold:   0.5, // 50% effectiveness threshold

		ModelUpdateInterval: 6 * time.Hour,  // Retrain every 6 hours
		PredictionCacheTime: 15 * time.Minute, // Cache for 15 minutes

		EnableTemporalFeatures:  true,
		EnableContextFeatures:   true,
		EnableHistoricalFeatures: true,
	}
}

// NewPredictiveAnalytics creates a new predictive analytics engine
func NewPredictiveAnalytics(db *sql.DB, config PredictiveConfig) *PredictiveAnalytics {
	pa := &PredictiveAnalytics{
		db:     db,
		config: config,

		confidencePredictor:  &ConfidencePredictionModel{Weights: make(map[string]float64)},
		humanReviewPredictor: &HumanReviewPredictionModel{Weights: make(map[string]float64)},
		policyOptimizer:      &PolicyOptimizationModel{PolicyScores: make(map[string]float64)},

		predictionAccuracy: *promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "ai_agent_prediction_accuracy",
				Help: "Accuracy of predictive models (0-1)",
			},
			[]string{"model_type", "agent_id"},
		),

		predictionLatency: *promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "ai_agent_prediction_latency_seconds",
				Help:    "Latency of prediction operations",
				Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1},
			},
			[]string{"model_type"},
		),

		predictionCount: *promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "ai_agent_predictions_total",
				Help: "Total predictions made by model type",
			},
			[]string{"model_type", "outcome"},
		),
	}

	// Start background model training
	go pa.startModelTrainer()

	return pa
}

// PredictConfidence predicts confidence score for a new request
func (pa *PredictiveAnalytics) PredictConfidence(ctx context.Context, agentID, action string) (*ConfidencePrediction, error) {
	startTime := time.Now()

	// Extract features
	features, err := pa.extractConfidenceFeatures(ctx, agentID, action)
	if err != nil {
		return nil, fmt.Errorf("failed to extract features: %w", err)
	}

	// Make prediction using model
	predictedConfidence := pa.predictConfidenceScore(features)

	prediction := &ConfidencePrediction{
		AgentID:             agentID,
		Action:              action,
		PredictedConfidence: predictedConfidence,
		Features:            features,
		Timestamp:           time.Now(),
	}

	// Record metrics
	pa.predictionLatency.WithLabelValues("confidence").Observe(time.Since(startTime).Seconds())
	pa.predictionCount.WithLabelValues("confidence", "success").Inc()

	return prediction, nil
}

// PredictHumanReview predicts if an action will need human review
func (pa *PredictiveAnalytics) PredictHumanReview(ctx context.Context, agentID, action string, confidence float64) (*HumanReviewPrediction, error) {
	startTime := time.Now()

	// Extract features
	features, err := pa.extractReviewFeatures(ctx, agentID, action, confidence)
	if err != nil {
		return nil, fmt.Errorf("failed to extract features: %w", err)
	}

	// Make prediction
	reviewProbability := pa.predictReviewProbability(features)
	needsReview := reviewProbability >= pa.config.ReviewPredictionThreshold

	// Identify risk factors
	riskFactors := pa.identifyRiskFactors(features, reviewProbability)

	prediction := &HumanReviewPrediction{
		AgentID:           agentID,
		Action:            action,
		NeedsReview:       needsReview,
		ReviewProbability: reviewProbability,
		Confidence:        confidence,
		RiskFactors:       riskFactors,
		Features:          features,
		Timestamp:         time.Now(),
	}

	// Record metrics
	pa.predictionLatency.WithLabelValues("human_review").Observe(time.Since(startTime).Seconds())
	pa.predictionCount.WithLabelValues("human_review", "success").Inc()

	return prediction, nil
}

// SuggestPolicyOptimizations suggests improvements to policies
func (pa *PredictiveAnalytics) SuggestPolicyOptimizations(ctx context.Context) ([]*PolicyOptimizationSuggestion, error) {
	startTime := time.Now()

	// Analyze policy effectiveness
	policyStats, err := pa.analyzePolicyEffectiveness(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to analyze policies: %w", err)
	}

	suggestions := []*PolicyOptimizationSuggestion{}

	// Generate suggestions for underperforming policies
	for policyName, stats := range policyStats {
		if stats.Effectiveness < pa.config.PolicyOptimizationThreshold {
			suggestion := pa.generatePolicySuggestion(policyName, stats)
			suggestions = append(suggestions, suggestion)
		}
	}

	// Record metrics
	pa.predictionLatency.WithLabelValues("policy_optimization").Observe(time.Since(startTime).Seconds())
	pa.predictionCount.WithLabelValues("policy_optimization", "success").Inc()

	return suggestions, nil
}

// TrainConfidenceModel trains the confidence prediction model
func (pa *PredictiveAnalytics) TrainConfidenceModel(ctx context.Context) error {
	// Get training data
	trainingData, err := pa.getConfidenceTrainingData(ctx)
	if err != nil {
		return fmt.Errorf("failed to get training data: %w", err)
	}

	if len(trainingData) < pa.config.MinSamplesForModel {
		return fmt.Errorf("insufficient training data: %d samples (need %d)",
			len(trainingData), pa.config.MinSamplesForModel)
	}

	// Train model (simplified linear regression)
	model := pa.trainLinearModel(trainingData)

	// Evaluate model accuracy
	accuracy := pa.evaluateConfidenceModel(model, trainingData)

	// Update model
	pa.mutex.Lock()
	pa.confidencePredictor = &ConfidencePredictionModel{
		Weights:    model.Weights,
		Bias:       model.Bias,
		TrainedAt:  time.Now(),
		Accuracy:   accuracy,
		SampleSize: len(trainingData),
	}
	pa.mutex.Unlock()

	// Update metrics
	pa.predictionAccuracy.WithLabelValues("confidence", "all").Set(accuracy)

	return nil
}

// TrainHumanReviewModel trains the human review prediction model
func (pa *PredictiveAnalytics) TrainHumanReviewModel(ctx context.Context) error {
	// Get training data
	trainingData, err := pa.getReviewTrainingData(ctx)
	if err != nil {
		return fmt.Errorf("failed to get training data: %w", err)
	}

	if len(trainingData) < pa.config.MinSamplesForModel {
		return fmt.Errorf("insufficient training data: %d samples (need %d)",
			len(trainingData), pa.config.MinSamplesForModel)
	}

	// Train model (logistic regression)
	model := pa.trainLogisticModel(trainingData)

	// Evaluate model
	precision, recall := pa.evaluateReviewModel(model, trainingData)

	// Update model
	pa.mutex.Lock()
	pa.humanReviewPredictor = &HumanReviewPredictionModel{
		Weights:    model.Weights,
		Bias:       model.Bias,
		TrainedAt:  time.Now(),
		Precision:  precision,
		Recall:     recall,
		SampleSize: len(trainingData),
	}
	pa.mutex.Unlock()

	// Update metrics
	pa.predictionAccuracy.WithLabelValues("human_review", "all").Set((precision + recall) / 2)

	return nil
}

// extractConfidenceFeatures extracts features for confidence prediction
func (pa *PredictiveAnalytics) extractConfidenceFeatures(ctx context.Context, agentID, action string) (map[string]float64, error) {
	features := make(map[string]float64)

	// Historical features
	if pa.config.EnableHistoricalFeatures {
		// Get agent's historical confidence
		avgConfidence, err := pa.getAverageConfidence(ctx, agentID)
		if err == nil {
			features["historical_confidence"] = avgConfidence
		}

		// Get action frequency
		actionFreq, err := pa.getActionFrequency(ctx, agentID, action)
		if err == nil {
			features["action_frequency"] = actionFreq
		}
	}

	// Temporal features
	if pa.config.EnableTemporalFeatures {
		now := time.Now()
		features["hour_of_day"] = float64(now.Hour()) / 24.0
		features["day_of_week"] = float64(now.Weekday()) / 7.0
	}

	// Context features
	if pa.config.EnableContextFeatures {
		// Get recent error rate
		errorRate, err := pa.getRecentErrorRate(ctx, agentID)
		if err == nil {
			features["recent_error_rate"] = errorRate
		}
	}

	return features, nil
}

// extractReviewFeatures extracts features for human review prediction
func (pa *PredictiveAnalytics) extractReviewFeatures(ctx context.Context, agentID, action string, confidence float64) (map[string]float64, error) {
	features := make(map[string]float64)

	// Confidence-based features
	features["confidence"] = confidence
	features["confidence_squared"] = confidence * confidence
	features["low_confidence"] = 0.0
	if confidence < 0.5 {
		features["low_confidence"] = 1.0
	}

	// Historical features
	if pa.config.EnableHistoricalFeatures {
		// Get historical review rate
		reviewRate, err := pa.getHistoricalReviewRate(ctx, agentID)
		if err == nil {
			features["historical_review_rate"] = reviewRate
		}

		// Get action risk score
		riskScore, err := pa.getActionRiskScore(ctx, action)
		if err == nil {
			features["action_risk_score"] = riskScore
		}
	}

	// Temporal features
	if pa.config.EnableTemporalFeatures {
		now := time.Now()
		features["hour_of_day"] = float64(now.Hour()) / 24.0
		features["is_weekend"] = 0.0
		if now.Weekday() == time.Saturday || now.Weekday() == time.Sunday {
			features["is_weekend"] = 1.0
		}
	}

	return features, nil
}

// predictConfidenceScore makes a confidence prediction using the model
func (pa *PredictiveAnalytics) predictConfidenceScore(features map[string]float64) float64 {
	pa.mutex.RLock()
	defer pa.mutex.RUnlock()

	if pa.confidencePredictor == nil || len(pa.confidencePredictor.Weights) == 0 {
		return 0.5 // Default neutral prediction
	}

	// Linear prediction: y = w1*x1 + w2*x2 + ... + bias
	prediction := pa.confidencePredictor.Bias

	for feature, value := range features {
		if weight, exists := pa.confidencePredictor.Weights[feature]; exists {
			prediction += weight * value
		}
	}

	// Clamp to [0, 1]
	if prediction < 0 {
		prediction = 0
	}
	if prediction > 1 {
		prediction = 1
	}

	return prediction
}

// predictReviewProbability predicts probability of needing human review
func (pa *PredictiveAnalytics) predictReviewProbability(features map[string]float64) float64 {
	pa.mutex.RLock()
	defer pa.mutex.RUnlock()

	if pa.humanReviewPredictor == nil || len(pa.humanReviewPredictor.Weights) == 0 {
		return 0.5 // Default neutral prediction
	}

	// Logistic regression: p = 1 / (1 + exp(-(w*x + b)))
	z := pa.humanReviewPredictor.Bias

	for feature, value := range features {
		if weight, exists := pa.humanReviewPredictor.Weights[feature]; exists {
			z += weight * value
		}
	}

	// Sigmoid function
	probability := 1.0 / (1.0 + math.Exp(-z))

	return probability
}

// identifyRiskFactors identifies factors contributing to review need
func (pa *PredictiveAnalytics) identifyRiskFactors(features map[string]float64, probability float64) []string {
	riskFactors := []string{}

	if features["confidence"] < 0.5 {
		riskFactors = append(riskFactors, "Low confidence score")
	}

	if features["action_risk_score"] > 0.7 {
		riskFactors = append(riskFactors, "High-risk action type")
	}

	if features["recent_error_rate"] > 0.2 {
		riskFactors = append(riskFactors, "Recent error rate elevated")
	}

	if features["historical_review_rate"] > 0.5 {
		riskFactors = append(riskFactors, "Agent frequently requires review")
	}

	if probability > 0.8 {
		riskFactors = append(riskFactors, "High review probability")
	}

	return riskFactors
}

// PolicyStats represents policy effectiveness statistics
type PolicyStats struct {
	PolicyName   string
	Effectiveness float64
	TotalDecisions int
	SuccessRate   float64
	AvgLatency    float64
}

// analyzePolicyEffectiveness analyzes how well policies are performing
func (pa *PredictiveAnalytics) analyzePolicyEffectiveness(ctx context.Context) (map[string]*PolicyStats, error) {
	query := `
		SELECT policy_name, 
			   COUNT(*) as total,
			   SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successes,
			   AVG(latency_ms) as avg_latency
		FROM policy_evaluations
		WHERE timestamp >= ?
		GROUP BY policy_name
	`

	since := time.Now().Add(-pa.config.ReviewModelWindow)
	rows, err := pa.db.QueryContext(ctx, query, since)
	if err != nil {
		return nil, fmt.Errorf("failed to query policy stats: %w", err)
	}
	defer rows.Close()

	stats := make(map[string]*PolicyStats)

	for rows.Next() {
		var policyName string
		var total, successes int
		var avgLatency float64

		err := rows.Scan(&policyName, &total, &successes, &avgLatency)
		if err != nil {
			continue
		}

		successRate := float64(successes) / float64(total)
		effectiveness := successRate // Simplified effectiveness calculation

		stats[policyName] = &PolicyStats{
			PolicyName:    policyName,
			Effectiveness: effectiveness,
			TotalDecisions: total,
			SuccessRate:   successRate,
			AvgLatency:    avgLatency,
		}
	}

	return stats, nil
}

// generatePolicySuggestion generates an optimization suggestion for a policy
func (pa *PredictiveAnalytics) generatePolicySuggestion(policyName string, stats *PolicyStats) *PolicyOptimizationSuggestion {
	suggestion := &PolicyOptimizationSuggestion{
		PolicyName:   policyName,
		CurrentScore: stats.Effectiveness,
		Timestamp:    time.Now(),
	}

	// Generate suggestion based on stats
	if stats.SuccessRate < 0.5 {
		suggestion.Suggestion = "Policy is rejecting too many valid requests"
		suggestion.Rationale = fmt.Sprintf("Success rate is only %.1f%%, consider relaxing constraints", stats.SuccessRate*100)
		suggestion.Priority = "high"
		suggestion.ExpectedImpact = 0.3
	} else if stats.AvgLatency > 100 {
		suggestion.Suggestion = "Policy evaluation is slow"
		suggestion.Rationale = fmt.Sprintf("Average latency is %.1fms, consider optimizing rules", stats.AvgLatency)
		suggestion.Priority = "medium"
		suggestion.ExpectedImpact = 0.2
	} else {
		suggestion.Suggestion = "Policy effectiveness is below threshold"
		suggestion.Rationale = "Consider reviewing policy rules and thresholds"
		suggestion.Priority = "low"
		suggestion.ExpectedImpact = 0.1
	}

	return suggestion
}

// Helper methods for data retrieval (simplified implementations)

func (pa *PredictiveAnalytics) getAverageConfidence(_ context.Context, _ string) (float64, error) {
	return 0.75, nil // Placeholder
}

func (pa *PredictiveAnalytics) getActionFrequency(_ context.Context, _, _ string) (float64, error) {
	return 0.5, nil // Placeholder
}

func (pa *PredictiveAnalytics) getRecentErrorRate(_ context.Context, _ string) (float64, error) {
	return 0.1, nil // Placeholder
}

func (pa *PredictiveAnalytics) getHistoricalReviewRate(_ context.Context, _ string) (float64, error) {
	return 0.3, nil // Placeholder
}

func (pa *PredictiveAnalytics) getActionRiskScore(_ context.Context, _ string) (float64, error) {
	return 0.4, nil // Placeholder
}

// Training data structures
type TrainingDataPoint struct {
	Features map[string]float64
	Label    float64
}

func (pa *PredictiveAnalytics) getConfidenceTrainingData(_ context.Context) ([]*TrainingDataPoint, error) {
	return []*TrainingDataPoint{}, nil // Placeholder
}

func (pa *PredictiveAnalytics) getReviewTrainingData(_ context.Context) ([]*TrainingDataPoint, error) {
	return []*TrainingDataPoint{}, nil // Placeholder
}

func (pa *PredictiveAnalytics) trainLinearModel(_ []*TrainingDataPoint) *ConfidencePredictionModel {
	return &ConfidencePredictionModel{Weights: make(map[string]float64)} // Placeholder
}

func (pa *PredictiveAnalytics) trainLogisticModel(_ []*TrainingDataPoint) *HumanReviewPredictionModel {
	return &HumanReviewPredictionModel{Weights: make(map[string]float64)} // Placeholder
}

func (pa *PredictiveAnalytics) evaluateConfidenceModel(_ *ConfidencePredictionModel, _ []*TrainingDataPoint) float64 {
	return 0.85 // Placeholder
}

func (pa *PredictiveAnalytics) evaluateReviewModel(_ *HumanReviewPredictionModel, _ []*TrainingDataPoint) (float64, float64) {
	return 0.80, 0.75 // Placeholder: precision, recall
}

func (pa *PredictiveAnalytics) startModelTrainer() {
	ticker := time.NewTicker(pa.config.ModelUpdateInterval)
	defer ticker.Stop()

	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)

		// Train confidence model
		_ = pa.TrainConfidenceModel(ctx)

		// Train human review model
		_ = pa.TrainHumanReviewModel(ctx)

		cancel()
	}
}
