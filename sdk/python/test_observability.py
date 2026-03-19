#!/usr/bin/env python3
"""
Test suite for Python SDK observability implementation.
Tests Phase 1, 2, and 3 observability features.
"""

import time
import unittest
from datetime import datetime, timedelta
from typing import Dict, Any

# Import observability modules
try:
    from auth_pe.observability import (
        AgentTracer,
        AIAgentAttributes,
        AgentTypes,
        DecisionTypes,
        DecisionMetrics,
        LatencyMetrics,
        get_agent_tracer,
    )
    OBSERVABILITY_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Could not import observability module: {e}")
    OBSERVABILITY_AVAILABLE = False


class TestAgentTracer(unittest.TestCase):
    """Test AI agent tracing capabilities."""
    
    def setUp(self):
        """Set up test fixtures."""
        if not OBSERVABILITY_AVAILABLE:
            self.skipTest("Observability module not available")
        
        self.tracer = AgentTracer(service_name="test-service")
        self.agent_id = "test_agent_001"
    
    def test_start_agent_span(self):
        """Test starting an agent span with semantic conventions."""
        span = self.tracer.start_agent_span(
            "test.operation",
            self.agent_id,
            AgentTypes.AUTONOMOUS
        )
        
        self.assertIsNotNone(span)
        span.end()
    
    def test_start_authorization_span(self):
        """Test starting an authorization span."""
        span = self.tracer.start_authorization_span(
            self.agent_id,
            "read:database",
            0.85
        )
        
        self.assertIsNotNone(span)
        span.end()
    
    def test_start_delegation_span(self):
        """Test starting a delegation span."""
        span = self.tracer.start_delegation_span(
            "orchestrator_agent",
            "worker_agent"
        )
        
        self.assertIsNotNone(span)
        span.end()
    
    def test_start_swarm_span(self):
        """Test starting a swarm orchestration span."""
        agents = ["agent_1", "agent_2", "agent_3"]
        span = self.tracer.start_swarm_span(
            "swarm_001",
            "orchestrator",
            agents
        )
        
        self.assertIsNotNone(span)
        span.end()
    
    def test_record_policy_evaluation(self):
        """Test recording policy evaluation."""
        span = self.tracer.start_agent_span("test.policy", self.agent_id)
        
        self.tracer.record_policy_evaluation(
            span,
            "payment_policy",
            "1.0.0",
            "allowed",
            15.5
        )
        
        span.end()
    
    def test_record_decision(self):
        """Test recording authorization decision."""
        span = self.tracer.start_agent_span("test.decision", self.agent_id)
        
        metrics = DecisionMetrics(
            allowed=True,
            requires_human_review=False,
            confidence=0.92,
            risk_score=0.15,
            outcome="approved"
        )
        
        self.tracer.record_decision(span, metrics)
        span.end()
    
    def test_record_latency(self):
        """Test recording latency metrics."""
        span = self.tracer.start_agent_span("test.latency", self.agent_id)
        
        metrics = LatencyMetrics(
            total_ms=125.5,
            confidence_gate_ms=10.2,
            policy_eval_ms=50.3,
            risk_eval_ms=25.0
        )
        
        self.tracer.record_latency(span, metrics)
        span.end()
    
    def test_agent_span_context_manager(self):
        """Test agent span context manager."""
        with self.tracer.agent_span(
            "test.context",
            self.agent_id,
            AgentTypes.AUTONOMOUS
        ) as span:
            self.assertIsNotNone(span)
            # Simulate some work
            time.sleep(0.01)
    
    def test_agent_span_with_exception(self):
        """Test agent span handles exceptions properly."""
        try:
            with self.tracer.agent_span("test.exception", self.agent_id) as span:
                self.assertIsNotNone(span)
                raise ValueError("Test exception")
        except ValueError:
            pass  # Expected
    
    def test_inject_correlation_context(self):
        """Test injecting correlation context."""
        span = self.tracer.start_agent_span("test.correlation", self.agent_id)
        
        self.tracer.inject_correlation_context(
            span,
            "orchestrator→worker1→worker2"
        )
        
        span.end()


class TestObservabilityIntegration(unittest.TestCase):
    """Test end-to-end observability integration."""
    
    def setUp(self):
        """Set up test fixtures."""
        if not OBSERVABILITY_AVAILABLE:
            self.skipTest("Observability module not available")
        
        self.tracer = get_agent_tracer("integration-test")
    
    def test_full_authorization_flow(self):
        """Test complete authorization flow with observability."""
        agent_id = "integration_agent"
        action = "write:database"
        confidence = 0.88
        
        # Start authorization span
        with self.tracer.agent_span(
            "ai.agent.authorize",
            agent_id,
            AgentTypes.AUTONOMOUS
        ) as span:
            # Record request details
            start_time = time.time()
            
            # Simulate confidence gate
            time.sleep(0.01)
            confidence_gate_time = (time.time() - start_time) * 1000
            
            # Simulate policy evaluation
            policy_start = time.time()
            time.sleep(0.02)
            policy_time = (time.time() - policy_start) * 1000
            
            self.tracer.record_policy_evaluation(
                span,
                "test_policy",
                "1.0.0",
                "allowed",
                policy_time
            )
            
            # Simulate risk evaluation
            risk_start = time.time()
            time.sleep(0.01)
            risk_time = (time.time() - risk_start) * 1000
            
            # Record final decision
            total_time = (time.time() - start_time) * 1000
            
            decision = DecisionMetrics(
                allowed=True,
                requires_human_review=False,
                confidence=confidence,
                risk_score=0.2,
                outcome="approved"
            )
            self.tracer.record_decision(span, decision)
            
            latency = LatencyMetrics(
                total_ms=total_time,
                confidence_gate_ms=confidence_gate_time,
                policy_eval_ms=policy_time,
                risk_eval_ms=risk_time
            )
            self.tracer.record_latency(span, latency)
    
    def test_multi_agent_delegation(self):
        """Test multi-agent delegation with correlation."""
        orchestrator = "orchestrator_agent"
        workers = ["worker_1", "worker_2", "worker_3"]
        
        # Start orchestrator span
        with self.tracer.agent_span(
            "ai.swarm.orchestration",
            orchestrator,
            agent_type="orchestrator"
        ) as parent_span:
            # Delegate to workers
            for worker in workers:
                with self.tracer.agent_span(
                    "ai.agent.delegate",
                    orchestrator
                ) as delegation_span:
                    self.tracer.inject_correlation_context(
                        delegation_span,
                        f"{orchestrator}→{worker}"
                    )
                    
                    # Simulate worker execution
                    time.sleep(0.01)
    
    def test_swarm_orchestration(self):
        """Test swarm orchestration tracing."""
        swarm_id = "test_swarm_001"
        orchestrator = "swarm_orchestrator"
        agents = ["agent_a", "agent_b", "agent_c"]
        
        # Start swarm span
        with self.tracer.agent_span(
            "ai.swarm.orchestration",
            orchestrator,
            agent_type="orchestrator"
        ) as swarm_span:
            # Simulate swarm operations
            for agent in agents:
                with self.tracer.agent_span(
                    f"ai.agent.{agent}.execute",
                    agent,
                    AgentTypes.AUTONOMOUS
                ) as agent_span:
                    # Simulate agent work
                    time.sleep(0.005)
                    
                    # Record agent decision
                    decision = DecisionMetrics(
                        allowed=True,
                        requires_human_review=False,
                        confidence=0.9,
                        risk_score=0.1,
                        outcome="completed"
                    )
                    self.tracer.record_decision(agent_span, decision)


class TestObservabilityPerformance(unittest.TestCase):
    """Test observability performance and overhead."""
    
    def setUp(self):
        """Set up test fixtures."""
        if not OBSERVABILITY_AVAILABLE:
            self.skipTest("Observability module not available")
        
        self.tracer = get_agent_tracer("performance-test")
    
    def test_span_creation_performance(self):
        """Test performance of span creation."""
        iterations = 1000
        start_time = time.time()
        
        for i in range(iterations):
            span = self.tracer.start_agent_span(
                "perf.test",
                f"agent_{i}",
                AgentTypes.AUTONOMOUS
            )
            span.end()
        
        elapsed = time.time() - start_time
        avg_time = (elapsed / iterations) * 1000  # ms per span
        
        print(f"\nSpan creation: {avg_time:.3f}ms per span ({iterations} spans in {elapsed:.2f}s)")
        
        # Assert reasonable performance (< 1ms per span)
        self.assertLess(avg_time, 1.0, "Span creation should be < 1ms")
    
    def test_attribute_recording_performance(self):
        """Test performance of attribute recording."""
        iterations = 1000
        start_time = time.time()
        
        for i in range(iterations):
            with self.tracer.agent_span("perf.attributes", f"agent_{i}") as span:
                self.tracer.record_policy_evaluation(
                    span, "policy", "1.0", "allowed", 10.0
                )
                
                decision = DecisionMetrics(
                    allowed=True,
                    requires_human_review=False,
                    confidence=0.9,
                    risk_score=0.1,
                    outcome="approved"
                )
                self.tracer.record_decision(span, decision)
                
                latency = LatencyMetrics(
                    total_ms=50.0,
                    confidence_gate_ms=10.0,
                    policy_eval_ms=20.0,
                    risk_eval_ms=20.0
                )
                self.tracer.record_latency(span, latency)
        
        elapsed = time.time() - start_time
        avg_time = (elapsed / iterations) * 1000
        
        print(f"Full span with attributes: {avg_time:.3f}ms per span")
        
        # Assert reasonable performance (< 2ms per span with all attributes)
        self.assertLess(avg_time, 2.0, "Full span recording should be < 2ms")


def run_tests():
    """Run all observability tests."""
    print("=" * 70)
    print("Lelu Python SDK - Observability Test Suite")
    print("=" * 70)
    print()
    
    if not OBSERVABILITY_AVAILABLE:
        print("ERROR: Observability module not available!")
        print("Please ensure auth_pe.observability is properly installed.")
        return 1
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add test classes
    suite.addTests(loader.loadTestsFromTestCase(TestAgentTracer))
    suite.addTests(loader.loadTestsFromTestCase(TestObservabilityIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestObservabilityPerformance))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print()
    print("=" * 70)
    print("Test Summary")
    print("=" * 70)
    print(f"Tests run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print()
    
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    exit(run_tests())
