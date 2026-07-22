---
description: Show Lelu's current mode (shadow vs enforce) and a summary of recent decisions
---

Read `~/.lelu/claude-plugin/mode` (if missing, the mode is `shadow` — that's the default). Then read `~/.lelu/claude-plugin/ledger.jsonl`, which is a JSON-lines audit log where each line looks like:

```json
{"ts":"...","session_id":"...","tool":"Bash","command":"...","outcome":"deny","rule":"recursive-force-delete","reason":"...","shadow":true}
```

If the ledger file doesn't exist yet, tell the user no decisions have been recorded yet and suggest running a Bash command to generate one, then checking again.

Otherwise, summarize for the user:

1. **Current mode** — shadow (observe-only) or enforce (actively blocking).
2. **Totals** — how many entries are `allow` / `deny` / `ask`, and how many of those were logged while in shadow mode (`"shadow":true`, meaning they were allowed through despite the real outcome) versus actually enforced.
3. **Last 5 decisions** as a compact table: time, tool, command or file path, outcome, rule, shadow?.

Keep it short — this is a status check, not a full audit report.
