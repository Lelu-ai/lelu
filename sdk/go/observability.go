package lelu

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// AI Agent Semantic Conventions (matching backend implementation)
const (
	// Agent identification
	AttrAgentID       = "ai.agent.id"
	AttrAgentType     = "ai.agent.type"
	AttrAgentVersion  = "ai.agent.version"
	
	// Request attributes
	AttrRequestIntent     = "ai.request.intent"
	AttrRequestConfidence = "ai.request.confidence"
	AttrRequestActingFor  = "ai.request.acting_for"
	AttrRequestScope      = "ai.request.scope"
	
	// Policy evaluation
	AttrPolicyName    = "ai.policy.name"
	AttrPolicyVersion = "ai.policy.version"
	AttrPolicyResult  = "ai.policy.result"
	
	// Decision attributes
	AttrDecisionType       = "ai.decision.type"
	AttrDecisionConfidence = "ai.decision.confidence"
	AttrDecisionHumanReview = "ai.decision.human_review"
	AttrDecisionRiskScore  = "ai.decision.risk_score"
	AttrDecisionOutcome    = "ai.decision.outcome"
	
	// Multi-agent correlation
	AttrSwarmID         = "ai.swarm.id"
	AttrDelegationChain = "ai.delegation.chain"
	AttrParentAgent     = "ai.parent.agent"
	AttrChildAgent      = "ai.child.agent"
	
	// Performance metrics
	AttrLatencyMs        = "ai.latency.ms"
	AttrConfidenceGateMs = "ai.latency.confidence_gate_ms"
	AttrPolicyEvalMs     = "ai.latency.policy_eval_ms"
	AttrRiskEvalMs       = "ai.latency.risk_eval_ms"
)

// Agent types
const (
	AgentTypeAutonomous = "autonomous"
	AgentTypeAssisted   = "assisted"
	AgentTypeHuman      = "human"
)

// Decision types
const (
	DecisionTypeAutonomous = "autonomous"
	DecisionTypeHumanReview = "human_review"
	DecisionTypeDenied     = "denied"
)

// AgentTracer provides AI agent-aware tracing capabilities for the Go SDK
type AgentTracer struct {
	tracer trace.Tracer
}

// NewAgentTracer creates a new agent-aware tracer
func NewAgentTracer(serviceName string) *AgentTracer {
	return &AgentTracer{
		tracer: otel.Tracer(serviceName),
	}
}

// StartAgentSpan starts a new span with AI agent semantic conventions
func (t *AgentTracer) StartAgentSpan(ctx context.Context, operationName string, agentID string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	// Add agent identification attributes
	agentAttrs := []attribute.KeyValue{
		attribute.String(AttrAgentID, agentID),
		attribute.String(AttrAgentType, AgentTypeAutonomous),
	}
	agentAttrs = append(agentAttrs, attrs...)
	
	ctx, span := t.tracer.Start(ctx, operationName)
	span.SetAttributes(agentAttrs...)
	
	return ctx, span
}

// StartAuthorizationSpan starts a span for agent authorization with full context
func (t *AgentTracer) StartAuthorizationSpan(ctx context.Context, agentID, action string, confidence float64) (context.Context, trace.Span) {
	return t.StartAgentSpan(ctx, "ai.agent.authorize",
		agentID,
		attribute.String(AttrRequestIntent, action),
		attribute.Float64(AttrRequestConfidence, confidence),
		attribute.String(AttrDecisionType, DecisionTypeAutonomous),
	)
}

// StartDelegationSpan starts a span for multi-agent delegation
func (t *AgentTracer) StartDelegationSpan(ctx context.Context, delegator, delegatee string) (context.Context, trace.Span) {
	return t.StartAgentSpan(ctx, "ai.agent.delegate",
		delegator,
		attribute.String(AttrParentAgent, delegator),
		attribute.String(AttrChildAgent, delegatee),
		attribute.String(AttrDelegationChain, fmt.Sprintf("%s→%s", delegator, delegatee)),
	)
}

// StartSwarmSpan starts a span for swarm orchestration
func (t *AgentTracer) StartSwarmSpan(ctx context.Context, swarmID string, orchestrator string, agents []string) (context.Context, trace.Span) {
	return t.StartAgentSpan(ctx, "ai.swarm.orchestration",
		orchestrator,
		attribute.String(AttrAgentType, "orchestrator"),
		attribute.String(AttrSwarmID, swarmID),
		attribute.StringSlice("ai.swarm.agents", agents),
		attribute.Int("ai.swarm.agent_count", len(agents)),
	)
}

// RecordPolicyEvaluation records policy evaluation details in the span
func (t *AgentTracer) RecordPolicyEvaluation(span trace.Span, policyName, policyVersion, result string, latencyMs float64) {
	if span == nil {
		return
	}
	span.SetAttributes(
		attribute.String(AttrPolicyName, policyName),
		attribute.String(AttrPolicyVersion, policyVersion),
		attribute.String(AttrPolicyResult, result),
		attribute.Float64(AttrPolicyEvalMs, latencyMs),
	)
}

// RecordDecision records the final authorization decision
func (t *AgentTracer) RecordDecision(span trace.Span, allowed bool, requiresHumanReview bool, confidence, riskScore float64, outcome string) {
	if span == nil {
		return
	}
	
	decisionType := DecisionTypeAutonomous
	if requiresHumanReview {
		decisionType = DecisionTypeHumanReview
	} else if !allowed {
		decisionType = DecisionTypeDenied
	}
	
	span.SetAttributes(
		attribute.String(AttrDecisionType, decisionType),
		attribute.Float64(AttrDecisionConfidence, confidence),
		attribute.Bool(AttrDecisionHumanReview, requiresHumanReview),
		attribute.Float64(AttrDecisionRiskScore, riskScore),
		attribute.String(AttrDecisionOutcome, outcome),
	)
	
	// Set span status based on decision
	if !allowed && !requiresHumanReview {
		span.SetStatus(codes.Error, "Authorization denied")
	} else {
		span.SetStatus(codes.Ok, "")
	}
}

// RecordLatency records operation latency
func (t *AgentTracer) RecordLatency(span trace.Span, totalMs, confidenceGateMs, policyEvalMs, riskEvalMs float64) {
	if span == nil {
		return
	}
	span.SetAttributes(
		attribute.Float64(AttrLatencyMs, totalMs),
		attribute.Float64(AttrConfidenceGateMs, confidenceGateMs),
		attribute.Float64(AttrPolicyEvalMs, policyEvalMs),
		attribute.Float64(AttrRiskEvalMs, riskEvalMs),
	)
}

// InjectCorrelationContext injects correlation context for multi-agent tracing
func (t *AgentTracer) InjectCorrelationContext(span trace.Span, delegationChain string) {
	if span == nil {
		return
	}
	
	span.SetAttributes(
		attribute.String(AttrDelegationChain, delegationChain),
	)
}

// WithAgentSpan executes a function within an agent span context
func (t *AgentTracer) WithAgentSpan(ctx context.Context, operationName string, agentID string, fn func(context.Context, trace.Span) error, attrs ...attribute.KeyValue) error {
	ctx, span := t.StartAgentSpan(ctx, operationName, agentID, attrs...)
	defer span.End()
	
	if err := fn(ctx, span); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	
	span.SetStatus(codes.Ok, "")
	return nil
}

// DecisionMetrics holds decision-related metrics for recording
type DecisionMetrics struct {
	Allowed             bool
	RequiresHumanReview bool
	Confidence          float64
	RiskScore           float64
	Outcome             string
}

// LatencyMetrics holds latency-related metrics for recording
type LatencyMetrics struct {
	TotalMs          float64
	ConfidenceGateMs float64
	PolicyEvalMs     float64
	RiskEvalMs       float64
}

// Default agent tracer instance
var defaultAgentTracer = NewAgentTracer("lelu-go-sdk")

// GetAgentTracer returns the default agent tracer instance
func GetAgentTracer() *AgentTracer {
	return defaultAgentTracer
}

// SetAgentTracer sets a custom agent tracer instance
func SetAgentTracer(tracer *AgentTracer) {
	defaultAgentTracer = tracer
}