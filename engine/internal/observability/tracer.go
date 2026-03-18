// Package observability provides advanced observability capabilities for AI agents.
// This implements Phase 1 of the Advanced Observability & Telemetry roadmap.
package observability

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// AI Agent Semantic Conventions
// These follow OpenTelemetry semantic conventions for AI systems
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

// AgentTracer provides AI agent-aware tracing capabilities
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
func (t *AgentTracer) StartSwarmSpan(ctx context.Context, swarmID string, orchestrator string) (context.Context, trace.Span) {
	return t.StartAgentSpan(ctx, "ai.swarm.orchestration",
		orchestrator,
		attribute.String(AttrSwarmID, swarmID),
		attribute.String(AttrAgentType, "orchestrator"),
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
func (t *AgentTracer) InjectCorrelationContext(ctx context.Context, parentSpan trace.Span, delegationChain string) context.Context {
	if parentSpan == nil {
		return ctx
	}
	
	// Add correlation attributes to the parent span
	parentSpan.SetAttributes(
		attribute.String(AttrDelegationChain, delegationChain),
	)
	
	return ctx
}

// ExtractCorrelationContext extracts correlation context from incoming requests
func (t *AgentTracer) ExtractCorrelationContext(ctx context.Context) (string, string) {
	span := trace.SpanFromContext(ctx)
	if span == nil {
		return "", ""
	}
	
	// In a real implementation, you would extract these from span context
	// For now, we'll return empty strings as placeholders
	return "", ""
}