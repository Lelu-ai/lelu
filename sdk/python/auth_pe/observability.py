"""
Enhanced observability for AI agents - Phase 1 implementation.
Provides OpenTelemetry-based tracing with AI agent semantic conventions.
"""

import time
from typing import Dict, List, Optional, Any, Union, Tuple
from contextlib import contextmanager

try:
    from opentelemetry import trace as otel_trace
    from opentelemetry.trace import Status as OtelStatus, StatusCode as OtelStatusCode
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False
    # Provide stub classes for when OpenTelemetry is not available
    class OtelTrace:
        @staticmethod
        def get_tracer(name: str, version: Optional[str] = None) -> 'NoOpTracer':
            return NoOpTracer()
    
    class _StubStatus:
        pass
    
    class _StubStatusCode:
        OK = "OK"
        ERROR = "ERROR"
    
    otel_trace = OtelTrace()
    OtelStatus = _StubStatus
    OtelStatusCode = _StubStatusCode


class NoOpSpan:
    """No-op span implementation when OpenTelemetry is not available."""
    
    def set_attributes(self, attributes: Dict[str, Any]) -> None:
        pass
    
    def set_status(self, status: Union[OtelStatus, OtelStatusCode], description: Optional[str] = None) -> None:
        pass
    
    def record_exception(self, exception: Exception) -> None:
        pass
    
    def end(self) -> None:
        pass
    
    def __enter__(self) -> 'NoOpSpan':
        return self
    
    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        pass


class NoOpTracer:
    """No-op tracer implementation when OpenTelemetry is not available."""
    
    def start_span(self, name: str, **kwargs: Any) -> NoOpSpan:
        return NoOpSpan()


# AI Agent Semantic Conventions (matching Go and TypeScript implementations)
class AIAgentAttributes:
    """AI Agent semantic conventions for OpenTelemetry."""
    
    # Agent identification
    AGENT_ID = "ai.agent.id"
    AGENT_TYPE = "ai.agent.type"
    AGENT_VERSION = "ai.agent.version"
    
    # Request attributes
    REQUEST_INTENT = "ai.request.intent"
    REQUEST_CONFIDENCE = "ai.request.confidence"
    REQUEST_ACTING_FOR = "ai.request.acting_for"
    REQUEST_SCOPE = "ai.request.scope"
    
    # Policy evaluation
    POLICY_NAME = "ai.policy.name"
    POLICY_VERSION = "ai.policy.version"
    POLICY_RESULT = "ai.policy.result"
    
    # Decision attributes
    DECISION_TYPE = "ai.decision.type"
    DECISION_CONFIDENCE = "ai.decision.confidence"
    DECISION_HUMAN_REVIEW = "ai.decision.human_review"
    DECISION_RISK_SCORE = "ai.decision.risk_score"
    DECISION_OUTCOME = "ai.decision.outcome"
    
    # Multi-agent correlation
    SWARM_ID = "ai.swarm.id"
    DELEGATION_CHAIN = "ai.delegation.chain"
    PARENT_AGENT = "ai.parent.agent"
    CHILD_AGENT = "ai.child.agent"
    
    # Performance metrics
    LATENCY_MS = "ai.latency.ms"
    CONFIDENCE_GATE_MS = "ai.latency.confidence_gate_ms"
    POLICY_EVAL_MS = "ai.latency.policy_eval_ms"
    RISK_EVAL_MS = "ai.latency.risk_eval_ms"


class AgentTypes:
    """Agent type constants."""
    AUTONOMOUS = "autonomous"
    ASSISTED = "assisted"
    HUMAN = "human"


class DecisionTypes:
    """Decision type constants."""
    AUTONOMOUS = "autonomous"
    HUMAN_REVIEW = "human_review"
    DENIED = "denied"


class DecisionMetrics:
    """Decision metrics for recording in spans."""
    
    def __init__(
        self,
        allowed: bool,
        requires_human_review: bool,
        confidence: float,
        risk_score: float,
        outcome: str
    ):
        self.allowed = allowed
        self.requires_human_review = requires_human_review
        self.confidence = confidence
        self.risk_score = risk_score
        self.outcome = outcome


class LatencyMetrics:
    """Latency metrics for recording in spans."""
    
    def __init__(
        self,
        total_ms: float,
        confidence_gate_ms: Optional[float] = None,
        policy_eval_ms: Optional[float] = None,
        risk_eval_ms: Optional[float] = None
    ):
        self.total_ms = total_ms
        self.confidence_gate_ms = confidence_gate_ms
        self.policy_eval_ms = policy_eval_ms
        self.risk_eval_ms = risk_eval_ms


class AgentTracer:
    """AI agent-aware tracer for enhanced observability."""
    
    def __init__(self, service_name: str = "lelu-python-sdk", service_version: str = "0.2.0") -> None:
        if OTEL_AVAILABLE:
            self.tracer = otel_trace.get_tracer(service_name, service_version)
        else:
            self.tracer = NoOpTracer()
    
    def start_agent_span(
        self,
        operation_name: str,
        agent_id: str,
        agent_type: str = AgentTypes.AUTONOMOUS,
        **attributes: Any
    ) -> Any:
        """Start a new span with AI agent semantic conventions."""
        span_attributes = {
            AIAgentAttributes.AGENT_ID: agent_id,
            AIAgentAttributes.AGENT_TYPE: agent_type,
            **attributes
        }
        
        span = self.tracer.start_span(operation_name)
        if hasattr(span, 'set_attributes'):
            span.set_attributes(span_attributes)
        
        return span
    
    def start_authorization_span(
        self,
        agent_id: str,
        action: str,
        confidence: float
    ) -> Any:
        """Start an authorization span."""
        return self.start_agent_span(
            "ai.agent.authorize",
            agent_id,
            AgentTypes.AUTONOMOUS,
            **{
                AIAgentAttributes.REQUEST_INTENT: action,
                AIAgentAttributes.REQUEST_CONFIDENCE: confidence,
                AIAgentAttributes.DECISION_TYPE: DecisionTypes.AUTONOMOUS,
            }
        )
    
    def start_delegation_span(
        self,
        delegator: str,
        delegatee: str
    ) -> Any:
        """Start a delegation span."""
        return self.start_agent_span(
            "ai.agent.delegate",
            delegator,
            AgentTypes.AUTONOMOUS,
            **{
                AIAgentAttributes.PARENT_AGENT: delegator,
                AIAgentAttributes.CHILD_AGENT: delegatee,
                AIAgentAttributes.DELEGATION_CHAIN: f"{delegator}→{delegatee}",
            }
        )
    
    def start_swarm_span(
        self,
        swarm_id: str,
        orchestrator: str,
        agents: List[str]
    ) -> Any:
        """Start a swarm orchestration span."""
        return self.start_agent_span(
            "ai.swarm.orchestration",
            orchestrator,
            agent_type="orchestrator",
            **{
                AIAgentAttributes.SWARM_ID: swarm_id,
                "ai.swarm.orchestrator": orchestrator,
                "ai.swarm.agents": agents,
                "ai.swarm.agent_count": len(agents),
            }
        )
    
    def record_policy_evaluation(
        self,
        span: Any,
        policy_name: str,
        policy_version: str,
        result: str,
        latency_ms: float
    ) -> None:
        """Record policy evaluation details in the span."""
        if not span or not hasattr(span, 'set_attributes'):
            return
        
        span.set_attributes({
            AIAgentAttributes.POLICY_NAME: policy_name,
            AIAgentAttributes.POLICY_VERSION: policy_version,
            AIAgentAttributes.POLICY_RESULT: result,
            AIAgentAttributes.POLICY_EVAL_MS: latency_ms,
        })
    
    def record_decision(
        self,
        span: Any,
        metrics: DecisionMetrics
    ) -> None:
        """Record the final authorization decision."""
        if not span or not hasattr(span, 'set_attributes'):
            return
        
        decision_type = DecisionTypes.AUTONOMOUS
        if metrics.requires_human_review:
            decision_type = DecisionTypes.HUMAN_REVIEW
        elif not metrics.allowed:
            decision_type = DecisionTypes.DENIED
        
        span.set_attributes({
            AIAgentAttributes.DECISION_TYPE: decision_type,
            AIAgentAttributes.DECISION_CONFIDENCE: metrics.confidence,
            AIAgentAttributes.DECISION_HUMAN_REVIEW: metrics.requires_human_review,
            AIAgentAttributes.DECISION_RISK_SCORE: metrics.risk_score,
            AIAgentAttributes.DECISION_OUTCOME: metrics.outcome,
        })
        
        # Set span status based on decision
        if hasattr(span, 'set_status'):
            if not metrics.allowed and not metrics.requires_human_review:
                span.set_status(OtelStatusCode.ERROR, "Authorization denied")
            else:
                span.set_status(OtelStatusCode.OK)
    
    def record_latency(
        self,
        span: Any,
        metrics: LatencyMetrics
    ) -> None:
        """Record operation latency."""
        if not span or not hasattr(span, 'set_attributes'):
            return
        
        attributes = {AIAgentAttributes.LATENCY_MS: metrics.total_ms}
        
        if metrics.confidence_gate_ms is not None:
            attributes[AIAgentAttributes.CONFIDENCE_GATE_MS] = metrics.confidence_gate_ms
        if metrics.policy_eval_ms is not None:
            attributes[AIAgentAttributes.POLICY_EVAL_MS] = metrics.policy_eval_ms
        if metrics.risk_eval_ms is not None:
            attributes[AIAgentAttributes.RISK_EVAL_MS] = metrics.risk_eval_ms
        
        span.set_attributes(attributes)
    
    def inject_correlation_context(
        self,
        span: Any,
        delegation_chain: str
    ) -> None:
        """Inject correlation context for multi-agent tracing."""
        if not span or not hasattr(span, 'set_attributes'):
            return
        
        span.set_attributes({
            AIAgentAttributes.DELEGATION_CHAIN: delegation_chain,
        })
    
    @contextmanager
    def agent_span(
        self,
        operation_name: str,
        agent_id: str,
        agent_type: str = AgentTypes.AUTONOMOUS,
        **attributes: Any
    ) -> Any:
        """Context manager for agent spans."""
        span = self.start_agent_span(operation_name, agent_id, agent_type, **attributes)
        
        try:
            yield span
            if hasattr(span, 'set_status'):
                span.set_status(OtelStatusCode.OK)
        except Exception as e:
            if hasattr(span, 'record_exception'):
                span.record_exception(e)
            if hasattr(span, 'set_status'):
                span.set_status(OtelStatusCode.ERROR, str(e))
            raise
        finally:
            if hasattr(span, 'end'):
                span.end()


# Default instance
agent_tracer = AgentTracer()


def get_agent_tracer(service_name: str = "lelu-python-sdk") -> AgentTracer:
    """Get an agent tracer instance."""
    return AgentTracer(service_name)