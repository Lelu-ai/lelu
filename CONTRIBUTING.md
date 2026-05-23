# Contributing to Lelu

Thank you for helping build the open source authorization standard for AI agents.

## Stack

| Layer | Technology |
|---|---|
| Authorization engine | Go 1.21+ |
| Platform UI | Next.js 14, TypeScript |
| TypeScript SDK | Node.js 18+ |
| Policy engine | OPA / Rego |
| Storage | Redis, PostgreSQL |

## Local setup

```bash
# Clone
git clone https://github.com/lelu-auth/lelu.git
cd lelu

# Start all services (engine + UI + Redis + Postgres)
docker compose up -d

# Services
# Engine API:   http://localhost:8080
# Platform UI:  http://localhost:3000
```

For SDK development without Docker:

```bash
cd platform/ui
npm install
npm run dev
```

## Where to contribute

### High priority — framework integrations

Lelu needs first-class integrations with every major agent framework. If you use one of these, this is the best place to start:

- **LangChain** (Python + JS) — wrap tool calls with `agent_authorize`
- **OpenAI Agents SDK** — decorator / middleware pattern
- **Anthropic tool-use** — intercept between `tool_use` block and execution
- **CrewAI / LlamaIndex / AutoGen** — middleware hooks
- **MCP (Model Context Protocol)** — server-side authorization middleware

Each integration lives in `sdk/` and gets its own docs page at `lelu-ai.com/docs/integrations/`.

### Rego policy templates

Community-contributed policies for common compliance patterns are highly valuable:

- SOC 2 — audit every sensitive action, require human review above risk threshold
- HIPAA — restrict PHI access by actor type and confidence
- GDPR — block cross-border data actions without explicit consent context

Drop `.rego` files in `config/policies/` with a `README.md` explaining the use case.

### Core engine (Go)

- Performance — reduce decision latency (target: p99 < 5ms)
- Human-review queue — improve the Redis-backed pause/resume flow
- Streaming decisions — support long-running agent tasks

### Docs and examples

- Add working examples to `examples/` for any framework
- Improve any doc page at `platform/ui/app/docs/`

## Submitting a PR

1. Fork the repo and create a branch from `main`
2. Write tests for new behavior
3. Run `go test ./...` (engine) or `npm test` (UI/SDK)
4. Open a PR with a clear description — what problem, what changed, how to test

## Issues

- [`good first issue`](https://github.com/lelu-auth/lelu/labels/good%20first%20issue) — scoped and well-defined, good starting point
- [`help wanted`](https://github.com/lelu-auth/lelu/labels/help%20wanted) — higher complexity, maintainer guidance available
- [`integration`](https://github.com/lelu-auth/lelu/labels/integration) — framework integration work

## Community

- [GitHub Discussions](https://github.com/lelu-auth/lelu/discussions) — design questions, ideas, show and tell
- [GitHub Issues](https://github.com/lelu-auth/lelu/issues) — bug reports and feature requests
- Email: support@lelu-ai.com

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be excellent to each other.
