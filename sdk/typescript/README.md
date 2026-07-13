# lelu-agent-auth

The TypeScript SDK for [Lelu](https://lelu-ai.com) — the confidence-aware authorization engine for autonomous AI agents.

Lelu lets you gate every agent action against a policy, route low-confidence calls to a human reviewer, and keep an immutable audit trail — without running any infrastructure yourself.

## Install

```bash
npm install lelu-agent-auth
```

## Get an API key

Sign in at **[lelu-ai.com](https://lelu-ai.com)** and create a key at **[/api-key](https://lelu-ai.com/api-key)**. Keys belong to your account (`lelu_sk_…`), are shown once at creation, and can be revoked anytime.

You can also mint keys programmatically — authenticate with your session or an existing key:

```bash
curl -X POST https://lelu-ai.com/api/v1/keys \
  -H "Authorization: Bearer $LELU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "ci-agent", "expiresInDays": 90}'
```

## Quick start

Create one shared instance and import it everywhere:

```ts
// lib/lelu.ts
import { lelu } from "lelu-agent-auth";

export const auth = lelu({
  apiKey: process.env.LELU_API_KEY,   // key from lelu-ai.com/api-key
  actor: "billing-agent",             // optional default actor
});
```

```ts
// anywhere on the server
import { auth } from "./lib/lelu";

const decision = await auth.authorize({
  tool: "refund:process",
  args: { orderId: "ord_123" },
  context: { confidence: 0.85 },
});

if (decision.allowed) {
  // proceed
} else if (decision.decision === "human_review") {
  // agent pauses — action queued for human approval
} else {
  // blocked by policy
  console.error(decision.reason);
}
```

That's it. No Docker. No local server.

The instance gives you three things:

- **`auth.authorize(...)`** — authorize a tool call, with the default `actor` filled in.
- **`auth.api.*`** — the full engine API (`mintToken`, `listQueue`, `listAuditEvents`, policies, vault, …).
- **`auth.handler`** — a fetch-style `Request → Response` handler you can mount as an API route (see below).

> `createClient(...)` from earlier versions still works and returns the same client as `auth.api` — no breaking changes.

## Mount the handler (optional)

`auth.handler` exposes authorize / review-queue / health endpoints from **your** server, so browser code (like an approval UI) never sees the engine URL or your API key.

```ts
// app/api/lelu/[...all]/route.ts (Next.js App Router)
import { auth } from "@/lib/lelu";

export const GET = auth.handler;
export const POST = auth.handler;
```

```ts
// Express
import { toNodeHandler } from "lelu-agent-auth/express";
import { auth } from "./lib/lelu";

app.all("/api/lelu/*", toNodeHandler(auth));
```

Routes served under `basePath` (default `/api/lelu`, configurable via `lelu({ basePath })`):

| Route | Purpose |
|---|---|
| `POST /authorize` | Authorize a tool call |
| `GET /queue` | List pending human-review items |
| `POST /queue/:id/approve` | Approve a queued action |
| `POST /queue/:id/deny` | Deny a queued action |
| `GET /ok` | Engine health check |

## How URL resolution works

| Situation | Engine used |
|---|---|
| `baseUrl` passed to `lelu()` / `createClient` | That URL |
| `LELU_BASE_URL` env var set | That URL |
| Nothing configured, `npx lelu-mcp start` is running | Its local engine — discovered via `~/.lelu/engine.json`, authenticated with `~/.lelu/engine.key` automatically |
| Nothing configured, no local engine | `http://localhost:8080` (self-hosted dev) |

The third row is the zero-config path: run `npx -y lelu-mcp start` once and every `lelu()` / `createClient()` call on the machine finds that engine on its own — same policy file, same audit trail, no account and no keys to manage.

## Framework integrations

### Vercel AI SDK

```ts
import { secureTool } from "lelu-agent-auth/vercel";
import { tool } from "ai";
import { z } from "zod";
import { auth } from "./lib/lelu";

const processRefund = secureTool(auth.api, "billing-agent", {
  tool: tool({
    description: "Process a customer refund",
    parameters: z.object({ orderId: z.string(), amount: z.number() }),
    execute: async ({ orderId, amount }) => {
      // only runs when Lelu allows it
      return { success: true };
    },
  }),
  action: "refund:process",
  confidence: 0.9,
});
```

### Express middleware

```ts
import { authorize } from "lelu-agent-auth/express";
import { auth } from "./lib/lelu";

app.post(
  "/api/refund",
  authorize("refund:process", { client: auth, confidence: 0.9 }),
  (req, res) => res.json({ ok: true }),
);
```

### LangChain

```ts
import { secureTool } from "lelu-agent-auth/langchain";
import { auth } from "./lib/lelu";

const safeTool = secureTool(auth.api, "research-agent", myLangChainTool, {
  action: "web:search",
  confidence: 0.8,
});
```

## All methods

Everything below lives on `auth.api` (a `LeluClient`):

```ts
// Authorization
auth.authorize({ tool, actor?, args?, context? })   // instance-level, default actor applied
auth.api.agentAuthorize({ actor, action, resource?, context })

// Token management (scoped, time-limited JWTs)
auth.api.mintToken({ scope, actingFor?, ttlSeconds? })
auth.api.revokeToken(tokenId)

// Multi-agent delegation
auth.api.delegateScope({ delegator, delegatee, scopedTo?, ttlSeconds?, confidence? })

// Human review queue
auth.api.listQueue()
auth.api.approveQueueItem(id, resolvedBy, note?)
auth.api.denyQueueItem(id, resolvedBy, note?)

// Audit trail
auth.api.listAuditEvents({ actor?, action?, decision?, from?, to?, limit?, cursor? })

// Behavioral analytics
auth.api.getAgentReputation(agentId)
auth.api.getAgentAnomalies(agentId, since?)
auth.api.getAgentBaseline(agentId)
auth.api.getAlerts(agentId?)

// Health
auth.api.isHealthy()  // → boolean
```

## Environment variables

| Variable | Description |
|---|---|
| `LELU_API_KEY` | Your API key — set this and you're done |
| `LELU_BASE_URL` | Override the engine URL (e.g. for self-hosted) |

## Self-hosting

If you run your own Lelu engine (Docker / Kubernetes / Cloud Run), pass the URL directly:

```ts
export const auth = lelu({
  baseUrl: "https://your-engine.example.com",
  apiKey: process.env.LELU_API_KEY,
});
```

Or via environment variable — no code change needed:

```bash
LELU_BASE_URL=https://your-engine.example.com
LELU_API_KEY=your-key
```

See the [self-hosting guide](https://lelu-ai.com/docs/guides/production) for Docker Compose and Kubernetes manifests.

## Links

- [Documentation](https://lelu-ai.com/docs)
- [Get API key](https://lelu-ai.com/api-key)
- [GitHub](https://github.com/lelu-ai/lelu)
- [Issues](https://github.com/lelu-ai/lelu/issues)

## License

MIT
