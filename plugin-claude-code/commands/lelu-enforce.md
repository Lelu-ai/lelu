---
description: Leave shadow mode — Lelu's deny/ask decisions start actually applying instead of just being logged
---

Use the plugin data directory: `${LELU_DATA_DIR:-${LELU_HOME:-$HOME/.lelu/claude-plugin}}`. Create it if it doesn't already exist, then write the literal text `enforce` (no trailing newline) to its `mode` file.

Confirm to the user that Lelu is now enforcing its policy — destructive commands matching a `deny` rule will actually be blocked, not just logged. Mention they can run `/lelu:lelu-shadow` at any time to go back to observe-only mode.
