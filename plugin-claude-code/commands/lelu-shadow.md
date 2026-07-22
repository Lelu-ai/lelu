---
description: Return to shadow mode — Lelu logs what it would have done but blocks nothing
---

Create the directory `~/.lelu/claude-plugin` if it doesn't already exist, then write the literal text `shadow` (no trailing newline) to `~/.lelu/claude-plugin/mode`.

Confirm to the user that Lelu is back in observe-only mode: every decision is still logged to `~/.lelu/claude-plugin/ledger.jsonl`, but nothing is actually blocked.
