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

// ReputationManager handles agent reputation scoring and tracking
type ReputationManager struct {
	db     *sql.DB
	mutex  sync.RWMutex
	cache  map[string]*AgentReputation
	config ReputationConfig
	
	// Prometheus metrics
	reputationGauge    prometheus.GaugeVec
	accuracyGauge      prometheus.GaugeVec
	calibrationGauge   prometheus.GaugeVec
	decisionCounter    prometheus.CounterVec
}

// AgentReputation represents an agent's reputation metrics
type AgentReputation struct {
	AgentID           string    `json:"agent_id"`
	ReputationScore   float64   `json:"reputation_score"`   // 0-1 trust score
	DecisionCount     int64     `json:"decision_count"`     // Total decisions made
	AccuracyRate      float64   `json:"accuracy_rate"`      // % correct decisions
	CalibrationScore  float64   `json:"calibration_score"`  // Confidence vs accuracy alignment
	LastUpdated       time.Time `json:"last_updated"`
	
	// Detailed metrics
	ConfidenceSum     float64   `json:"confidence_sum"`     // Sum of all confidence scores
	CorrectDecisions  int64     `json:"correct_decisions"`  // Number of correct decisions
	HighConfErrors    int64     `json:"high_conf_errors"`   // High confidence but wrong
	LowConfCorrect    int64     `json:"low_conf_correct"`   // Low confidence but correct
}

// ReputationConfig configures reputation calculation parameters
type ReputationConfig struct {
	DecayFactor          float64       // How much to weight recent vs historical performance
	MinDecisionsForScore int64         // Minimum decisions needed for reliable score
	CalibrationWeight    float64       // Weight of calibration in overall reputation
	AccuracyWeight       float64       // Weight of accuracy in overall reputation
	UpdateInterval       time.Duration // How often to recalculate reputation
	HighConfidenceThresh float64       // Threshold for "high confidence" decisions
	LowConfidenceThresh  float64       // Threshold for "low confidence" decisions
}

// DefaultReputationConfig returns sensible defaults for reputation calculation
func DefaultReputationConfig() ReputationConfig {
	return ReputationConfig{
		DecayFactor:          0.95, // 5% decay for older decisions
		MinDecisionsForScore: 10,   // Need at least 10 decisions
		CalibrationWeight:    0.3,  // 30% weight on calibration
		AccuracyWeight:       0.7,  // 70% weight on accuracy
		UpdateInterval:       5 * time.Minute,
		HighConfidenceThresh: 0.8,  // >80% confidence
		LowConfidenceThresh:  0.4,  // <40% confidence
	}
}

// NewReputationManager creates a new reputation manager
func NewReputationManager(db *sql.DB, config ReputationConfig) *ReputationManager {
	rm := &ReputationManager{
		db:     db,
		cache:  make(map[string]*AgentReputation),
		config: config,
		
		reputationGauge: *promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "ai_agent_reputation_score",
				Help: "Current reputation score for AI agents (0-1)",
			},
			[]string{"agent_id", "agent_type"},
		),
		
		accuracyGauge: *promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "ai_agent_accuracy_rate",
				Help: "Decision accuracy rate for AI agents (0-1)",
			},
			[]string{"agent_id", "agent_type"},
		),
		
		calibrationGauge: *promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "ai_agent_calibration_score",
				Help: "Confidence calibration score for AI agents (0-1)",
			},
			[]string{"agent_id", "agent_type"},
		),
		
		decisionCounter: *promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "ai_agent_decisions_total",
				Help: "Total decisions made by AI agents",
			},
			[]string{"agent_id", "agent_type", "outcome", "confidence_bucket"},
		),
	}
	
	// Start background reputation updates
	go rm.startReputationUpdater()
	
	return rm
}

// RecordDecision records a decision outcome for reputation calculation
func (rm *ReputationManager) RecordDecision(ctx context.Context, agentID, agentType string, 
	confidence float64, wasCorrect bool, outcome string) error {
	
	// Record metrics
	confidenceBucket := rm.getConfidenceBucket(confidence)
	outcomeLabel := "correct"
	if !wasCorrect {
		outcomeLabel = "incorrect"
	}
	
	rm.decisionCounter.WithLabelValues(agentID, agentType, outcomeLabel, confidenceBucket).Inc()
	
	// Update reputation in database
	query := `
		INSERT INTO agent_reputation (
			agent_id, reputation_score, decision_count, accuracy_rate, 
			calibration_score, last_updated, confidence_sum, correct_decisions,
			high_conf_errors, low_conf_correct
		) VALUES (?, 0.5, 1, ?, 0.5, ?, ?, ?, ?, ?)
		ON CONFLICT(agent_id) DO UPDATE SET
			decision_count = decision_count + 1,
			confidence_sum = confidence_sum + ?,
			correct_decisions = correct_decisions + ?,
			high_conf_errors = high_conf_errors + ?,
			low_conf_correct = low_conf_correct + ?,
			last_updated = ?
	`
	
	correctInt := int64(0)
	if wasCorrect {
		correctInt = 1
	}
	
	highConfError := int64(0)
	if !wasCorrect && confidence >= rm.config.HighConfidenceThresh {
		highConfError = 1
	}
	
	lowConfCorrect := int64(0)
	if wasCorrect && confidence <= rm.config.LowConfidenceThresh {
		lowConfCorrect = 1
	}
	
	now := time.Now()
	accuracyRate := 1.0
	if !wasCorrect {
		accuracyRate = 0.0
	}
	
	_, err := rm.db.ExecContext(ctx, query,
		agentID, accuracyRate, now, confidence, correctInt, highConfError, lowConfCorrect,
		confidence, correctInt, highConfError, lowConfCorrect, now)
	
	if err != nil {
		return fmt.Errorf("failed to record decision: %w", err)
	}
	
	// Invalidate cache for this agent
	rm.mutex.Lock()
	delete(rm.cache, agentID)
	rm.mutex.Unlock()
	
	return nil
}

// GetReputation retrieves the current reputation for an agent
func (rm *ReputationManager) GetReputation(ctx context.Context, agentID string) (*AgentReputation, error) {
	// Check cache first
	rm.mutex.RLock()
	if cached, exists := rm.cache[agentID]; exists {
		rm.mutex.RUnlock()
		return cached, nil
	}
	rm.mutex.RUnlock()
	
	// Load from database
	query := `
		SELECT agent_id, reputation_score, decision_count, accuracy_rate,
			   calibration_score, last_updated, confidence_sum, correct_decisions,
			   high_conf_errors, low_conf_correct
		FROM agent_reputation 
		WHERE agent_id = ?
	`
	
	var rep AgentReputation
	err := rm.db.QueryRowContext(ctx, query, agentID).Scan(
		&rep.AgentID, &rep.ReputationScore, &rep.DecisionCount, &rep.AccuracyRate,
		&rep.CalibrationScore, &rep.LastUpdated, &rep.ConfidenceSum, &rep.CorrectDecisions,
		&rep.HighConfErrors, &rep.LowConfCorrect,
	)
	
	if err == sql.ErrNoRows {
		// Return default reputation for new agents
		return &AgentReputation{
			AgentID:         agentID,
			ReputationScore: 0.5, // Neutral starting reputation
			DecisionCount:   0,
			AccuracyRate:    0.0,
			CalibrationScore: 0.5,
			LastUpdated:     time.Now(),
		}, nil
	}
	
	if err != nil {
		return nil, fmt.Errorf("failed to get reputation: %w", err)
	}
	
	// Cache the result
	rm.mutex.Lock()
	rm.cache[agentID] = &rep
	rm.mutex.Unlock()
	
	return &rep, nil
}

// CalculateReputation recalculates reputation score based on current metrics
func (rm *ReputationManager) CalculateReputation(rep *AgentReputation) float64 {
	if rep.DecisionCount < rm.config.MinDecisionsForScore {
		return 0.5 // Neutral score for insufficient data
	}
	
	// Calculate accuracy component
	accuracyScore := rep.AccuracyRate
	
	// Calculate calibration component (how well confidence aligns with accuracy)
	calibrationScore := rm.calculateCalibration(rep)
	
	// Weighted combination
	reputationScore := (rm.config.AccuracyWeight * accuracyScore) + 
					  (rm.config.CalibrationWeight * calibrationScore)
	
	// Apply decay factor for recency bias
	daysSinceUpdate := time.Since(rep.LastUpdated).Hours() / 24
	decayMultiplier := math.Pow(rm.config.DecayFactor, daysSinceUpdate)
	
	// Blend with neutral score based on decay
	finalScore := (reputationScore * decayMultiplier) + (0.5 * (1 - decayMultiplier))
	
	// Ensure score is within bounds
	if finalScore < 0 {
		finalScore = 0
	}
	if finalScore > 1 {
		finalScore = 1
	}
	
	return finalScore
}

// calculateCalibration computes how well an agent's confidence aligns with actual accuracy
func (rm *ReputationManager) calculateCalibration(rep *AgentReputation) float64 {
	if rep.DecisionCount == 0 {
		return 0.5
	}
	
	// Average confidence
	avgConfidence := rep.ConfidenceSum / float64(rep.DecisionCount)
	
	// Actual accuracy
	actualAccuracy := rep.AccuracyRate
	
	// Calibration penalty for overconfidence and underconfidence
	confidenceError := math.Abs(avgConfidence - actualAccuracy)
	
	// Additional penalties for specific miscalibration patterns
	overconfidencePenalty := float64(rep.HighConfErrors) / float64(rep.DecisionCount)
	underconfidencePenalty := float64(rep.LowConfCorrect) / float64(rep.DecisionCount)
	
	// Calculate calibration score (1.0 = perfect calibration, 0.0 = terrible)
	calibrationScore := 1.0 - confidenceError - (overconfidencePenalty * 0.5) - (underconfidencePenalty * 0.3)
	
	if calibrationScore < 0 {
		calibrationScore = 0
	}
	
	return calibrationScore
}

// UpdateAllReputations recalculates reputation scores for all agents
func (rm *ReputationManager) UpdateAllReputations(ctx context.Context) error {
	query := `
		SELECT agent_id, reputation_score, decision_count, accuracy_rate,
			   calibration_score, last_updated, confidence_sum, correct_decisions,
			   high_conf_errors, low_conf_correct
		FROM agent_reputation
	`
	
	rows, err := rm.db.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to query agent reputations: %w", err)
	}
	defer rows.Close()
	
	updateQuery := `
		UPDATE agent_reputation 
		SET reputation_score = ?, accuracy_rate = ?, calibration_score = ?, last_updated = ?
		WHERE agent_id = ?
	`
	
	now := time.Now()
	for rows.Next() {
		var rep AgentReputation
		err := rows.Scan(
			&rep.AgentID, &rep.ReputationScore, &rep.DecisionCount, &rep.AccuracyRate,
			&rep.CalibrationScore, &rep.LastUpdated, &rep.ConfidenceSum, &rep.CorrectDecisions,
			&rep.HighConfErrors, &rep.LowConfCorrect,
		)
		if err != nil {
			continue
		}
		
		// Recalculate accuracy rate
		if rep.DecisionCount > 0 {
			rep.AccuracyRate = float64(rep.CorrectDecisions) / float64(rep.DecisionCount)
		}
		
		// Recalculate calibration and reputation
		rep.CalibrationScore = rm.calculateCalibration(&rep)
		newReputationScore := rm.CalculateReputation(&rep)
		
		// Update database
		_, err = rm.db.ExecContext(ctx, updateQuery, 
			newReputationScore, rep.AccuracyRate, rep.CalibrationScore, now, rep.AgentID)
		if err != nil {
			continue
		}
		
		// Update metrics
		rm.reputationGauge.WithLabelValues(rep.AgentID, "unknown").Set(newReputationScore)
		rm.accuracyGauge.WithLabelValues(rep.AgentID, "unknown").Set(rep.AccuracyRate)
		rm.calibrationGauge.WithLabelValues(rep.AgentID, "unknown").Set(rep.CalibrationScore)
		
		// Update cache
		rep.ReputationScore = newReputationScore
		rep.LastUpdated = now
		rm.mutex.Lock()
		rm.cache[rep.AgentID] = &rep
		rm.mutex.Unlock()
	}
	
	return nil
}

// getConfidenceBucket categorizes confidence scores into buckets for metrics
func (rm *ReputationManager) getConfidenceBucket(confidence float64) string {
	switch {
	case confidence >= 0.9:
		return "very_high"
	case confidence >= 0.7:
		return "high"
	case confidence >= 0.5:
		return "medium"
	case confidence >= 0.3:
		return "low"
	default:
		return "very_low"
	}
}

// startReputationUpdater runs background reputation updates
func (rm *ReputationManager) startReputationUpdater() {
	ticker := time.NewTicker(rm.config.UpdateInterval)
	defer ticker.Stop()
	
	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		err := rm.UpdateAllReputations(ctx)
		if err != nil {
			// Log error but continue
			fmt.Printf("Error updating reputations: %v\n", err)
		}
		cancel()
	}
}

// GetTopAgents returns agents with highest reputation scores
func (rm *ReputationManager) GetTopAgents(ctx context.Context, limit int) ([]*AgentReputation, error) {
	query := `
		SELECT agent_id, reputation_score, decision_count, accuracy_rate,
			   calibration_score, last_updated, confidence_sum, correct_decisions,
			   high_conf_errors, low_conf_correct
		FROM agent_reputation 
		WHERE decision_count >= ?
		ORDER BY reputation_score DESC 
		LIMIT ?
	`
	
	rows, err := rm.db.QueryContext(ctx, query, rm.config.MinDecisionsForScore, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get top agents: %w", err)
	}
	defer rows.Close()
	
	var agents []*AgentReputation
	for rows.Next() {
		var rep AgentReputation
		err := rows.Scan(
			&rep.AgentID, &rep.ReputationScore, &rep.DecisionCount, &rep.AccuracyRate,
			&rep.CalibrationScore, &rep.LastUpdated, &rep.ConfidenceSum, &rep.CorrectDecisions,
			&rep.HighConfErrors, &rep.LowConfCorrect,
		)
		if err != nil {
			continue
		}
		agents = append(agents, &rep)
	}
	
	return agents, nil
}

// GetProblematicAgents returns agents with low reputation scores
func (rm *ReputationManager) GetProblematicAgents(ctx context.Context, threshold float64) ([]*AgentReputation, error) {
	query := `
		SELECT agent_id, reputation_score, decision_count, accuracy_rate,
			   calibration_score, last_updated, confidence_sum, correct_decisions,
			   high_conf_errors, low_conf_correct
		FROM agent_reputation 
		WHERE reputation_score < ? AND decision_count >= ?
		ORDER BY reputation_score ASC
	`
	
	rows, err := rm.db.QueryContext(ctx, query, threshold, rm.config.MinDecisionsForScore)
	if err != nil {
		return nil, fmt.Errorf("failed to get problematic agents: %w", err)
	}
	defer rows.Close()
	
	var agents []*AgentReputation
	for rows.Next() {
		var rep AgentReputation
		err := rows.Scan(
			&rep.AgentID, &rep.ReputationScore, &rep.DecisionCount, &rep.AccuracyRate,
			&rep.CalibrationScore, &rep.LastUpdated, &rep.ConfidenceSum, &rep.CorrectDecisions,
			&rep.HighConfErrors, &rep.LowConfCorrect,
		)
		if err != nil {
			continue
		}
		agents = append(agents, &rep)
	}
	
	return agents, nil
}