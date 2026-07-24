# Terminal-Bench integration — status

Custom Harbor/Terminal-Bench agent that installs the real, public Lelu plugin
(shadow mode) before a task runs, so a real Claude Code agent driven by
Terminal-Bench gets the same expansion-aware policy checks a real user would.

## What this is

- `lelu_claude_code_agent.py` — subclasses terminal-bench's real `ClaudeCodeAgent`.
  No method override needed: `AbstractInstalledAgent._get_templated_script_path`
  resolves the setup-script template next to wherever the concrete agent
  class's own file lives, so placing a `claude-code-setup.sh.j2` in this same
  directory overrides the original without touching the installed package.
- `claude-code-setup.sh.j2` — the original template (installed-agents/
  claude_code/claude-code-setup.sh.j2 in harbor-framework/terminal-bench,
  fetched and copied verbatim) plus: clone the real public Lelu repo, run its
  real `install.sh`, register the plugin via `claude plugin marketplace add` +
  `claude plugin install`.

Run with (from a directory with this one on `PYTHONPATH`):

```bash
tb run --agent-import-path lelu_claude_code_agent:LeluClaudeCodeAgent \
  --dataset-path <path-to-original-tasks> --task-id hello-world \
  -m anthropic/claude-... 
```

## What's actually been verified (2026-07-24)

Tested by hand inside the real base image
(`ghcr.io/laude-institute/t-bench/ubuntu-24-04:latest`), running each setup
step directly rather than trusting it blind:

- The setup script's node/npm/`@anthropic-ai/claude-code` install, the Go
  toolchain auto-download, `install.sh` (build + daemon start in shadow
  mode), and the marketplace add + plugin install all completed successfully.
- **Confirmed the actual integration point that matters**: ran
  `claude --verbose --output-format stream-json -p '<hello-world instruction>'`
  — the exact invocation Terminal-Bench's `ClaudeCodeAgent` uses — and the
  `system/init` event's own `plugins` field reported
  `{"name":"lelu","path":"/opt/lelu/plugin-claude-code","source":"lelu@lelu","version":"0.1.0"}`.
  That's Claude Code's own startup event confirming the plugin loaded under
  the real harness invocation, not an assumption.
- The task instruction itself didn't complete — the API key used had no
  credit balance (`"Credit balance is too low"`, a billing error, not a
  connection or auth failure). Stopped there rather than push further on
  someone else's credentials without a clear reason to.

**One real bug found and fixed along the way**: the plain `git clone` of the
Lelu repo failed intermittently inside the container (`RPC failed; curl 92
HTTP/2 stream ... CANCEL`) — a real HTTP/2 reliability issue in this
container's network path, not a Lelu problem. Fixed by pinning
`http.version=HTTP/1.1` for that clone specifically.

## What's left for a complete run

A funded `ANTHROPIC_API_KEY` (the containerized agent authenticates
independently of whatever the orchestrating Claude Code session uses — it
cannot reuse an OAuth/subscription login). With one, the remaining steps are
mechanical: `tb run` the command above, then check `run-tests.sh`'s verdict
alongside the Lelu daemon's `ledger.jsonl` inside the container to confirm
both "task succeeded" and "N actions observed, nothing blocked."
