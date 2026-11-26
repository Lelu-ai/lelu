# Contributing to Lelu

Thanks for helping. Lelu is small enough that one pull request makes a visible
difference, and every pull request gets a reply from a maintainer.

## Find something to work on

Every open issue has a level label, so you can pick one that fits:

| Label | What it means |
|---|---|
| [`good first issue`](https://github.com/lelu-ai/lelu/labels/good%20first%20issue) / `level-1-first-timer` | Small and self-contained. A good first pull request. |
| `level-2-intermediate` | Needs some familiarity with the part of the code it touches. |
| `level-3-advanced` | A design change. Talk it through on the issue before writing code. |
| [`help wanted`](https://github.com/lelu-ai/lelu/labels/help%20wanted) | We would especially like help here. |
| [`integration`](https://github.com/lelu-ai/lelu/labels/integration) | A new framework or coding-agent integration. |

**Claim it first.** Comment on the issue to say you're working on it, and a
maintainer will assign it to you. That stops two people doing the same work. If
you have to stop, say so on the issue so someone else can pick it up.

**Something not on the list?** Open an issue or start a thread in
[Discussions](https://github.com/lelu-ai/lelu/discussions) before you write a
large change. Changes to the HTTP API, decision semantics, the policy format or
the security model need a `proposal` issue first; see
[GOVERNANCE.md](GOVERNANCE.md#how-decisions-are-made).

**Found a vulnerability?** Do not open a public issue. Report it privately as
described in [SECURITY.md](SECURITY.md).

## Where things live

| Directory | What it is | Language |
|---|---|---|
| `engine/` | The authorization engine. Stores state in SQLite. | Go 1.24+ |
| `plugin-claude-code/` | Claude Code plugin: a `PreToolUse` hook and a local daemon (`daemon/`). | Go 1.24+ |
| `sdk/typescript/` | `lelu-agent-auth` on npm, with LangChain, LangGraph, Vercel AI, Express and Strands adapters. | Node 18+ |
| `sdk/python/` | `lelu-agent-auth-sdk` on PyPI, with LangChain, LangGraph, CrewAI, FastAPI and Strands adapters. | Python 3.11+ |
| `sdk/go/` | Go client. | Go |
| `sdk/mcp/` | `lelu-mcp`: the MCP server, and `npx lelu-mcp start` for a zero-config local engine. | Node 18+ |
| `sdk/openclaw/` | OpenClaw guard plugin. | Node 20+ |
| `platform/` | Control-plane API for the hosted dashboard. Uses Postgres. | Go |
| `platform/ui/` | Next.js dashboard and the lelu-ai.com site. | Node 20+ |
| `config/` | Sample YAML policy (`auth.yaml`) and Rego policies (`auth.rego`, `skills/*.rego`). | YAML, Rego |
| `examples/` | Runnable examples, one directory each. | |
| `docs/` | Design notes, security roadmap, deployment guidance. | |

## Run Lelu locally

To try the engine with nothing to build:

```bash
npx -y lelu-mcp start
```

To build and run the real engine from source (needs Go 1.24+, `curl` and
`python3`):

```bash
git clone https://github.com/lelu-ai/lelu.git
cd lelu/examples/quickstart
./demo.sh
```

The script builds the engine, starts it on SQLite, sends one request for each
decision and cleans up. To build the binary yourself: `cd engine && go build ./cmd/engine`.

The full stack (engine, dashboard, control plane, Postgres, Redis, MCP server)
runs with `docker compose up -d`. You only need it for dashboard or
control-plane work. The engine is then on http://localhost:8083 and the
dashboard on http://localhost:3002.

## Run the tests

Run the tests for the part you changed before opening a pull request.

| Part | Commands |
|---|---|
| Engine | `cd engine && go test -race ./...` |
| Claude Code plugin | `cd plugin-claude-code/daemon && go test ./...` |
| TypeScript SDK | `cd sdk/typescript && npm ci && npm run typecheck && npm test` |
| Python SDK | `cd sdk/python && pip install -e ".[dev]" && pytest && mypy auth_pe --ignore-missing-imports` |
| Go SDK | `cd sdk/go && go test ./...` |
| MCP server | `cd sdk/mcp && npm ci && npm test` |
| OpenClaw plugin | `cd sdk/openclaw && npm ci && npm run typecheck && npm test` |
| Control plane | `cd platform && go test ./...` |
| Dashboard | `cd platform/ui && npm ci && npm run typecheck && npm run lint` |

CI runs the engine, TypeScript SDK, Python SDK, control-plane and dashboard
checks on every pull request. The plugin, Go SDK, MCP server and OpenClaw
tests only run at release time today, so run them locally if you touch those.

## Open a pull request

1. Fork the repository and branch from `main`.
2. Keep it to one change. Two small pull requests are reviewed faster than one
   large one.
3. Add or update tests for any change in behaviour. Changes to authentication,
   authorization decisions, the audit chain or the enforcement hooks must come
   with tests.
4. If users will notice the change, add a line under `## Unreleased` in that
   component's `CHANGELOG.md`.
5. Title the pull request as a conventional commit, with the part you changed
   as the scope, e.g. `fix(engine): …`, `feat(sdk-python): …`,
   `docs(plugin): …`. Releases are cut from these titles.
6. Fill in the template: what changed, why, which issue it closes, and the
   commands you ran.

The Vercel check fails on pull requests from forks
([#125](https://github.com/lelu-ai/lelu/issues/125)). You can ignore it.

### Docs and claims

Lelu is a security tool, so its docs must not promise more than the code does.
Say what the code does, link to where it does it, and name the limits. If a
number, a certification or a quote has no source, leave it out.

### Using AI tools

You're welcome to use coding assistants. You are still the author:

- Read and understand every line you submit, and run the tests yourself.
- Say in the pull request which parts were AI-assisted and what you checked by
  hand.
- Don't open pull requests from unreviewed AI output, and don't use AI to reply
  to review comments for you.

## Recognition

Everyone with a merged pull request is listed in the
[README](README.md#contributors), and code, docs, examples, design and
security reports all count. If you're missing, say so in an issue or in your
next pull request.

After a few merged pull requests, reviewing other people's changes is the next
step. A sustained record of both is how contributors become maintainers; see
[GOVERNANCE.md](GOVERNANCE.md#becoming-a-maintainer).

## Getting help

- [Discussions](https://github.com/lelu-ai/lelu/discussions): questions,
  design ideas, and showing what you built
- [Issues](https://github.com/lelu-ai/lelu/issues): bugs and concrete requests
- Email: support@lelu-ai.com

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
