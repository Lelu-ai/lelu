"""
Lelu Python SDK.

Quick start::

    from lelu import LeluClient, AgentAuthRequest, AgentContext

    async with LeluClient(base_url="http://localhost:8080") as lelu:
        decision = await lelu.agent_authorize(
            AgentAuthRequest(
                actor="invoice_bot",
                action="approve_refunds",
                context=AgentContext(confidence=0.92, acting_for="user_123"),
            )
        )
        if not decision.allowed:
            print(decision.reason)
"""

from .client import LeluClient
from .autogpt_plugin import LeluAutoGPTPlugin
from .middleware import AgentMiddleware
from .storage import LocalStorage
from .models import (
    AgentAuthDecision,
    AgentAuthRequest,
    AgentContext,
    AuthDecision,
    AuthEngineError,
    AuthRequest,
    DelegateScopeRequest,
    DelegateScopeResult,
    MintTokenRequest,
    MintTokenResult,
    RevokeTokenResult,
)

# Enhanced Observability (Phase 1)
from .observability import (
    AgentTracer,
    agent_tracer,
    get_agent_tracer,
    AIAgentAttributes,
    AgentTypes,
    DecisionTypes,
    DecisionMetrics,
    LatencyMetrics,
)

# CrewAI integration — requires `pip install crewai`
try:
    from .crewai import LeluTool, PermissionDeniedError as CrewAIPermissionDeniedError  # noqa: F401
except ImportError:
    pass  # crewai not installed; LeluTool not available

__all__ = [
    "LeluClient",
    "LeluAutoGPTPlugin",
    "AgentMiddleware",
    "LocalStorage",
    # CrewAI
    "LeluTool",
    "CrewAIPermissionDeniedError",
    # Requests
    "AuthRequest",
    "AgentAuthRequest",
    "AgentContext",
    "MintTokenRequest",
    "DelegateScopeRequest",
    # Decisions
    "AuthDecision",
    "AgentAuthDecision",
    "MintTokenResult",
    "DelegateScopeResult",
    "RevokeTokenResult",
    # Errors
    "AuthEngineError",
    # Enhanced Observability
    "AgentTracer",
    "agent_tracer",
    "get_agent_tracer",
    "AIAgentAttributes",
    "AgentTypes",
    "DecisionTypes",
    "DecisionMetrics",
    "LatencyMetrics",
]

__version__ = "0.1.0"
