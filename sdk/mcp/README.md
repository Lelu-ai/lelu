# lelu-mcp

MCP (Model Context Protocol) server for [Lelu](https://github.com/Lelu-ai/lelu) — policy-gated authorization for AI agents.

Give your agent a `lelu_agent_authorize` tool: before it acts, Lelu decides **allow / deny / human-review / redirect-to-sandbox** based on your policy.

## Quickstart — no account, no Docker, no config

```bash
npx -y lelu-mcp start
```

On first run this downloads the Lelu engine binary (cached in `~/.lelu/bin`), writes a starter policy to `~/.lelu/policy.yaml`, starts the engine locally, and serves MCP over stdio. Everything runs on your machine.

**Claude Code:**

```bash
claude mcp add lelu -- npx -y lelu-mcp start --transport stdio --preset coding-agent
```

`--preset coding-agent` writes `~/.lelu/policy.coding-agent.yaml`: editing files, running tests, builds and local git are allowed; package installs, pushes, merges, deploys and anything touching secrets or env files go to human review; destructive and execution actions stay denied. Omit it for the general starter policy.

**Claude Desktop / Cursor** (`claude_desktop_config.json` / `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "lelu": {
      "command": "npx",
      "args": ["-y", "lelu-mcp", "start", "--transport", "stdio"]
    }
  }
}
```

Or generate the snippet: `npx lelu-mcp add --cursor` (add `--write` to save it).

## Change the rules

Edit `~/.lelu/policy.yaml` (or `policy.coding-agent.yaml` for that preset) and restart. The general starter policy denies destructive actions and their common synonyms (`*delete*`, `*drop*`, `*destroy*`, `rm_*`, `remove_*`, `unlink_*`…) and execution (`*exec*`, `*shell*`, `*command*`, `*sql*`, `bash*`), routes anything touching secrets, credentials or env files plus payments and outbound email to human review, redirects production writes to a sandbox path, allows reads, and **default-denies everything else**.

Rules are evaluated top to bottom and the first match on the action **name** wins, so they are a vocabulary list: keep deny/review rules above allow rules (otherwise `read_*` would allow `read_secrets`), and list the synonyms your agent uses.

Omitting `confidence` never loosens a deny: an action the policy denies stays denied without it. Other actions without confidence go to human review in local mode.

```yaml
rules:
  - id: allow-jira
    match: "jira_*"
    decision: allow
```

## Tools exposed to the agent

| Tool | What it does |
|---|---|
| `lelu_agent_authorize` | Authorize an agent action (confidence-aware). Status is `ALLOWED`, `DENIED`, `REQUIRES_HUMAN_REVIEW` (with `review_id`) or `COMPUTE` (run `safe_tool` with `safe_args` instead of the original action) |
| `lelu_authorize` | Authorize a human user action |
| `lelu_mint_token` | Mint a short-lived scoped JWT |
| `lelu_revoke_token` | Revoke a JIT token immediately |
| `lelu_get_review` | Read a human-review item's status and note by `review_id` (read-only) |
| `lelu_health` | Check engine health |

## Confidence in local dev mode

Production engines require a verified confidence signal (provider logprobs/entropy) and never trust agent self-reports. MCP hosts can't produce those signals, so the local engine starts with `CONFIDENCE_ALLOW_UNVERIFIED=true` (the tool's optional `confidence` param is honored) and `CONFIDENCE_MISSING_MODE=review` (omitting confidence routes the action to human review). Set either env var yourself to override.

## Connect to an existing engine instead

If you already run the engine (Docker, Kubernetes, or a remote host), point at it — no local engine is spawned:

```bash
npx lelu-mcp start --engine-url http://lelu.internal:8082 --api-key <key>
```

## Configuration

| Env var | Meaning | Default |
|---|---|---|
| `LELU_ENGINE_URL` | Use this engine instead of spawning one | *(local mode)* |
| `LELU_API_KEY` | Bearer key sent to the engine | *(none)* |
| `LELU_HOME` | Local data dir (binary cache, policy, SQLite) | `~/.lelu` |
| `LELU_POLICY_PATH` | Policy file for the local engine | `~/.lelu/policy.yaml` (`policy.<preset>.yaml` for a non-general preset) |
| `LELU_POLICY_PRESET` | Starter policy written on first run: `general` or `coding-agent` | `general` |
| `LELU_ENGINE_BINARY` | Use a locally built engine binary (skips download) | *(download)* |
| `LELU_ENGINE_VERSION` | Pin an engine release, e.g. `0.1.0` | latest |

Flags: `--engine-url`, `--api-key`, `--timeout <ms>`, `--transport stdio|http`, `--port`, `--no-local`, `--preset general|coding-agent`. Run `npx lelu-mcp --help` for everything.

## License

MIT
