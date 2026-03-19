package observability

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// IntegratedObservability demonstrates how all three phases work together
type IntegratedObservability struct {
	// Phase 1: Tracing
	Tracer *AgentTracer

	// Phase 2: Behavioral Analytics
	AnomalyDetector  *AnomalyDetector
	BaselineManager  *BaselineManager
	ReputationManager *ReputationManager

	// Phase 3: Real-time Intelligence
	PredictiveAnalytics *PredictiveAnalytics
	AlertManager        *AlertManager
	CorrelationManager  *CorrelationManager
}

// NewIntegratedObservability creates a fully integrated observability system
func NewIntegratedObservability(db *sql.DB) *IntegratedObservability {
	return &IntegratedObservability{
		// Phase 1
		Tracer: NewAgentTracer("lelu-engine"),

		// Phase 2
		AnomalyDetector:   NewAnomalyDetector(db, DefaultAnomalyConfig()),
		BaselineManager:   NewBaselineManager(db, DefaultBaselineConfig()),
		ReputationManager: NewReputationManager(db, DefaultReputationConfig()),

		// Phase 3
		PredictiveAnalytics: NewPredictiveAnalytics(db, DefaultPredictiveConfig()),
		AlertManager:        NewAlertManager(db, DefaultAlertConfig()),
		CorrelationManager:  NewCorrelationManager(),
	}
}

// ProcessAuthorizationRequest demonstrates end-to-end observability
func (io *IntegratedObservability) ProcessAuthorizationRequest(
	ctx context.Context,
	agentID, agentType, action string,
	confidence float64,
) error {
	startTime := time.Now()

	// Phase 1: Start tracing
	ctx, span := io.Tracer.StartAuthorizationSpan(ctx, agentID, action, confidence)
	defer span.End()

	// Phase 3: Predict confidence (if needed)
	prediction, err := io.PredictiveAnalytics.PredictConfidence(ctx, agentID, action)
	if err == nil {
		fmt.Printf("Predicted confidence: %.2f (actual: %.2f)\n",
			prediction.PredictedConfidence, confidence)
	}

	// Phase 3: Predict human review need
	reviewPrediction, err := io.PredictiveAnalytics.PredictHumanReview(ctx, agentID, action, confidence)
	if err == nil && reviewPrediction.NeedsReview {
		fmt.Printf("Human review recommended (%.0f%% probability)\n",
			reviewPrediction.ReviewProbability*100)
		fmt.Printf("Risk factors: %v\n", reviewPrediction.RiskFactors)
	}

	// Simulate policy evaluation
	policyStart := time.Now()
	policyResult := "allowed"
	policyLatency := time.Since(policyStart).Milliseconds()

	// Phase 1: Record policy evaluation
	io.Tracer.RecordPolicyEvaluation(span, "main_policy", "1.0.0", policyResult, float64(policyLatency))

	// Simulate risk evaluation
	riskStart := time.Now()
	riskScore := 0.2
	riskLatency := time.Since(riskStart).Milliseconds()

	// Calculate total latency
	totalLatency := time.Since(startTime)

	// Phase 1: Record decision
	decision := DecisionMetrics{
		Allowed:             true,
		RequiresHumanReview: reviewPrediction != nil && reviewPrediction.NeedsReview,
		Confidence:          confidence,
		RiskScore:           riskScore,
		Outcome:             "approved",
	}
	io.Tracer.RecordDecision(span, decision.Allowed, decision.RequiresHumanReview,
		decision.Confidence, decision.RiskScore, decision.Outcome)

	// Phase 1: Record latency
	io.Tracer.RecordLatency(span, float64(totalLatency.Milliseconds()),
		0, float64(policyLatency), float64(riskLatency))

	// Phase 2: Detect anomalies
	anomalyResult, err := io.AnomalyDetector.DetectAnomaly(ctx, agentID, agentType, action,
		confidence, totalLatency, "success")
	if err == nil && anomalyResult.IsAnomaly {
		fmt.Printf("⚠️  Anomaly detected: %s (score: %.2f)\n",
			anomalyResult.Explanation, anomalyResult.AnomalyScore)

		// Phase 3: Trigger alert
		err = io.AlertManager.CheckAnomalyAlert(ctx, anomalyResult)
		if err != nil {
			fmt.Printf("Failed to trigger anomaly alert: %v\n", err)
		}
	}

	// Phase 2: Update baseline
	err = io.BaselineManager.UpdateBaseline(ctx, agentID, action, "success", confidence, totalLatency)
	if err != nil {
		fmt.Printf("Failed to update baseline: %v\n", err)
	}

	// Phase 2: Record decision for reputation
	wasCorrect := true // In real system, this would be determined later
	err = io.ReputationManager.RecordDecision(ctx, agentID, agentType, confidence, wasCorrect, "success")
	if err != nil {
		fmt.Printf("Failed to record decision: %v\n", err)
	}

	// Phase 2: Check reputation
	reputation, err := io.ReputationManager.GetReputation(ctx, agentID)
	if err == nil {
		fmt.Printf("Agent reputation: %.2f (accuracy: %.0f%%)\n",
			reputation.ReputationScore, reputation.AccuracyRate*100)

		// Phase 3: Check for reputation alerts
		err = io.AlertManager.CheckReputationAlert(ctx, agentID, reputation)
		if err != nil {
			fmt.Printf("Failed to check reputation alert: %v\n", err)
		}
	}

	// Phase 1: Record metrics
	RecordAgentRequest(agentID, agentType, action, "success")
	RecordConfidenceScore(agentID, action, confidence)
	RecordDecisionLatency(agentID, "total", totalLatency.Seconds())
	RecordRiskScore(agentID, action, riskScore)

	return nil
}

// ProcessSwarmOperation demonstrates multi-agent correlation
func (io *IntegratedObservability) ProcessSwarmOperation(
	ctx context.Context,
	swarmID, orchestrator string,
	agents []string,
) error {
	// Phase 3: Start swarm tracking
	io.CorrelationManager.StartSwarmOperation(ctx, swarmID, orchestrator, agents)

	// Phase 1: Start swarm span
	ctx, span := io.Tracer.StartSwarmSpan(ctx, swarmID, orchestrator)
	defer span.End()

	fmt.Printf("🔄 Processing swarm %s with %d agents\n", swarmID, len(agents))

	// Process each agent in the swarm
	for _, agentID := range agents {
		// Phase 3: Start delegation chain
		chainID := io.CorrelationManager.StartDelegationChain(ctx, orchestrator, agentID)

		// Phase 1: Start delegation span
		delegationCtx, delegationSpan := io.Tracer.StartDelegationSpan(ctx, orchestrator, agentID)

		// Simulate agent work
		err := io.ProcessAuthorizationRequest(delegationCtx, agentID, "autonomous",
			"execute_task", 0.85)
		if err != nil {
			fmt.Printf("Agent %s failed: %v\n", agentID, err)
		}

		// Phase 1: Record delegation
		RecordDelegation(orchestrator, agentID, "success")

		delegationSpan.End()

		// Phase 3: Extend chain if needed
		io.CorrelationManager.ExtendDelegationChain(delegationCtx, chainID, agentID)
	}

	// Phase 1: Record swarm metrics
	RecordSwarmOperation(swarmID, "complete", "success")
	UpdateSwarmAgentCount(swarmID, float64(len(agents)))

	fmt.Printf("✅ Swarm %s completed successfully\n", swarmID)

	return nil
}

// AnalyzeSystemHealth provides comprehensive system health analysis
func (io *IntegratedObservability) AnalyzeSystemHealth(ctx context.Context) error {
	fmt.Println("\n📊 System Health Analysis")
	fmt.Println("=" + string(make([]byte, 50)))

	// Phase 2: Check baseline health for all agents
	// (In real system, would iterate through all agents)
	agentIDs := []string{"agent_001", "agent_002", "agent_003"}

	for _, agentID := range agentIDs {
		health, err := io.BaselineManager.AssessBaselineHealth(ctx, agentID)
		if err != nil {
			continue
		}

		fmt.Printf("\nAgent: %s\n", agentID)
		fmt.Printf("  Overall Health: %.0f%%\n", health.OverallHealth*100)
		fmt.Printf("  Sample Count: %d\n", health.SampleCount)
		fmt.Printf("  Age: %v\n", health.Age.Round(time.Hour))
		fmt.Printf("  Needs Refresh: %v\n", health.NeedsRefresh)

		if len(health.RecommendedActions) > 0 {
			fmt.Printf("  Recommendations:\n")
			for _, action := range health.RecommendedActions {
				fmt.Printf("    - %s\n", action)
			}
		}

		// Phase 2: Check for drift
		drift, err := io.BaselineManager.DetectDrift(ctx, agentID)
		if err == nil && drift.DriftScore > 0.3 {
			fmt.Printf("  ⚠️  Drift detected: %s (score: %.2f)\n",
				drift.Explanation, drift.DriftScore)

			// Phase 3: Trigger drift alert
			err = io.AlertManager.CheckDriftAlert(ctx, drift)
			if err != nil {
				fmt.Printf("  Failed to trigger drift alert: %v\n", err)
			}
		}
	}

	// Phase 3: Get policy optimization suggestions
	fmt.Println("\n💡 Policy Optimization Suggestions")
	fmt.Println("=" + string(make([]byte, 50)))

	suggestions, err := io.PredictiveAnalytics.SuggestPolicyOptimizations(ctx)
	if err != nil {
		fmt.Printf("Failed to get suggestions: %v\n", err)
	} else if len(suggestions) == 0 {
		fmt.Println("No optimization suggestions at this time")
	} else {
		for _, suggestion := range suggestions {
			fmt.Printf("\nPolicy: %s (current score: %.0f%%)\n",
				suggestion.PolicyName, suggestion.CurrentScore*100)
			fmt.Printf("  Priority: %s\n", suggestion.Priority)
			fmt.Printf("  Suggestion: %s\n", suggestion.Suggestion)
			fmt.Printf("  Rationale: %s\n", suggestion.Rationale)
			fmt.Printf("  Expected Impact: %.0f%%\n", suggestion.ExpectedImpact*100)
		}
	}

	// Phase 3: Get active alerts
	fmt.Println("\n🚨 Active Alerts")
	fmt.Println("=" + string(make([]byte, 50)))

	alerts, err := io.AlertManager.GetActiveAlerts(ctx, "")
	if err != nil {
		fmt.Printf("Failed to get alerts: %v\n", err)
	} else if len(alerts) == 0 {
		fmt.Println("No active alerts")
	} else {
		for _, alert := range alerts {
			fmt.Printf("\n[%s] %s\n", alert.Severity, alert.Title)
			fmt.Printf("  Agent: %s\n", alert.AgentID)
			fmt.Printf("  Description: %s\n", alert.Description)
			fmt.Printf("  Status: %s\n", alert.Status)
			fmt.Printf("  Time: %v\n", alert.Timestamp.Format(time.RFC3339))
		}
	}

	return nil
}

// ExampleUsage demonstrates how to use the integrated observability system
func ExampleUsage() {
	// Initialize database (placeholder)
	var db *sql.DB // In real system, initialize actual database

	// Create integrated observability system
	obs := NewIntegratedObservability(db)
	defer obs.CorrelationManager.Close()

	ctx := context.Background()

	// Example 1: Single agent authorization
	fmt.Println("Example 1: Single Agent Authorization")
	fmt.Println("=" + string(make([]byte, 50)))
	err := obs.ProcessAuthorizationRequest(ctx, "agent_001", "autonomous",
		"read:database", 0.92)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	}

	// Example 2: Multi-agent swarm operation
	fmt.Println("\n\nExample 2: Multi-Agent Swarm Operation")
	fmt.Println("=" + string(make([]byte, 50)))
	err = obs.ProcessSwarmOperation(ctx, "swarm_001", "orchestrator_agent",
		[]string{"worker_1", "worker_2", "worker_3"})
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	}

	// Example 3: System health analysis
	fmt.Println("\n\nExample 3: System Health Analysis")
	fmt.Println("=" + string(make([]byte, 50)))
	err = obs.AnalyzeSystemHealth(ctx)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}
