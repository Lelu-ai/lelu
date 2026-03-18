package observability

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Enhanced metrics for AI agent observability
var (
	// Agent-specific request metrics
	AgentRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "lelu_agent_requests_total",
		Help: "Total number of agent authorization requests",
	}, []string{"agent_id", "agent_type", "action", "outcome"})

	// Confidence score distribution
	AgentConfidenceHistogram = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "lelu_agent_confidence_score",
		Help:    "Distribution of agent confidence scores",
		Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 1.0},
	}, []string{"agent_id", "action"})

	// Decision latency by component
	AgentDecisionLatency = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "lelu_agent_decision_latency_seconds",
		Help:    "Latency of agent decision components",
		Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0},
	}, []string{"agent_id", "component"}) // component: confidence_gate, policy_eval, risk_eval, total

	// Risk score distribution
	AgentRiskScoreHistogram = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "lelu_agent_risk_score",
		Help:    "Distribution of agent risk scores",
		Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
	}, []string{"agent_id", "action"})

	// Human review queue metrics
	AgentHumanReviewTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "lelu_agent_human_review_total",
		Help: "Total number of agent requests requiring human review",
	}, []string{"agent_id", "reason"})

	// Multi-agent delegation metrics
	AgentDelegationTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "lelu_agent_delegation_total",
		Help: "Total number of agent delegations",
	}, []string{"delegator", "delegatee", "outcome"})

	// Agent reputation metrics
	AgentReputationScore = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "lelu_agent_reputation_score",
		Help: "Current reputation score for agents (0-1)",
	}, []string{"agent_id"})

	// Policy effectiveness metrics
	PolicyEffectivenessRate = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "lelu_policy_effectiveness_rate",
		Help: "Policy effectiveness rate (successful decisions / total decisions)",
	}, []string{"policy_name", "policy_version"})

	// Confidence calibration metrics
	ConfidenceCalibrationError = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "lelu_confidence_calibration_error",
		Help: "Confidence calibration error (difference between confidence and actual accuracy)",
	}, []string{"agent_id", "confidence_bucket"})

	// Anomaly detection metrics
	AgentAnomalyScore = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "lelu_agent_anomaly_score",
		Help: "Current anomaly score for agent behavior (0-1, higher = more anomalous)",
	}, []string{"agent_id"})

	// Swarm orchestration metrics
	SwarmOperationsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "lelu_swarm_operations_total",
		Help: "Total number of swarm orchestration operations",
	}, []string{"swarm_id", "operation_type", "outcome"})

	SwarmAgentCount = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "lelu_swarm_agent_count",
		Help: "Number of active agents in each swarm",
	}, []string{"swarm_id"})
)

// RecordAgentRequest records an agent authorization request
func RecordAgentRequest(agentID, agentType, action, outcome string) {
	AgentRequestsTotal.WithLabelValues(agentID, agentType, action, outcome).Inc()
}

// RecordConfidenceScore records an agent's confidence score
func RecordConfidenceScore(agentID, action string, confidence float64) {
	AgentConfidenceHistogram.WithLabelValues(agentID, action).Observe(confidence)
}

// RecordDecisionLatency records decision component latency
func RecordDecisionLatency(agentID, component string, latencySeconds float64) {
	AgentDecisionLatency.WithLabelValues(agentID, component).Observe(latencySeconds)
}

// RecordRiskScore records an agent's risk score
func RecordRiskScore(agentID, action string, riskScore float64) {
	AgentRiskScoreHistogram.WithLabelValues(agentID, action).Observe(riskScore)
}

// RecordHumanReview records a human review requirement
func RecordHumanReview(agentID, reason string) {
	AgentHumanReviewTotal.WithLabelValues(agentID, reason).Inc()
}

// RecordDelegation records an agent delegation
func RecordDelegation(delegator, delegatee, outcome string) {
	AgentDelegationTotal.WithLabelValues(delegator, delegatee, outcome).Inc()
}

// UpdateAgentReputation updates an agent's reputation score
func UpdateAgentReputation(agentID string, score float64) {
	AgentReputationScore.WithLabelValues(agentID).Set(score)
}

// UpdatePolicyEffectiveness updates policy effectiveness rate
func UpdatePolicyEffectiveness(policyName, policyVersion string, rate float64) {
	PolicyEffectivenessRate.WithLabelValues(policyName, policyVersion).Set(rate)
}

// UpdateConfidenceCalibration updates confidence calibration error
func UpdateConfidenceCalibration(agentID, confidenceBucket string, errorRate float64) {
	ConfidenceCalibrationError.WithLabelValues(agentID, confidenceBucket).Set(errorRate)
}

// UpdateAgentAnomalyScore updates an agent's anomaly score
func UpdateAgentAnomalyScore(agentID string, score float64) {
	AgentAnomalyScore.WithLabelValues(agentID).Set(score)
}

// RecordSwarmOperation records a swarm orchestration operation
func RecordSwarmOperation(swarmID, operationType, outcome string) {
	SwarmOperationsTotal.WithLabelValues(swarmID, operationType, outcome).Inc()
}

// UpdateSwarmAgentCount updates the number of agents in a swarm
func UpdateSwarmAgentCount(swarmID string, count float64) {
	SwarmAgentCount.WithLabelValues(swarmID).Set(count)
}
