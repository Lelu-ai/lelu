<!--
community.crewai.com — guideline-compliant posts.
Follows: https://community.crewai.com/t/.../5738
  - code in ``` blocks, never screenshots
  - include repo link + install
  - be specific, engage with replies, don't tag mods, don't ask people to build for you
POST B (reply to the existing governance thread) first; then POST A (Showcase).
-->

# POST B — reply to the existing thread (do this first)
# Thread: "How are people handling execution auditability and governance in production CrewAI deployments?"

Good question — this is exactly what bit us in production. Two things worked for us:

**1. Authorize at the tool boundary, not in the prompt.** Prompt-level rules
("only do X if confident") don't hold up, because a prompt-injected agent will
report whatever it's told to. We gate inside the tool's `_run`, before any side
effect, and treat the model's confidence as a *verified* signal (from token
logprobs) rather than something the agent self-reports.

**2. Make every decision auditable.** Each tool call gets logged with the action,
the decision (allow / deny / human-review), the reason, and hashes of the
input/output so you can prove later what was asked and decided.

Concretely, we wrap tools in a `BaseTool` subclass that checks confidence + a
prompt-injection filter + a policy first:

```python
from lelu.crewai import LeluTool

class RefundTool(LeluTool):
    name: str = "process_refund"
    description: str = "Issue a customer refund."
    actor: str = "invoice_bot"
    action: str = "approve_refunds"
    confidence: float = 0.95   # verified score, not self-reported

    def _execute(self, invoice_id: str) -> str:   # only runs if allowed
        return f"Refund issued for {invoice_id}."
```

On a low-confidence or injected call it returns a refusal string the agent
self-corrects on, and logs the decision — instead of firing the tool.

This is from an open-source project I work on (Lelu, MIT). Happy to share the
repo if useful. Curious how others here handle the **auditability** half — are you
logging decisions at the tool level, the task level, or via callbacks?

---

# POST A — Showcase (New Topic → category: Showcase)
# Title: Gating CrewAI tool calls on confidence + policy before they run (open source)

A CrewAI agent will call a tool with full conviction even when it's been
prompt-injected or is simply unsure. For tools with real side effects — refunds,
emails, deploys — that's the dangerous part: the agent never doubts itself.

I've been working on an open-source way (MIT) to put a check *between* the agent
deciding to call a tool and the tool running. It's a `BaseTool` subclass you
subclass, implementing `_execute()` instead of `_run()`:

```python
from lelu import LeluClient
from lelu.crewai import LeluTool

class RefundTool(LeluTool):
    name: str = "process_refund"
    description: str = "Issue a customer refund."
    actor: str = "invoice_bot"        # an agent scope in your policy
    action: str = "approve_refunds"   # the permission to authorize
    confidence: float = 0.95          # the model's verified confidence

    def _execute(self, invoice_id: str) -> str:
        return f"Refund issued for invoice {invoice_id}."

tool = RefundTool(lelu_client=LeluClient(base_url="http://localhost:8088"))
```

On each call it checks confidence (from logprobs, not self-reported), runs a
prompt-injection filter, and applies a policy, returning one of:

| Decision | What the tool returns |
| --- | --- |
| allow | the `_execute()` result |
| deny | a refusal string the LLM self-corrects on (tool never runs) |
| human review | a "queued for approval" message |

So the same refund at `confidence=0.95` goes through, but at `0.30` it comes back
*"denied: confidence below threshold"* and the agent adapts instead of moving money.

Install:

```bash
pip install crewai lelu-agent-auth-sdk
```

Repo + a runnable agent example: https://github.com/lelu-auth/lelu  (example:
`examples/crewai`).

Two genuine questions for folks running CrewAI with side-effectful tools:
1. How do you decide *when* an agent is sure enough to take an irreversible action?
2. Would a `BaseTool`-level guard like this be useful, or do you handle this at the
   task/process level instead?
