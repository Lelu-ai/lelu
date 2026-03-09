[![Lelu logo](https://ui-seven-amber.vercel.app/logo.svg)](https://ui-seven-amber.vercel.app/)

# Lelu

The TypeScript SDK for Lelu — the confidence-aware authorization engine for autonomous AI agents.

Lelu provides confidence-aware access control, human-in-the-loop approvals, and SOC 2-ready audit trails for your autonomous agents.

## Installation

```bash
npm install @lelu-auth/lelu
```

## Start Dashboard (Localhost)

After installing the package, start the local dashboard stack with one command:

```bash
npx @lelu-auth/lelu dashboard
```

Then open:

```text
http://localhost:3002/audit
```

This command clones/updates the Lelu stack in `~/.lelu-stack` and runs `docker compose up -d --build`.

Or run the public Lelu engine image:

```bash
docker pull abenezer0923/lelu-engine:latest
docker run --rm -p 8083:8080 abenezer0923/lelu-engine:latest
```

## Docker Support

Lelu works in Dockerized apps.

The SDK resolves engine URL in this order:

1. `baseUrl` passed to `createClient(...)`
2. `LELU_BASE_URL` environment variable
3. `http://localhost:8080` fallback

Example for containers:

```bash
LELU_BASE_URL=http://host.docker.internal:8083
```

## Quick Start

```typescript
import { createClient } from "@lelu-auth/lelu";

// Initialize the client
const lelu = createClient({ 
  baseUrl: "http://localhost:8083" 
});

// Authorize an agent action
async function runAgent() {
  const { allowed, reason } = await lelu.agentAuthorize({
    agentId: "agent-123",
    action: "read_database",
    resource: "users_table",
    context: {
      confidence: 0.95
    }
  });

  if (allowed) {
    console.log("Action permitted!");
  } else {
    console.log("Action denied:", reason);
  }
}
```

## Features

- **Confidence-Aware**: Dynamically adjust permissions based on the AI agent's confidence level.
- **Human-in-the-loop**: Require human approval for low-confidence or high-risk actions.
- **Audit Trails**: SOC 2-ready logging of all agent decisions and actions.
- **Framework Agnostic**: Works with LangChain, AutoGPT, or custom agent frameworks.

## Documentation

For full documentation, visit [https://ui-seven-amber.vercel.app/](https://ui-seven-amber.vercel.app/).

## License

MIT
