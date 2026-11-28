---
description: Turn a plain-English rule into a Lelu policy entry, e.g. "/lelu never touch the prod database"
argument-hint: <a plain-English rule>
---

The user wants to add a new Tier-1 policy rule described in plain English:

"$ARGUMENTS"

Follow these steps carefully — this file is edited directly by hand, so a mistake here has real consequences:

1. Find the user's own rules file: `policy.local.json` in the plugin data directory, `${LELU_DATA_DIR:-${LELU_HOME:-$HOME/.lelu/claude-plugin}}`. Never edit the plugin's `policies/defaults.json`: Claude Code replaces the plugin folder on every update, which would erase the rule. If `policy.local.json` doesn't exist yet, you will create it as `{"destructive_commands": [], "protected_paths": []}`. Read `${CLAUDE_PLUGIN_ROOT}/policies/defaults.json` to see the schema and the default rules, so you don't add a rule that already exists.
2. Draft **one** new rule that captures the user's intent as narrowly and literally as possible:
   - "never touch/edit/delete `<thing>`" → a `protected_paths` entry. If `<thing>` is a file or folder name (or a few of them, like `config/prod.yaml`), use `{"name": "<thing>"}`, which matches whole file and folder names only, so `prod.yaml` does not also hit `prod.yaml.bak`; it accepts `*` wildcards. Use `{"contains": "<thing>"}` only when the text should match anywhere in a path.
   - "never run `<command>`" or "always ask before `<command>`" → a `destructive_commands` entry with the exact command name and only the flags the user actually described — don't invent flags, subcommands, or scope beyond what they said.
3. Show the user the **exact JSON** you plan to add, in a diff-like form, and ask them to confirm before writing anything. If the request is ambiguous, ask a clarifying question instead of guessing.
4. Only after they confirm, add the rule to `policy.local.json`, keeping the file valid JSON (validate it parses before telling the user you're done). Rules in this file are added to the defaults; they cannot remove a default rule.
5. The daemon reads rules only at startup. Ask the user whether to restart it now; if they agree, stop it with `pkill -x lelu-daemon` — the next tool call starts it again with the new rule. If the file doesn't parse, the daemon skips it and logs why in `daemon.log` in the same data directory. Point them at `/lelu:status` to confirm afterward.
