# Lelu · Python SDK

Python client for [Lelu](https://github.com/lelu-ai/lelu) — the confidence-aware authorization engine for autonomous AI agents.

**Author:** Abenezer Getachew  
**Maintainer:** [Abenezer Getachew](https://github.com/Abenezer0923)

## Installation

```bash
pip install lelu-agent-auth-sdk
```

Requires Python 3.11+.

Which engine and SDK versions go together: [docs/COMPATIBILITY.md](../../docs/COMPATIBILITY.md).

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

## Mounting the approval handler (optional)

`auth.handler` is an ASGI app that exposes the engine's authorize and review
queue to your own frontend. It acts with your engine credentials, so it only
serves a caller your app has authenticated: **without `authenticate=` it answers
403 for everything except `GET /ok`.**

```python
import os
from lelu import HandlerCaller, lelu

async def authenticate(scope):
    user = scope.get("user")                      # your session / JWT check
    if user is None:
        return None                               # -> 401
    return HandlerCaller(reviewer=user.name if user.is_reviewer else None)

auth = lelu(
    authenticate=authenticate,
    reviewer_key=os.environ["LELU_REVIEWER_KEY"],  # one of the engine's LELU_REVIEWER_KEYS
)
app.mount("/api/lelu", auth.handler)               # FastAPI / Starlette
```

- Any authenticated caller may `POST /authorize`.
- Only a caller with a `reviewer` name may list the queue, approve or deny. That
  name is recorded as the resolver; a `resolved_by` in the request body is ignored.
- When the engine sets `LELU_REVIEWER_KEYS`, approvals need `reviewer_key`. To
  approve or deny from your own code, pass it directly:
  `await client.approve_review(review_id, "alice", reviewer_key=...)`.

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
