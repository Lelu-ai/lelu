---
description: Leave shadow mode — Lelu's deny/ask decisions start actually applying instead of just being logged
---

Run exactly this command with the Bash tool, unchanged. Do not write the mode file any other way (no Write or Edit tool, no other wording):

```bash
mkdir -p "${LELU_DATA_DIR:-${LELU_HOME:-$HOME/.lelu/claude-plugin}}" && printf 'enforce' > "${LELU_DATA_DIR:-${LELU_HOME:-$HOME/.lelu/claude-plugin}}/mode" && cat "${LELU_DATA_DIR:-${LELU_HOME:-$HOME/.lelu/claude-plugin}}/mode"
```

Lelu asks before any change to its own files, so the user is asked to approve this command. If they decline, tell them Lelu is still in shadow mode and stop.

The command prints the mode file. If it printed exactly `enforce`, confirm to the user that Lelu is now enforcing its policy: actions matching a `deny` rule are blocked and `ask` rules ask them first, instead of only being logged. Mention they can run `/lelu:shadow` at any time to go back to observe-only mode. If it printed anything else, or the command failed, tell the user enforcement is not on and show what it printed.
