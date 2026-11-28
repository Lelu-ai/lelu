---
description: Return to shadow mode — Lelu logs what it would have done but blocks nothing
---

Run exactly this command with the Bash tool, unchanged. Do not write the mode file any other way (no Write or Edit tool, no other wording):

```bash
mkdir -p "${LELU_DATA_DIR:-${LELU_HOME:-$HOME/.lelu/claude-plugin}}" && printf 'shadow' > "${LELU_DATA_DIR:-${LELU_HOME:-$HOME/.lelu/claude-plugin}}/mode" && cat "${LELU_DATA_DIR:-${LELU_HOME:-$HOME/.lelu/claude-plugin}}/mode"
```

Lelu asks before any change to its own files, so the user is asked to approve this command. If they decline, tell them the mode did not change and stop.

The command prints the mode file. If it printed exactly `shadow`, confirm to the user that Lelu is back in observe-only mode: every decision is still logged to the data directory's `ledger.jsonl`, but nothing is blocked, except that changes to Lelu's own files and Claude Code's settings still ask first. If it printed anything else, or the command failed, tell the user the mode did not change and show what it printed.
