# Lelu · Python SDK

Python client for [Lelu](https://github.com/lelu-ai/lelu) — the confidence-aware authorization engine for autonomous AI agents.

**Author:** Abenezer Getachew  
**Maintainer:** [Abenezer Getachew](https://github.com/Abenezer0923)

## Installation

```bash
pip install lelu-agent-auth-sdk
```

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
        ...  # queued — agent pauses, awaiting approval
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

## API

| Method | Description |
|---|---|
| `agent_authorize(req)` | Confidence-aware agent authorization |
| `authorize(req)` | Human RBAC authorization |
| `mint_token(req)` | Mint a JIT-scoped JWT |
| `revoke_token(token_id)` | Revoke a token immediately |
| `is_healthy()` | Health-check the engine |

## License

MIT
