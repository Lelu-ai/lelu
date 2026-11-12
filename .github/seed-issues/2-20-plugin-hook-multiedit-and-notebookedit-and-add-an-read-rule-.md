---
title: Plugin: hook `MultiEdit` and `NotebookEdit`, and add an `Read` rule for secrets
labels: help wanted,enhancement,level-2-intermediate
---
The matcher in `plugin-claude-code/hooks/hooks.json` is `Bash|Edit|Write|mcp__.*`. `MultiEdit`, `NotebookEdit` and `Read` are not hooked, and every `mcp__` call is allowed by the daemon.

**What to do** extend the matcher, apply the existing path rules to `MultiEdit` and `NotebookEdit`, and ask on `Read` of `~/.ssh`, `.env`, `~/.aws` and `~/.lelu`.

Audit reference: P3.
