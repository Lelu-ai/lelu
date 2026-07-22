---
description: Turn a plain-English rule into a Lelu policy entry, e.g. "/lelu never touch the prod database"
argument-hint: <a plain-English rule>
---

The user wants to add a new Tier-1 policy rule described in plain English:

"$ARGUMENTS"

Follow these steps carefully — this file is edited directly by hand, so a mistake here has real consequences:

1. Read the current policy file (`${CLAUDE_PLUGIN_ROOT}/policies/defaults.json`, or the path in `$LELU_POLICY_PATH` if that's set) to see its schema and existing rules.
2. Draft **one** new rule that captures the user's intent as narrowly and literally as possible:
   - "never touch/edit/delete `<thing>`" → a `protected_paths` entry, `{"contains": "<thing>"}`.
   - "never run `<command>`" or "always ask before `<command>`" → a `destructive_commands` entry with the exact command name and only the flags the user actually described — don't invent flags, subcommands, or scope beyond what they said.
3. Show the user the **exact JSON** you plan to add, in a diff-like form, and ask them to confirm before writing anything. If the request is ambiguous, ask a clarifying question instead of guessing.
4. Only after they confirm, append the rule to the policy file, keeping the file valid JSON (validate it parses before telling the user you're done).
5. Tell the user the daemon only reads this file at startup — if `lelu-daemon` is already running, the new rule won't take effect until it's restarted. Point them at `/lelu:lelu-status` to confirm afterward.
