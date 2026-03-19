package lelu

import (
	"context"
	"testing"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func TestAgentTracer_StartAgentSpan(t *testing.T) {
	// Test agent tracer without full OpenTelemetry setup
	tracer := NewAgentTracer("lelu-go-sdk-test")
	if tracer == nil {
		t.Fatal("Expected non-nil tracer")
	}

	// Test starting an agent span
	ctx := context.Background()
	ctx, span := tracer.StartAgentSpan(ctx, "test.operation", "test_agent")
	if span == nil {
		t.Fatal("Expected non-nil span")
	}
	defer span.End()

	// Verify span has agent attributes
	span.SetAttributes(
		attribute.String(AttrRequestIntent, "test_action"),
		attribute.Float64(AttrRequestConfidence, 0.95),
	)

	// Test should complete without errors
}

func TestAgentTracer_StartAuthorizationSpan(t *testing.T) {
	tracer := NewAgentTracer("lelu-go-sdk-test")
	
	// Test authorization span
	ctx := context.Background()
	ctx, span := tracer.StartAuthorizationSpan(ctx, "financial_bot", "generate_report", 0.94)
	if span == nil {
		t.Fatal("Expected non-nil authorization span")
	}
	defer span.End()

	// Test recording decision
	tracer.RecordDecision(span, true, false, 0.94, 0.15, "allowed")
	
	// Test recording latency
	tracer.RecordLatency(span, 125.5, 25.0, 75.0, 25.5)
	
	// Test recording policy evaluation
	tracer.RecordPolicyEvaluation(span, "test_policy", "1.0.0", "allowed", 75.0)
}

func TestAgentTracer_StartDelegationSpan(t *testing.T) {
	tracer := NewAgentTracer("lelu-go-sdk-test")
	
	// Test delegation span
	ctx := context.Background()
	ctx, span := tracer.StartDelegationSpan(ctx, "orchestrator", "worker_bot")
	if span == nil {
		t.Fatal("Expected non-nil delegation span")
	}
	defer span.End()

	// Test correlation context injection
	tracer.InjectCorrelationContext(span, "orchestrator→worker_bot")
}

func TestGetAgentTracer(t *testing.T) {
	tracer := GetAgentTracer()
	if tracer == nil {
		t.Fatal("Expected non-nil default tracer")
	}
}

func TestSetAgentTracer(t *testing.T) {
	originalTracer := GetAgentTracer()
	
	customTracer := NewAgentTracer("custom-tracer")
	SetAgentTracer(customTracer)
	
	if GetAgentTracer() != customTracer {
		t.Fatal("Expected custom tracer to be set")
	}
	
	// Restore original tracer
	SetAgentTracer(originalTracer)
}

func TestWithAgentSpan(t *testing.T) {
	tracer := NewAgentTracer("lelu-go-sdk-test")
	
	// Test WithAgentSpan helper
	executed := false
	err := tracer.WithAgentSpan(context.Background(), "test.operation", "test_agent", func(ctx context.Context, span trace.Span) error {
		executed = true
		if span == nil {
			t.Error("Expected non-nil span in callback")
		}
		return nil
	})
	
	if err != nil {
		t.Fatalf("WithAgentSpan failed: %v", err)
	}
	
	if !executed {
		t.Fatal("Expected callback to be executed")
	}
}

func TestSemanticConventions(t *testing.T) {
	// Test that all semantic convention constants are defined
	constants := []string{
		AttrAgentID,
		AttrAgentType,
		AttrAgentVersion,
		AttrRequestIntent,
		AttrRequestConfidence,
		AttrRequestActingFor,
		AttrRequestScope,
		AttrPolicyName,
		AttrPolicyVersion,
		AttrPolicyResult,
		AttrDecisionType,
		AttrDecisionConfidence,
		AttrDecisionHumanReview,
		AttrDecisionRiskScore,
		AttrDecisionOutcome,
		AttrSwarmID,
		AttrDelegationChain,
		AttrParentAgent,
		AttrChildAgent,
		AttrLatencyMs,
		AttrConfidenceGateMs,
		AttrPolicyEvalMs,
		AttrRiskEvalMs,
	}
	
	for _, constant := range constants {
		if constant == "" {
			t.Errorf("Semantic convention constant is empty")
		}
	}
	
	// Test agent type constants
	agentTypes := []string{
		AgentTypeAutonomous,
		AgentTypeAssisted,
		AgentTypeHuman,
	}
	
	for _, agentType := range agentTypes {
		if agentType == "" {
			t.Errorf("Agent type constant is empty")
		}
	}
	
	// Test decision type constants
	decisionTypes := []string{
		DecisionTypeAutonomous,
		DecisionTypeHumanReview,
		DecisionTypeDenied,
	}
	
	for _, decisionType := range decisionTypes {
		if decisionType == "" {
			t.Errorf("Decision type constant is empty")
		}
	}
}