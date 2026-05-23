<p align="center">
  <img src="https://raw.githubusercontent.com/lelu-auth/lelu/main/platform/ui/public/lelu-mark.svg" alt="Lelu" width="64" />
</p>

<h1 align="center">Lelu</h1>

<p align="center">
  <strong>Open source authorization engine for AI agents.</strong><br/>
  Confidence-aware gating · Human-in-the-loop review · Policy-as-code · Full audit trail
</p>

<p align="center">
  <a href="https://lelu-ai.com/docs/quickstart">Quickstart</a> ·
  <a href="https://lelu-ai.com/docs">Docs</a> ·
  <a href="https://github.com/lelu-auth/lelu/discussions">Discussions</a> ·
  <a href="https://lelu-ai.com">lelu-ai.com</a>
</p>

---

## The problem

Every team shipping AI agents is solving the same authorization problem from scratch.

Web auth was built for humans: the actor is known, confidence is always 1.0, and a 401 is acceptable. AI agents are different — they act autonomously, their certainty varies per action, and a blanket deny breaks a multi-step workflow. Existing tools (OPA, Casbin, AWS AVP) were not built for this.

The result: teams either skip authorization entirely, or bolt on ad-hoc `if confidence > 0.8` checks that aren't auditable, aren't policy-driven, and don't scale.

**Lelu is the missing layer.** It sits inside your agent and makes every action authorization-aware — without changing how you build.

---

## How it works

```typescript
import { createClient } from "lelu-agent-auth";

const lelu = createClient({ apiKey: process.env.LELU_API_KEY });

const decision = await lelu.agentAuthorize({
  actor: "billing-agent",
  action: "refund:process",
  resource: "order/ord_abc123",
  context: { confidence: 0.85, amount_usd: 250 },
});

if (decision.allowed) {
  await processRefund(orderId);
} else if (decision.requiresHumanReview) {
  await notifyReviewer(decision.reviewId); // agent pauses, human approves
} else {
  log("denied", decision.reason);
}
```

One call. Three outcomes. Every decision logged.

---

## What Lelu provides

| Feature | Description |
|---|---|
| **Confidence-aware gating** | Set thresholds per action — low-confidence actions auto-route to review |
| **Human-in-the-loop queue** | Agent pauses, a human approves or denies, agent resumes |
| **Policy-as-code** | Write Rego policies — the same language as OPA |
| **Audit trail** | Every decision logged with actor, action, confidence, outcome, and timestamp |
| **Prompt-injection prefiltering** | Detect and block injection attempts before they reach policy |
| **Multi-agent delegation** | Enforce trust chains between agents |
| **Framework-agnostic** | Works with LangChain, OpenAI Agents SDK, Anthropic, Vercel AI SDK, MCP |

---

## Why now

AI agent deployment is accelerating faster than the tooling to govern it. Most production teams are shipping agents with no authorization layer at all — not because they don't care, but because no standard exists yet.

That's the window Lelu is built for. Authorization for agents is a new category, and we're building the open source standard for it.

---

## Get started in 2 minutes

**Cloud (no setup)**

```bash
npm install lelu-agent-auth
```

Get an API key at [lelu-ai.com/api-key](https://lelu-ai.com/api-key) and make your first authorization call. The hosted engine runs on GCP Cloud Run — no Docker, no server, no config.

**Self-hosted**

```bash
docker compose up -d
```

See the [self-hosting guide](https://lelu-ai.com/docs/guides/production) for production deployment on GCP, AWS, or any container platform.

---

## Architecture

```
Your Agent
    │
    ▼
lelu-agent-auth (SDK)
    │
    ▼
Lelu Engine (Go · GCP Cloud Run)
    ├── Injection prefilter
    ├── Confidence gate
    ├── Policy evaluation (YAML / Rego)
    ├── Risk assessment
    └── Decision merge → allow / deny / review
            │
            ▼
    Audit Trail + Human Review Queue
```

The engine is stateless and horizontally scalable. Decisions are sub-10ms p99.

---

## Roadmap

We're building toward being the default authorization layer for the agentic web.

- [x] TypeScript SDK
- [x] Hosted engine on GCP Cloud Run
- [x] Rego policy evaluation
- [x] Human-in-the-loop review queue
- [x] Audit trail
- [ ] Python SDK — [tracking issue](https://github.com/lelu-auth/lelu/issues)
- [ ] LangChain integration — [tracking issue](https://github.com/lelu-auth/lelu/issues)
- [ ] OpenAI Agents SDK integration — [tracking issue](https://github.com/lelu-auth/lelu/issues)
- [ ] Anthropic Claude tool-use integration — [tracking issue](https://github.com/lelu-auth/lelu/issues)
- [ ] MCP authorization middleware — [tracking issue](https://github.com/lelu-auth/lelu/issues)
- [ ] Vercel AI SDK integration — [tracking issue](https://github.com/lelu-auth/lelu/issues)
- [ ] Policy playground (browser-based) — [tracking issue](https://github.com/lelu-auth/lelu/issues)
- [ ] GitHub Actions integration — [tracking issue](https://github.com/lelu-auth/lelu/issues)

---

## Documentation

Full docs at **[lelu-ai.com/docs](https://lelu-ai.com/docs)**

- [Quickstart](https://lelu-ai.com/docs/quickstart) — first authorization call in 2 minutes
- [Installation](https://lelu-ai.com/docs/installation) — SDK setup and API key
- [Concepts](https://lelu-ai.com/docs/concepts/actors) — actors, actions, resources, policies, decisions
- [API reference](https://lelu-ai.com/docs/concepts/api) — full endpoint docs
- [Self-hosting](https://lelu-ai.com/docs/guides/production) — deploy on your own infrastructure

---

## Contributing

Lelu is MIT licensed and built in the open. Contributions are welcome.

The highest-impact areas right now:
- **Framework integrations** — LangChain, CrewAI, LlamaIndex, AutoGen, Semantic Kernel
- **Rego policy templates** — common compliance patterns (SOC 2, HIPAA, GDPR)
- **SDK improvements** — streaming, batching, retry logic

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

**Good first issues** are labeled [`good first issue`](https://github.com/lelu-auth/lelu/labels/good%20first%20issue) on GitHub.

---

## Security

Report security issues privately to `security@lelu-ai.com`. All reports are reviewed promptly.

---

## License

MIT © [Lelu](https://lelu-ai.com)
