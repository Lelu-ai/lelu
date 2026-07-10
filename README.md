<p align="center">
  <img src="https://raw.githubusercontent.com/lelu-ai/lelu/main/platform/ui/public/lelu-mark.svg" alt="Lelu" width="56" />
</p>

<h1 align="center">Lelu</h1>

<p align="center">
  <strong>Authorization engine for AI agents.</strong><br/>
  Every action checked. Every decision logged. Humans in the loop when it matters.
</p>

<p align="center">
  <a href="https://github.com/lelu-ai/lelu/stargazers"><img src="https://img.shields.io/github/stars/lelu-ai/lelu?style=flat-square&color=f5c518" alt="GitHub stars" /></a>
  <a href="https://github.com/lelu-ai/lelu/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/lelu-ai/lelu/ci.yml?branch=main&style=flat-square&label=CI" alt="CI" /></a>
  <a href="https://github.com/lelu-ai/lelu/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT" /></a>
  <a href="https://pypi.org/project/lelu-agent-auth-sdk/"><img src="https://img.shields.io/pypi/v/lelu-agent-auth-sdk?style=flat-square&label=PyPI" alt="PyPI" /></a>
  <a href="https://www.npmjs.com/package/lelu-agent-auth"><img src="https://img.shields.io/npm/v/lelu-agent-auth?style=flat-square&label=npm" alt="npm" /></a>
  <a href="https://lelu-ai.com/sandbox"><img src="https://img.shields.io/badge/try%20it-sandbox-10b981?style=flat-square" alt="Sandbox" /></a>
</p>

<p align="center">
  <a href="https://lelu-ai.com/sandbox"><b>Live Sandbox</b></a> ·
  <a href="#try-it-in-one-command"><b>One-Command Start</b></a> ·
  <a href="examples/"><b>Examples</b></a> ·
  <a href="sdk/mcp"><b>MCP Server</b></a> ·
  <a href="CONTRIBUTING.md"><b>Contributing</b></a> ·
  <a href="https://github.com/lelu-ai/lelu/discussions"><b>Discussions</b></a>
</p>

---

## What is Lelu?

**Lelu is an open-source authorization engine that sits between your AI agent and the real world.** Before the agent takes any action — issuing a refund, sending an email, deleting a record — it asks Lelu first, and Lelu returns one of four decisions:

- ✅ **`allow`** — the action runs
- ⛔ **`deny`** — blocked, with a reason
- 🙋 **`human_review`** — the agent pauses until a human approves
- 🧪 **`compute`** — redirected to a safer alternative or sandbox

It's one HTTP call from any language or framework, every decision is written to an audit log, and the engine runs entirely on your own machine or infrastructure.

<p align="center">
  <img src="docs/assets/lelu-flow.svg" alt="Animated diagram: an AI agent's tool calls flow through the Lelu authorization engine and receive allow, deny, human_review, or compute decisions — every decision written to the audit log" width="760" />
</p>

## Why Lelu?

**Give your agent a permission system it can't talk its way around.**

Okta tells you **who can do what**. Lelu tells you **when they're doing it wrong**. Traditional auth tools (OPA, Casbin, AWS AVP) block unauthorized access — they can't detect when a *legitimately authorized* agent is being manipulated by prompt injection, acting on low confidence, or behaving anomalously. Lelu closes that gap.

|  | OPA / Casbin / AWS AVP | **Lelu** |
|---|:---:|:---:|
| Role & permission checks | ✅ | ✅ YAML + Rego |
| Prompt-injection detection | ❌ | ✅ 5-layer filter |
| LLM confidence gating (verified log-probs) | ❌ | ✅ |
| Human-in-the-loop pause → approve → resume | ❌ | ✅ Slack / Teams / PagerDuty |
| Behavioral anomaly & reputation scoring | ❌ | ✅ |
| Audit log of every decision | partial | ✅ |

<p align="center">
  <a href="https://lelu-ai.com/sandbox">
    <img src="docs/assets/sandbox-deny.png" alt="Lelu blocking a destructive agent action (delete_all_records) in the live sandbox" width="760" />
  </a>
  <br/>
  <em>A destructive agent action blocked by the default policy — <a href="https://lelu-ai.com/sandbox">try it live, no signup</a>.</em>
</p>

---

## Try it in one command

No account, no Docker, no config — the real engine runs on your machine:

```bash
npx -y lelu-mcp start
```

Give **Claude Code** guardrails right now:

```bash
claude mcp add lelu -- npx -y lelu-mcp start --transport stdio
```

Your agent gets a `lelu_agent_authorize` tool: destructive actions denied, payments and outbound email routed to human review, production writes redirected to a sandbox, everything else default-denied. Rules live in `~/.lelu/policy.yaml`. Cursor / Claude Desktop setup and full docs → [sdk/mcp](sdk/mcp)

---

## Quickstart (SDK)

```bash
npm install lelu-agent-auth          # TypeScript — or: pip install lelu-agent-auth-sdk
```

```typescript
import { createClient } from "lelu-agent-auth";

// Local engine? Any self-chosen key works (whatever API_KEY you started it with) — no account needed.
// A lelu_sk_ key from lelu-ai.com is only required for the hosted engine.
const lelu = createClient({ apiKey: process.env.LELU_API_KEY });

const decision = await lelu.authorize({
  tool: "delete_record",
  context: { confidence: 0.82, actingFor: "user_42" },
});

if (decision.decision === "allow") {
  await deleteRecord(id);
} else if (decision.decision === "human_review") {
  await notifyReviewer(decision.requestId); // agent pauses, human approves, resumes
} else if (decision.decision === "compute") {
  await saferAlternative(decision.safeTool, decision.safeArgs); // redirected to sandbox
} else {
  throw new Error(decision.reason); // denied
}
```

**Four outcomes. Every decision audited. No other changes to how you build.** Works with OpenAI, Anthropic, LangChain, LangGraph, CrewAI, Vercel AI SDK, and MCP.

---

## How it works

Every action flows through a layered pipeline — the strictest outcome wins:

| Layer | What it does |
|------|--------------|
| Prompt-injection filter | 5 layers: exact → homoglyph → fuzzy → structural → entropy |
| Confidence gate | Verified LLM token log-probs¹ — low confidence → deny or downgrade |
| Policy evaluator | YAML roles + OPA/Rego, deny-first, wildcard patterns |
| Risk model | `criticality × (1 − confidence) × reliability × anomaly_factor` |
| Human-review queue | Uncertain decisions pause for approval (Slack / Teams / PagerDuty) |
| Behavioral analytics | Shadow-agent detection, reputation scoring, baseline drift alerts |

¹ Read from the provider (OpenAI, some Bedrock families) — never self-reported by the agent. No signal available (e.g. Anthropic Claude)? The engine applies its `MissingSignalMode` policy instead of trusting a fabricated score.

Also in the box: stable agent identity with RS256 workload JWTs and MCP OAuth 2.1 · AES-256-GCM [OAuth token vault](docs/) with 8 auto-refresh providers · NHI inventory with OWASP top-10 checks (`/v1/nhi/inventory`).

**Stack:** Go engine · Next.js dashboard · SQLite (local) / Postgres (prod) · Redis (optional)

---

## Examples

| Example | What it shows |
|---|---|
| [quickstart](examples/quickstart) | The real engine on SQLite — one request per outcome, live prompt-injection catch |
| [crewai](examples/crewai) | Gate CrewAI tool calls — a prompt-injected refund agent gets stopped |
| [bedrock](examples/bedrock) | Gate Amazon Bedrock agents on the model's *own verified* confidence |
| [agentgateway](examples/agentgateway) | Lelu as the decision brain behind agentgateway (ext-authz PEP) |

SDKs: [TypeScript](sdk/typescript) · [Python](sdk/python) · [Go](sdk/go) · [MCP server](sdk/mcp)

Self-hosting: `docker run -p 8080:8080 ghcr.io/lelu-ai/lelu/engine:latest` — Helm chart in [helm/](helm/), full options in [examples/quickstart](examples/quickstart).

---

## FAQ

<details>
<summary><b>Is it really free?</b></summary>

Yes — the engine, SDKs, MCP server, and dashboard are MIT licensed. Self-host everything with `npx -y lelu-mcp start` or Docker. The hosted sandbox at lelu-ai.com is just a convenience.
</details>

<details>
<summary><b>Can't the agent just lie about its confidence?</b></summary>

No. Production engines only accept **verified** confidence signals — token log-probs read from the LLM provider, never a number the agent self-reports. When no verified signal exists, the engine applies its `MissingSignalMode` policy instead of trusting a fabricated score.
</details>

<details>
<summary><b>Does this replace OPA / Casbin / my IAM?</b></summary>

No — it sits on top. Lelu evaluates OPA/Rego and YAML policies as one step of its pipeline, then adds what those tools can't see: prompt-injection detection, confidence gating, behavioral anomaly scoring, and a human-review queue.
</details>

<details>
<summary><b>What happens when a decision is <code>human_review</code>?</b></summary>

The agent pauses, a reviewer gets pinged (Slack / Teams / PagerDuty), and the action resumes or dies with their verdict. Every decision — including the human's — lands in the audit log.
</details>

---

## Contributing

Contributions of every size are welcome — from a typo fix to a new framework integration. Most wanted right now: 🔌 framework integrations (LangChain, OpenAI Agents SDK, LlamaIndex), 📜 Rego policy templates (SOC 2, HIPAA, GDPR), and 📚 examples.

Pick up a [`good first issue`](https://github.com/lelu-ai/lelu/labels/good%20first%20issue), grab a [`help wanted`](https://github.com/lelu-ai/lelu/labels/help%20wanted) task, or start a thread in [Discussions](https://github.com/lelu-ai/lelu/discussions). Setup and guidelines → [CONTRIBUTING.md](CONTRIBUTING.md)

**If Lelu is useful to you, [a ⭐ star](https://github.com/lelu-ai/lelu/stargazers) helps more people find it — and tells us to keep going.**

## Contributors

Thanks to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)) — contributions of any kind are welcome:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Abenezer0923"><img src="https://avatars.githubusercontent.com/Abenezer0923?s=100" width="100px;" alt="Abenezer Getachew"/><br /><sub><b>Abenezer Getachew</b></sub></a><br /><a href="https://github.com/lelu-ai/lelu/commits?author=Abenezer0923" title="Code">💻</a> <a href="https://github.com/lelu-ai/lelu/commits?author=Abenezer0923" title="Documentation">📖</a> <a href="#infra-Abenezer0923" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-Abenezer0923" title="Maintenance">🚧</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

<a href="https://github.com/lelu-ai/lelu/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=lelu-ai/lelu" alt="Contributor avatars" />
</a>

---

MIT © [Lelu](https://lelu-ai.com)
