# Lelu — authorization for Strands agents

Lelu is an open-source authorization engine that sits between an agent and the
actions it takes. Every tool call is checked against policy before it runs, and
every decision — allowed or not — is written to a signed, tamper-evident audit
log.

It answers a different question from an input filter. Filtering inspects what
goes *into* the agent; Lelu governs what the agent is permitted to *do* once
it has been given a task, on the assumption that any filter will eventually be
bypassed.

- Repository: https://github.com/Lelu-ai/lelu
- Python: `pip install lelu-agent-auth-sdk`
- TypeScript: `npm install lelu-agent-auth`

## How it maps onto Strands

Lelu returns one of four decisions for any tool call, and `BeforeToolCallEvent`
expresses all four:

| Lelu decision | Strands action |
|---|---|
| `allow` | the tool runs as the model intended |
| `deny` | the call is cancelled, with the policy's reason attached |
| `compute` | the call is re-pointed at a safer tool the policy names |
| `human_review` | the call is paused for a person to decide |

## Quick start

Run the engine locally — no account or configuration needed:

```bash
npx -y lelu-mcp start
```

### Python

```python
from strands import Agent
from lelu import LeluClient
from lelu.strands import LeluHook

guard = LeluHook(
    LeluClient(base_url="http://localhost:8080"),
    actor="invoice_bot",
)

agent = Agent(tools=[refund, lookup_invoice], hooks=[guard])
```

### TypeScript

```typescript
import { Agent } from "@strands-agents/sdk";
import { LeluClient } from "lelu-agent-auth";
import { leluGuard } from "lelu-agent-auth/strands";

const agent = new Agent({
  tools: [refund, lookupInvoice],
  plugins: [leluGuard({ client, actor: "invoice_bot" })],
});
```

Policy lives in `~/.lelu/policy.yaml`. By default destructive actions are
denied, payments and outbound email go to human review, production writes are
redirected to a sandbox, and everything else is default-denied.

## Mapping tool names to permissions

By default the tool name is the permission checked. Pass `action_for` /
`actionFor` if your policy uses a different vocabulary:

```python
LeluHook(client, actor="invoice_bot", action_for=lambda call: f"tool:{call.name}")
```

## Confidence

If you have a real confidence signal from your model provider, pass it:

```python
LeluHook(client, actor="invoice_bot", confidence_for=lambda call: current_confidence())
```

Omit it and the engine applies its configured `MissingSignalMode` rather than
assuming a value. Lelu deliberately does not treat a caller-supplied number as
verified — a self-reported score is a claim, not evidence.

## Failure behaviour

If the engine is unreachable the call is **cancelled**, not allowed. An
authorization engine that permits everything when it breaks is not an
authorization engine. `fail_open=True` / `failOpen: true` overrides this; use it
only deliberately.

## Human review

`human_review` needs a person, which a synchronous hook cannot wait for without
blocking the agent. The call is cancelled and the review id surfaced so you can
resume when a human has acted.

Once a human has acted, redeem the approval:

```python
outcome = guard.evaluate(call)
if outcome.action == "review":
    result = guard.redeem(outcome, timeout_ms=60_000)
```

```typescript
const outcome = await guard.evaluate(call);
if (outcome.action === "review") {
  const result = await guard.redeem(outcome, { timeoutMs: 60_000 });
}
```

Redemption re-checks the payload against what the reviewer actually approved,
so an approval cannot be spent on a call they never saw. It is single-use, and
`allowed` is false for every failure — timed out, denied, or payload no longer
matching — so there is one thing to check rather than three.

## Requirements

- Lelu engine 0.2.0 or later for the human-review redemption endpoint
- Python 3.10+ or Node 18+

## Support

Lelu is community-maintained and not supported by the Strands team. Issues and
questions: https://github.com/Lelu-ai/lelu/issues
