"""
Secure CrewAI agent with Lelu — gate every tool call on confidence + policy.

A CrewAI agent will call its tools with full conviction even when it's been
prompt-injected or is simply unsure. `LeluTool` intercepts each call and runs it
through Lelu first: a confident, permitted call executes; a low-confidence or
manipulated one is blocked (or held for human review) and the agent gets a
refusal string it can self-correct on — the refund never goes out.

Requires:
    pip install crewai lelu-agent-auth-sdk
    a running Lelu engine on :8088   (see ../quickstart)
    an LLM key for CrewAI            (e.g. export OPENAI_API_KEY=...)

Run:
    python secure_refund_agent.py
"""

import os

from crewai import Agent, Crew, Task

from lelu import LeluClient
from lelu.crewai import LeluTool

lelu = LeluClient(
    base_url=os.environ.get("LELU_BASE_URL", "http://localhost:8088"),
    api_key=os.environ.get("LELU_API_KEY", "lelu-dev-key"),
)


class RefundTool(LeluTool):
    name: str = "process_refund"
    description: str = "Issue a customer refund for a given invoice ID."

    # Lelu gating config:
    actor: str = "invoice_bot"        # must match an agent_scope in your policy.yaml
    action: str = "approve_refunds"   # the permission Lelu authorizes
    confidence: float = 0.95          # set this from your model's *verified* score per call

    def _execute(self, invoice_id: str) -> str:
        # Real refund logic goes here — only reached when Lelu allows the action.
        return f"Refund issued for invoice {invoice_id}."


refund_tool = RefundTool(lelu_client=lelu)

finance_agent = Agent(
    role="Finance Assistant",
    goal="Process customer refunds accurately and safely.",
    backstory="A careful finance bot that never acts without authorization.",
    tools=[refund_tool],
    verbose=True,
)

task = Task(
    description="Process the refund for invoice INV-1001.",
    expected_output="Confirmation the refund was processed, or the reason it was blocked.",
    agent=finance_agent,
)

crew = Crew(agents=[finance_agent], tasks=[task], verbose=True)

if __name__ == "__main__":
    print(crew.kickoff())
