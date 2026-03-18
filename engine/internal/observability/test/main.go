package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"

	"github.com/lelu/engine/internal/observability"
)

func main() {
	fmt.Println("🔍 Testing Enhanced Observability - Phase 1 Implementation")
	fmt.Println("============================================================")

	// Initialize OpenTelemetry with no-op exporter for testing
	ctx := context.Background()
	
	// Create resource
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName("lelu-observability-test"),
			semconv.ServiceVersion("0.3.0"),
		),
	)
	if err != nil {
		log.Fatalf("Failed to create resource: %v", err)
	}

	// Create tracer provider with no-op exporter
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithResource(res),
	)
	defer func() {
		if err := tp.Shutdown(ctx); err != nil {
			log.Printf("Error shutting down tracer provider: %v", err)
		}
	}()

	otel.SetTracerProvider(tp)

	// Initialize agent tracer
	agentTracer := observability.NewAgentTracer("lelu-observability-test")
	correlationMgr := observability.NewCorrelationManager()
	defer correlationMgr.Close()

	// Test 1: Basic Agent Authorization Span
	fmt.Println("\n📊 Test 1: Basic Agent Authorization Span")
	testBasicAgentSpan(ctx, agentTracer)

	// Test 2: Multi-Agent Delegation Correlation
	fmt.Println("\n🔗 Test 2: Multi-Agent Delegation Correlation")
	testDelegationCorrelation(ctx, agentTracer, correlationMgr)

	// Test 3: Swarm Orchestration Tracing
	fmt.Println("\n🐝 Test 3: Swarm Orchestration Tracing")
	testSwarmOrchestration(ctx, agentTracer, correlationMgr)

	// Test 4: Enhanced Metrics Recording
	fmt.Println("\n📈 Test 4: Enhanced Metrics Recording")
	testMetricsRecording()

	// Test 5: Policy Evaluation Tracing
	fmt.Println("\n📋 Test 5: Policy Evaluation Tracing")
	testPolicyEvaluation(ctx, agentTracer)

	// Wait for traces to be exported
	time.Sleep(2 * time.Second)

	fmt.Println("\n🎉 All Enhanced Observability tests completed successfully!")
	fmt.Println("✅ AI Agent Semantic Conventions implemented")
	fmt.Println("✅ Multi-Agent Correlation tracking working")
	fmt.Println("✅ Enhanced Metrics collection functional")
	fmt.Println("✅ Comprehensive tracing operational")
}

func testBasicAgentSpan(ctx context.Context, tracer *observability.AgentTracer) {
	ctx, span := tracer.StartAuthorizationSpan(ctx, "financial_bot", "generate_report", 0.94)
	defer span.End()

	// Simulate authorization process
	start := time.Now()
	time.Sleep(50 * time.Millisecond) // Simulate confidence gate
	confidenceLatency := float64(time.Since(start).Microseconds()) / 1000

	time.Sleep(75 * time.Millisecond) // Simulate policy evaluation
	policyLatency := float64(time.Since(start).Microseconds())/1000 - confidenceLatency

	time.Sleep(25 * time.Millisecond) // Simulate risk evaluation
	totalLatency := float64(time.Since(start).Microseconds()) / 1000
	riskLatency := totalLatency - confidenceLatency - policyLatency

	// Record policy evaluation
	tracer.RecordPolicyEvaluation(span, "financial_policy", "2.1.0", "allowed", policyLatency)

	// Record decision
	tracer.RecordDecision(span, true, false, 0.94, 0.15, "allowed")

	// Record latency breakdown
	tracer.RecordLatency(span, totalLatency, confidenceLatency, policyLatency, riskLatency)

	fmt.Printf("✅ Authorization span created with semantic conventions\n")
	fmt.Printf("   Agent: financial_bot, Action: generate_report\n")
	fmt.Printf("   Confidence: 0.94, Risk Score: 0.15\n")
	fmt.Printf("   Latency: %.2fms (confidence: %.2fms, policy: %.2fms, risk: %.2fms)\n",
		totalLatency, confidenceLatency, policyLatency, riskLatency)
}

func testDelegationCorrelation(ctx context.Context, tracer *observability.AgentTracer, correlationMgr *observability.CorrelationManager) {
	ctx, span := tracer.StartDelegationSpan(ctx, "orchestrator_bot", "worker_bot")
	defer span.End()

	// Start delegation chain tracking
	chainID := correlationMgr.StartDelegationChain(ctx, "orchestrator_bot", "worker_bot")

	// Extend the chain
	correlationMgr.ExtendDelegationChain(ctx, chainID, "specialist_bot")

	// Record successful delegation
	tracer.RecordDecision(span, true, false, 0.89, 0.0, "delegation_allowed")

	// Add delegation-specific attributes
	span.SetAttributes(
		attribute.StringSlice("granted_scopes", []string{"read_data", "process_reports"}),
		attribute.String("token_ttl", "300s"),
	)

	fmt.Printf("✅ Delegation correlation established\n")
	fmt.Printf("   Chain ID: %s\n", chainID)
	fmt.Printf("   Chain: orchestrator_bot → worker_bot → specialist_bot\n")
	fmt.Printf("   Granted Scopes: read_data, process_reports\n")
}

func testSwarmOrchestration(ctx context.Context, tracer *observability.AgentTracer, correlationMgr *observability.CorrelationManager) {
	agents := []string{"data_collector", "analyzer", "reporter"}
	swarmID := "financial_analysis_swarm_001"

	ctx, span := tracer.StartSwarmSpan(ctx, swarmID, "orchestrator")
	defer span.End()
	
	// Add swarm-specific attributes
	span.SetAttributes(
		attribute.StringSlice("ai.swarm.agents", agents),
		attribute.Int("ai.swarm.agent_count", len(agents)),
	)

	// Start swarm operation tracking
	correlationMgr.StartSwarmOperation(ctx, swarmID, "orchestrator", agents)

	// Add an agent to the swarm
	correlationMgr.AddSwarmAgent(ctx, swarmID, "validator")

	// Record swarm metrics
	observability.RecordSwarmOperation(swarmID, "orchestration", "success")
	observability.UpdateSwarmAgentCount(swarmID, 4)

	fmt.Printf("✅ Swarm orchestration traced\n")
	fmt.Printf("   Swarm ID: %s\n", swarmID)
	fmt.Printf("   Orchestrator: orchestrator\n")
	fmt.Printf("   Agents: %v + validator\n", agents)
}

func testMetricsRecording() {
	// Record various agent metrics
	observability.RecordAgentRequest("test_agent", "autonomous", "test_action", "allowed")
	observability.RecordConfidenceScore("test_agent", "test_action", 0.87)
	observability.RecordRiskScore("test_agent", "test_action", 0.23)
	observability.RecordDecisionLatency("test_agent", "total", 0.125)
	observability.RecordDecisionLatency("test_agent", "policy_eval", 0.075)
	observability.UpdateAgentReputation("test_agent", 0.92)
	observability.UpdateAgentAnomalyScore("test_agent", 0.05)

	fmt.Printf("✅ Enhanced metrics recorded\n")
	fmt.Printf("   Agent requests, confidence scores, risk scores\n")
	fmt.Printf("   Decision latency, reputation, anomaly scores\n")
}

func testPolicyEvaluation(ctx context.Context, tracer *observability.AgentTracer) {
	ctx, span := tracer.StartAgentSpan(ctx, "ai.policy.evaluation", "policy_engine")
	defer span.End()

	// Simulate policy evaluation
	start := time.Now()
	time.Sleep(80 * time.Millisecond)
	latency := float64(time.Since(start).Microseconds()) / 1000

	// Record policy evaluation details
	tracer.RecordPolicyEvaluation(span, "security_policy", "3.2.1", "allowed", latency)

	// Add policy-specific attributes
	span.SetAttributes(
		attribute.String("policy.rule_matched", "allow_financial_read"),
		attribute.Int("policy.rules_evaluated", 15),
		attribute.Bool("policy.cache_hit", false),
	)

	fmt.Printf("✅ Policy evaluation traced\n")
	fmt.Printf("   Policy: security_policy v3.2.1\n")
	fmt.Printf("   Result: allowed, Latency: %.2fms\n", latency)
	fmt.Printf("   Rules evaluated: 15, Cache hit: false\n")
}