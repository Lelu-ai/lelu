---
title: Audit failed authentication, rate-limit rejections, token mint, agent registry and vault events
labels: help wanted,enhancement,level-2-intermediate
---
Decisions, reviews and policy updates are logged. Failed logins (401), rate-limit hits (429), token minting, agent register/suspend/revoke and vault reads and writes are not.

**What to do** emit an audit event from each of those handlers (`actor` = key prefix, never the full key). Extend `completeness_test.go` so a missing event fails CI.

Audit reference: AUD-01, V25.
