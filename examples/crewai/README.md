# Secure CrewAI agents with Lelu

[CrewAI](https://github.com/crewAIInc/crewAI) agents take real actions through
**Tools** — issue refunds, send emails, run code. The problem: a CrewAI agent
that's been prompt-injected or is simply unsure will still call those tools with
total conviction.

`LeluTool` is a drop-in CrewAI `BaseTool` that **gates every call through Lelu
before it runs** — confidence check, prompt-injection filter, policy, risk. A
confident, permitted call executes; a low-confidence or manipulated one is
blocked (or held for a human), and the agent receives a refusal string it can
self-correct on. The action never fires.

## Usage

```python
from lelu import LeluClient
from lelu.crewai import LeluTool

class RefundTool(LeluTool):
    name: str = "process_refund"
    description: str = "Issue a customer refund."
    actor: str = "invoice_bot"        # matches an agent_scope in your policy
    action: str = "approve_refunds"
    confidence: float = 0.95          # set from your model's verified score

    def _execute(self, invoice_id: str) -> str:
        return f"Refund issued for invoice {invoice_id}."   # only runs if Lelu allows

agent = Agent(role="Finance Assistant", tools=[RefundTool(lelu_client=LeluClient())], ...)
```

You subclass `LeluTool` and implement **`_execute()`** instead of `_run()`.
CrewAI calls `_run()`, which Lelu intercepts.

## What the agent gets back

The gating logic is covered by [`tests/test_crewai.py`](../../sdk/python/tests/test_crewai.py):

| Lelu decision | `LeluTool` returns | Effect on the crew |
|---|---|---|
| **allow** | the real `_execute()` result | the refund is issued |
| **deny** | `"[Lelu] Action '…' was denied … Reason: …"` | tool never runs; the LLM sees the reason and self-corrects |
| **human_review** | `"[Lelu] Action '…' is queued for human review …"` | the agent pauses for approval |
| (set `throw_on_deny=True`) | raises `PermissionDeniedError` | hard stop |

So a refund at `confidence=0.95` goes through; the same refund at `confidence=0.30`
comes back denied (`"confidence 30% is below hard-deny threshold"`), and the agent
adapts instead of moving the money.

## Run it

```bash
pip install crewai lelu-agent-auth-sdk
# start a Lelu engine on :8088 (see ../quickstart) and set an LLM key:
export OPENAI_API_KEY=...
python secure_refund_agent.py
```

To watch it block, lower `confidence` below your policy threshold (or hide an
instruction like *"ignore previous instructions"* in the task input — Lelu's
injection filter catches it before the tool runs).

## Policy

The `actor` / `action` map to your Lelu policy (see
[../quickstart/policy.yaml](../quickstart/policy.yaml)): `invoice_bot` may
`approve_refunds` above 0.90 confidence, is held for review at 0.70–0.89, and
hard-denied below 0.50. Tune the thresholds there.
