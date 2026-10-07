---
description: Return to shadow mode — Lelu logs what it would have done but blocks nothing
---

Use the plugin data directory: `${LELU_DATA_DIR:-${LELU_HOME:-$HOME/.lelu/claude-plugin}}`. Create it if it doesn't already exist, then write the literal text `shadow` (no trailing newline) to its `mode` file.

Confirm to the user that Lelu is back in observe-only mode: every decision is still logged to the configured data directory's `ledger.jsonl`, but nothing is actually blocked.
