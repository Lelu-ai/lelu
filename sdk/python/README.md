# Lelu · Python SDK

Python client for [Lelu](https://github.com/lelu-ai/lelu) — the confidence-aware authorization engine for autonomous AI agents.

**Author:** Abenezer Getachew  
**Maintainer:** [Abenezer Getachew](https://github.com/Abenezer0923)

## Installation

```bash
pip install lelu-agent-auth-sdk
```

Requires Python 3.11+.

## Quick start

### Option 1: Zero-config local (recommended)

Run the local engine once — it self-generates its key and policy in `~/.lelu`,
no account needed:

```bash
npx -y lelu-mcp start
```

Then create one shared instance and import it everywhere. With no arguments,
`lelu()` discovers that engine automatically:

```python
import asyncio
from lelu import lelu

auth = lelu(actor="invoice_bot")   # zero-config: finds the local engine

async def main():
    result = await auth.authorize(tool="invoice:create")
    if result.decision == "allow":
        ...  # proceed
    elif result.decision == "human_review":
        # Queued for a human. Don't just wait for "approved" and then act —
        # an approval is bound to the request it approved, so pass the same
        # request back and let the engine confirm nothing changed.
        outcome = await auth.wait_and_redeem(result, tool="invoice:create")
        if not outcome.allowed:
            raise PermissionError(outcome.reason)
        ...  # proceed
    else:
        raise PermissionError(result.reason)

asyncio.run(main())
```

The instance exposes the full client as `auth.api` (tokens, review queue,
audit, policies): `await auth.api.mint_token(...)`.

### Option 2: Self-hosted or cloud engine

Point the same factory at any engine with explicit config — or set
`LELU_BASE_URL` / `LELU_API_KEY` and keep calling `lelu()` with no arguments:

```python
auth = lelu(
    base_url="https://your-engine.example.com",
    api_key=os.environ["LELU_API_KEY"],
    actor="invoice_bot",
)
```

`LeluClient(...)` from earlier versions keeps working unchanged — `auth.api`
is that same client.

## Confidence signals

Engines in their default configuration reject bare self-reported `confidence`
numbers (`CONFIDENCE_ALLOW_UNVERIFIED=false`). Build a `ConfidenceSignal` from
your LLM provider's response with `LeluClient.signal_from` (`.openai`,
`.bedrock`, `.local`; `.anthropic` always returns `None`) so the engine extracts
the score from the token/entropy data directly:

```python
from lelu import AgentContext, LeluClient, lelu

auth = lelu(actor="invoice_bot")

resp = await openai_client.chat.completions.create(
    model="gpt-4o-mini",
    messages=messages,
    logprobs=True,
)
signal = LeluClient.signal_from.openai(resp)  # None if logprobs are absent

result = await auth.authorize(
    tool="refund:process",
    context=AgentContext(confidence_signal=signal) if signal else None,
)
```

When `signal` is `None` (for example, Anthropic models that expose no token
log-probs), omit `confidence_signal` so the engine's `MissingSignalMode`
decides rather than inventing a default score.

## API

| Method | Description |
|---|---|
| `authorize(req)` | Confidence-aware agent authorization (`allow` / `deny` / `human_review` / `compute`) |
| `agent_authorize(req)` | Deprecated — backward-compatible wrapper around `authorize()` |
| `wait_and_redeem(review, req)` | After `human_review`: wait for the reviewer, then redeem the approval against the same request (pass the decision or its `review_id`, not `request_id`) |
| `mint_token(req)` | Mint a JIT-scoped JWT |
| `revoke_token(token_id)` | Revoke a token immediately |
| `is_healthy()` | Health-check the engine |

## License

MIT
