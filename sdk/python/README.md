# Lelu · Python SDK

Python client for [Lelu](https://github.com/lelu-auth/lelu) — the confidence-aware authorization engine for autonomous AI agents.

**Author:** Abenezer Getachew  
**Maintainer:** [Abenezer Getachew](https://github.com/Abenezer0923)

## Installation

```bash
pip install lelu-agent-auth-sdk
```

Or run the public Lelu engine image:

```bash
docker pull abenezer0923/lelu-engine:latest
docker run --rm -p 8083:8080 abenezer0923/lelu-engine:latest
```

## Quick start

### Option 1: Use Hosted Engine (Recommended)

Connect to the hosted Lelu engine for instant setup:

```python
import asyncio
from lelu import LeluClient, AgentAuthRequest, AgentContext

async def main():
    async with LeluClient(base_url="https://lelu-engine.onrender.com") as client:
        result = await client.agent_authorize(AgentAuthRequest(
            actor="invoice_bot",
            action="invoice:create",
            context=AgentContext(
                confidence=0.92,
                acting_for="user_123",
            ),
        ))
        print(result.allowed, result.reason)

asyncio.run(main())
```

### Option 2: Run Locally

For development, you can run the engine locally:

```python
import asyncio
from lelu import LeluClient, AgentAuthRequest, AgentContext

async def main():
    async with LeluClient(base_url="http://localhost:8082") as client:
        result = await client.agent_authorize(AgentAuthRequest(
            actor="invoice_bot",
            action="invoice:create",
            context=AgentContext(
                confidence=0.92,
                acting_for="user_123",
            ),
        ))
        print(result.allowed, result.reason)

asyncio.run(main())
```

Start the local engine with Docker:

```bash
docker compose up -d
```

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
