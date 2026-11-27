---
description: What Lelu caught — current mode, risky actions it stopped (or would have, in shadow mode), and the latest ones
allowed-tools: Bash(cat:*), Bash(grep:*), Bash(tail:*), Bash(wc:*)
---

Show the user what Lelu has been doing. The data directory is `${LELU_DATA_DIR:-${LELU_HOME:-$HOME/.lelu/claude-plugin}}`.

The ledger (`ledger.jsonl` there) logs every tool call and can be large, so **do not read the whole file**. Use these commands instead:

- Mode: `cat <data dir>/mode` — missing means `shadow`, the default.
- Totals: `wc -l <ledger>`, `grep -c '"outcome":"deny"' <ledger>` and `grep -c '"outcome":"ask"' <ledger>`.
- The latest catches: `grep -v '"outcome":"allow"' <ledger> | tail -n 5`.

Each line looks like `{"ts":"...","tool":"Bash","command":"...","file_path":"...","url":"...","outcome":"deny","rule":"recursive-force-delete","reason":"...","shadow":true}`. `"shadow":true` means Lelu only recorded the decision and let the call through.

Then reply briefly:

1. **Mode** — shadow (records, blocks nothing) or enforce (blocks and asks).
2. **What it caught** — e.g. "Checked 1,240 tool calls; 3 would have been blocked and 7 would have asked you first." In enforce mode, say "were blocked" and "asked you".
3. **Latest catches** — a compact table of up to 5: time, tool, the command / file / URL (shortened), outcome, rule.
4. If the mode is shadow and something was caught, end with one line: run `/lelu:enforce` to start blocking.

If the ledger doesn't exist yet, say nothing has been checked yet.
