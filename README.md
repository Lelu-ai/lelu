<p align="center">
  <img src="https://raw.githubusercontent.com/lelu-auth/lelu/main/platform/ui/public/lelu-mark.svg" alt="Lelu" width="64" />
</p>

<h1 align="center">Lelu</h1>

<p align="center">
  <strong>Open source authorization engine for AI agents.</strong><br/>
  Confidence-aware gating · Human-in-the-loop review · Policy-as-code · Full audit trail
</p>

<p align="center">
  <a href="https://github.com/lelu-auth/lelu/stargazers"><img src="https://img.shields.io/github/stars/lelu-auth/lelu?style=flat-square&color=yellow" alt="GitHub Stars" /></a>
  <a href="https://github.com/lelu-auth/lelu/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" /></a>
  <a href="https://lelu-ai.com/sandbox"><img src="https://img.shields.io/badge/try%20it-live%20sandbox-emerald?style=flat-square&color=10b981" alt="Live Sandbox" /></a>
  <a href="https://lelu-ai.com/docs"><img src="https://img.shields.io/badge/docs-lelu--ai.com-orange?style=flat-square" alt="Docs" /></a>
</p>

<p align="center">
  <a href="https://lelu-ai.com/sandbox"><strong>▶ Try the live sandbox — no account required</strong></a>
</p>

---

## The problem

Every team shipping AI agents is re-implementing authorization from scratch. Existing tools (OPA, Casbin, AWS AVP) weren't built for agents — they don't understand confidence signals, can't pause for human review, and have no concept of autonomous action chains.

**Lelu is the missing layer.** It sits between your agent and its tools, making every action authorization-aware — without changing how you build.

---

## How it works

```typescript
import { createClient } from "lelu-agent-auth";

const lelu = createClient({ apiKey: process.env.LELU_API_KEY });

const decision = await lelu.authorize({
  tool: "delete_record",
  context: "record_id=42",
});

if (decision.decision === "allow") {
  await deleteRecord(id);
} else if (decision.decision === "human_review") {
  await notifyReviewer(decision.requestId); // agent pauses, human approves
} else {
  console.log("Denied:", decision.reason);
}
```

One call. Three outcomes. Every decision in the audit log.

---

## Try it now

No install. No account. [Open the sandbox →](https://lelu-ai.com/sandbox)

```bash
curl -X POST https://lelu-ai.com/api/v1/authorize \
  -H "Authorization: Bearer lelu_sk_sandbox_test" \
  -H "Content-Type: application/json" \
  -d '{"tool": "delete_all_records", "context": "cleanup task"}'
```

```json
{
  "decision": "deny",
  "reason": "Destructive operations are blocked by the default safety policy.",
  "rule": "deny:destructive-ops",
  "latencyMs": 4
}
```

---

## Install

**TypeScript / Node.js**
```bash
npm install lelu-agent-auth
```

**Python**
```bash
pip install lelu-agent-auth-sdk
```

Get an API key at [lelu-ai.com/api-key](https://lelu-ai.com/api-key) · Full docs at [lelu-ai.com/docs](https://lelu-ai.com/docs)

---

## Integrations

Works with any AI framework out of the box:

| Framework | Guide |
|-----------|-------|
| OpenAI (function calling, Agents SDK) | [docs/integrations/openai](https://lelu-ai.com/docs/integrations/openai) |
| Anthropic / Claude | [docs/integrations/anthropic](https://lelu-ai.com/docs/integrations/anthropic) |
| LangChain | [docs/integrations/langchain](https://lelu-ai.com/docs/integrations/langchain) |
| LangGraph | [docs/integrations/langgraph](https://lelu-ai.com/docs/integrations/langgraph) |
| Model Context Protocol (MCP) | [docs/integrations/mcp](https://lelu-ai.com/docs/integrations/mcp) |
| Vercel AI SDK | [docs/integrations/vercel-ai](https://lelu-ai.com/docs/integrations/vercel-ai) |

---

## Features

- **Policy engine** — pattern-based rules (allow / deny / human_review) evaluated in order, first match wins
- **Human-in-the-loop** — agent pauses, waits for approval, resumes automatically
- **Audit log** — every decision logged with actor, tool, decision, reason, and latency
- **Dashboard** — manage API keys, policies, and review pending approvals
- **Self-hostable** — Docker image, Helm chart, GCP Cloud Run configs included
- **Multi-framework** — TypeScript and Python SDKs

---

## Self-hosting

```bash
# Docker
docker run -p 8082:8082 \
  -e DATABASE_URL=postgres://... \
  -e REDIS_ADDR=localhost:6379 \
  ghcr.io/lelu-auth/lelu/engine:latest

# Helm
helm install lelu ./helm/prism
```

See the [Docker guide](https://lelu-ai.com/docs/docker) and [production checklist](https://lelu-ai.com/docs/guides/production).

---

## Architecture

```
your agent
    │
    ▼
lelu-agent-auth SDK  ──►  POST /api/v1/authorize
                                    │
                         ┌──────────▼──────────┐
                         │   policy engine      │
                         │   (user policies     │
                         │    + built-in rules) │
                         └──────────┬──────────┘
                                    │
                          allow / deny / human_review
                                    │
                         ┌──────────▼──────────┐
                         │   audit log (Postgres)│
                         └─────────────────────┘
```

---

## Contributing

MIT licensed. PRs welcome.

```bash
git clone https://github.com/lelu-auth/lelu
cd lelu/platform/ui && npm install && npm run dev
```

Good first issues: [`good first issue`](https://github.com/lelu-auth/lelu/labels/good%20first%20issue)

---

## License

MIT © [Lelu](https://lelu-ai.com)

<p align="center">
  <a href="https://github.com/lelu-auth/lelu">⭐ Star this repo if you find it useful</a>
</p>
