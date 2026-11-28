---
description: What Lelu caught — current mode, risky actions it stopped (or would have, in shadow mode), and the latest ones
allowed-tools: Bash(cat:*), Bash(grep:*), Bash(tail:*), Bash(wc:*)
---

Show the user what Lelu has been doing. The data directory is `${LELU_DATA_DIR:-${LELU_HOME:-$HOME/.lelu/claude-plugin}}`.

The ledger (`ledger.jsonl` there) logs every tool call and can be large, so **do not read the whole file**. Use these commands instead:

- Mode: `cat <data dir>/mode`. Lelu ignores case and whitespace in this file: `enforce` (or `Enforce`, `ENFORCE`, with spaces or a newline) means enforce, and `shadow` means shadow. A missing file means shadow, the default. **Anything else, including an empty file, is not recognised**: Lelu runs in shadow mode and blocks nothing.
- Totals: `wc -l <ledger>`, `grep -c '"outcome":"deny"' <ledger>` and `grep -c '"outcome":"ask"' <ledger>`.
- The latest catches: `grep -v '"outcome":"allow"' <ledger> | tail -n 5`.

Each line looks like `{"ts":"...","tool":"Bash","command":"...","file_path":"...","path":"...","glob":"...","url":"...","outcome":"deny","rule":"recursive-force-delete","reason":"...","shadow":true}`. `path` and `glob` are what a `Grep` or `Glob` call searched. `"shadow":true` means Lelu was in shadow mode: it only recorded the decision and let the call through, except for a `self-protection` ask, which asks in shadow mode too.

Then reply briefly:

1. **Mode** — shadow (records, blocks nothing) or enforce (blocks and asks). If the mode file holds a value Lelu does not recognise, say so explicitly: show the value, say Lelu is in shadow mode because of it, and tell the user to run `/lelu:enforce` (or `/lelu:shadow`) to set it.
2. **What it caught** — e.g. "Checked 1,240 tool calls; 3 would have been blocked and 7 would have asked you first." In enforce mode, say "were blocked" and "asked you".
3. **Latest catches** — a compact table of up to 5: time, tool, the command / file / searched path / URL (shortened), outcome, rule.
4. If the mode is shadow and something was caught, end with one line: run `/lelu:enforce` to start blocking.

If the ledger doesn't exist yet, say nothing has been checked yet.
