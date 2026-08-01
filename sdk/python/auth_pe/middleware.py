from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from .client import LeluClient
from .models import AgentAuthRequest, AgentContext

class AgentMiddleware(ABC):
    """
    Base class for building integrations with AI agent frameworks (e.g., LlamaIndex, CrewAI).
    Developers should subclass this to intercept tool calls and extract confidence scores.
    """

    def __init__(self, client: LeluClient, agent_id: str, acting_for: Optional[str] = None):
        self.client = client
        self.agent_id = agent_id
        self.acting_for = acting_for

    @abstractmethod
    def extract_confidence_score(self, llm_response: Any) -> float:
        """
        Extract the confidence score from the LLM's response.
        This could be based on logprobs, explicit output, or a default value.
        """
        pass

    @abstractmethod
    def intercept_tool_call(self, tool: Any, context: Dict[str, Any]) -> Any:
        """
        Intercept a tool call before it executes.
        Should call `self.authorize_action` and raise an exception or return a denial message if unauthorized.
        """
        pass

    async def authorize_action(self, action: str, resource: Dict[str, str], confidence: float) -> bool:
        """
        Helper method to authorize an action using the LeluClient.
        """
        request = AgentAuthRequest(
            actor=self.agent_id,
            action=action,
            resource=resource,
            context=AgentContext(
                confidence=confidence,
                acting_for=self.acting_for
            )
        )
        decision = await self.client.agent_authorize(request)

        # `allowed` is also true for a scope downgrade or a compute redirect —
        # neither means the caller should proceed as requested. Subclasses
        # only see a bool here, so both must resolve to False, same as a deny.
        if not decision.allowed or decision.downgraded_scope or decision.computed:
            # In a real implementation, you might want to return the reason to the LLM
            # so it can self-correct, rather than just returning False.
            return False

        return True
