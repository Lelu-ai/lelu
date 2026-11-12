---
title: Add a `CODEOWNERS`, Dependabot config and a `govulncheck` CI step
labels: good first issue,tests,level-1-first-timer
---
CI runs no vulnerability, secret or dependency scanning.

**What to do**
- `.github/dependabot.yml` for gomod (engine, platform, sdk/go), npm (sdk/typescript, sdk/mcp, platform/ui), pip and github-actions.
- A `govulncheck ./...` job for `engine/`.
- Pin third-party actions by commit SHA and add `permissions: contents: read` to `ci.yml` and `shadow.yml`.

Audit reference: C-01, C-03.
