"""
Lelu Python SDK.

Quick start::

    import asyncio
    from lelu import LeluClient, AuthorizeRequest

    async def main():
        async with LeluClient(api_key="lelu_sk_...") as lelu:
            result = await lelu.authorize(AuthorizeRequest(tool="delete_file"))
            if result.decision == "deny":
                print(f"Blocked: {result.reason}")

    asyncio.run(main())
"""

from .client import LeluClient, LELU_CLOUD_URL
from .autogpt_plugin import LeluAutoGPTPlugin
from .middleware import AgentMiddleware
from .storage import LocalStorage
from .models import (
    # Primary request type
    AuthorizeRequest,
    # Legacy request types (backward compat)
    AuthRequest,
    AgentAuthRequest,
    AgentContext,
    MintTokenRequest,
    DelegateScopeRequest,
    # Decision types
    AuthDecision,
    AgentAuthDecision,
    MintTokenResult,
    DelegateScopeResult,
    RevokeTokenResult,
    # Policy types
    Policy,
    PolicyRule,
    ListPoliciesRequest,
    ListPoliciesResult,
    GetPolicyRequest,
    UpsertPolicyRequest,
    DeletePolicyRequest,
    DeletePolicyResult,
    # Audit types
    AuditEvent,
    ListAuditEventsRequest,
    ListAuditEventsResult,
    # Error
    AuthEngineError,
)

# Enhanced Observability
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
    pass

__all__ = [
    "LeluClient",
    "LELU_CLOUD_URL",
    "LeluAutoGPTPlugin",
    "AgentMiddleware",
    "LocalStorage",
    # Primary request
    "AuthorizeRequest",
    # Legacy requests
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
    # Policies
    "Policy",
    "PolicyRule",
    "ListPoliciesRequest",
    "ListPoliciesResult",
    "GetPolicyRequest",
    "UpsertPolicyRequest",
    "DeletePolicyRequest",
    "DeletePolicyResult",
    # Audit
    "AuditEvent",
    "ListAuditEventsRequest",
    "ListAuditEventsResult",
    # Error
    "AuthEngineError",
    # Observability
    "AgentTracer",
    "agent_tracer",
    "get_agent_tracer",
    "AIAgentAttributes",
    "AgentTypes",
    "DecisionTypes",
    "DecisionMetrics",
    "LatencyMetrics",
    # CrewAI
    "LeluTool",
    "CrewAIPermissionDeniedError",
]

__version__ = "0.3.61"
