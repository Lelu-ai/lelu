---
title: Harden the Claude Code plugin's command analysis (recursion, indirection, protected trees)
labels: help wanted,security,level-3-advanced
---
On a 140-case corpus the plugin flagged 47 (34 percent) in enforce mode. It misses `rm -rf ~/*`, `rm -rf ~/Documents`, `cd ~ && rm -rf *`, `bash -c '...'`, `eval`, heredocs, `xargs rm`, `find ~ -delete`, `git reset --hard`, `dd`, `mkfs`, `chmod -R` and interpreter one-liners.

**What to do** (`plugin-claude-code/daemon/`)
- Re-parse the string argument of `-c`, `eval`, heredocs and `xargs`/`find -exec`.
- Peel `env`, `command`, `nice`, `sudo -u`, `busybox` and resolve `$IFS`, ANSI-C quoting and brace expansion.
- Protect the whole home tree and system directories for recursive deletes.
- Add rules for the destructive tools above, a fail-closed option in enforce mode, and an `ask` for base64-to-shell.
- Grow `benchmarks/` into a published corpus with false-positive cases and track the catch rate in CI.

Audit reference: P2, P4, V27.
