<p align="center">
  <img src="https://raw.githubusercontent.com/lelu-auth/lelu/main/platform/ui/public/lelu-mark.svg" alt="Lelu" width="56" />
</p>

<h1 align="center">Lelu</h1>

<p align="center">
  <strong>Open-source authorization engine for AI agents.</strong>
</p>

<p align="center">
  <a href="https://github.com/lelu-auth/lelu/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT" /></a>
  <a href="https://pypi.org/project/lelu-agent-auth-sdk/"><img src="https://img.shields.io/pypi/v/lelu-agent-auth-sdk?style=flat-square&label=PyPI" alt="PyPI" /></a>
  <a href="https://www.npmjs.com/package/lelu-agent-auth"><img src="https://img.shields.io/npm/v/lelu-agent-auth?style=flat-square&label=npm" alt="npm" /></a>
  <a href="https://lelu-ai.com/sandbox"><img src="https://img.shields.io/badge/try%20it-sandbox-10b981?style=flat-square" alt="Sandbox" /></a>
</p>

---

Okta tells you **who can do what**. Lelu tells you **when they're doing it wrong**.

Traditional authorization tools (OPA, Casbin, AWS AVP) block unauthorized access. They cannot detect when a *legitimately authorized* agent is being manipulated — through prompt injection, low-confidence actions, or anomalous behavior — into doing something dangerous. Lelu closes that gap.

---

## How it works

```typescript
import { createClient } from "lelu-agent-auth";

const lelu = createClient({ apiKey: process.env.LELU_API_KEY });

const decision = await lelu.authorize({ tool: "delete_record", context: "id=42" });

if (decision.decision === "allow") {
  await deleteRecord(id);
} else if (decision.decision === "human_review") {
  await notifyReviewer(decision.requestId); // agent pauses, human approves, agent resumes
} else if (decision.decision === "compute") {
  await saferAlternative(decision.safeTool, decision.safeArgs); // redirected to sandbox
} else {
  throw new Error(decision.reason); // denied
}
```

**Four outcomes.** Every decision in the audit log. No other changes to how you build.

---

## Try it

```bash
curl -X POST https://lelu-ai.com/api/v1/authorize \
  -H "Authorization: Bearer lelu_sk_sandbox_test" \
  -H "Content-Type: application/json" \
  -d '{"tool": "delete_all_records", "context": "cleanup"}'
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

```bash
npm install lelu-agent-auth          # TypeScript / Node.js (v0.0.25)
pip install lelu-agent-auth-sdk      # Python (v0.3.65)
```

Get an API key → [lelu-ai.com/api-key](https://lelu-ai.com/api-key)

---

## What's inside

**Authorization pipeline** (every request flows through all layers in order):

1. API key auth + per-tenant rate limiting
2. Shadow agent detection — fingerprints unregistered agents, fails closed on error
3. Prompt injection pre-filter — 5-layer pipeline (exact → homoglyph → fuzzy → structural → entropy)
4. Confidence gate — LLM confidence signal from OpenAI / Anthropic / Vertex; low confidence → downgrade or deny
5. Policy evaluator — YAML roles + OPA/Rego, deny-first, wildcard pattern matching
6. Risk model — `criticality × (1 − confidence) × reliability × anomaly_factor`
7. Most-restrictive merge — strictest outcome across steps 4–6 wins
8. Human-review queue — `human_review` decisions enqueued; Slack / Teams / PagerDuty webhooks
9. Behavioral analytics — reputation scoring, Extended Isolation Forest anomaly detection, baseline drift alerts

**Agent identity (durable):**
- Stable UUID per agent, persists across deployments and API key rotations
- RS256 workload JWTs (OIDC-compatible) verifiable offline via `/.well-known/jwks.json`
- MCP OAuth 2.1 authorization server — auth code + PKCE, client credentials, RFC 7591 dynamic registration

**OAuth Token Vault:**
- AES-256-GCM encrypted per-(agent\_id, user\_id) credential storage
- Auto-refresh; 8 built-in providers (Google, GitHub, Slack, Salesforce, Notion, Linear, Jira, Microsoft)

**NHI Inventory (ISPM):**
- Unified view of registered agents + shadow agents + vault credentials
- OWASP NHI top-10 checks: overprivilege, long-lived secrets, stale identities, cross-tenant reuse
- Risk score 0.0–1.0 per identity; `GET /v1/nhi/inventory`, `POST /v1/nhi/scan`

---

## SDKs

**TypeScript** (`lelu-agent-auth` v0.0.26) · **Python** (`lelu-agent-auth-sdk` v0.3.65)

Works with OpenAI, Anthropic, LangChain, LangGraph, Vercel AI SDK, MCP out of the box.

---

## Self-hosting

```bash
# Docker
docker run -p 8080:8080 \
  -e JWT_SIGNING_KEY=your-secret \
  -e API_KEY=your-api-key \
  ghcr.io/lelu-auth/lelu/engine:latest

# Helm
helm install lelu ./helm/prism

# Local dev
cd platform/ui && npm install && npm run dev
```

Environment variables: `LISTEN_ADDR`, `LELU_MODE` (`enforce`|`shadow`), `REDIS_ADDR`, `DATABASE_PATH`, `INCIDENT_WEBHOOK_URL`, `LELU_ISSUER`. Full list in [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).

---

## Architecture

```
your agent
    │
    ▼  (one SDK call)
POST /v1/authorize  ──► injection check ──► confidence gate ──► policy eval ──► risk model
                                                                                     │
                                                              allow / deny / human_review / compute
                                                                                     │
                                                                        audit log · HITL queue · incident webhook
```

**Stack:** Go engine · Next.js dashboard · SQLite (local) or Postgres (production) · Redis (optional, queue + token revocation) · S3-compatible audit sink (optional)

---

## Contributing

MIT licensed. PRs welcome.

```bash
git clone https://github.com/lelu-auth/lelu
cd lelu/platform/ui && npm install && npm run dev   # dashboard
cd lelu/engine && go test ./...                      # engine tests
```

---

MIT © [Lelu](https://lelu-ai.com)
