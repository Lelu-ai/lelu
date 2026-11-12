---
title: Protect the Claude Code plugin's own files from being edited by the agent
labels: help wanted,bug,level-2-intermediate
---
An allowed Bash call, `echo shadow > ~/.lelu/claude-plugin/mode`, switches the plugin to shadow mode. After that `rm -rf ~/` went from deny to no decision. Policy, `hooks.json` and `~/.claude/settings.json` are equally unprotected.

**What to do** (`plugin-claude-code/daemon/`) treat these paths as protected for Bash redirects, `sed -i`, `mv`, `cp`, `rm`, and for Edit and Write: the plugin data dir, the plugin install dir, `~/.claude/settings*.json`, and `.claude/settings*.json` in the project. Deny them in every mode. Add tests.

Audit reference: P5, V28.
