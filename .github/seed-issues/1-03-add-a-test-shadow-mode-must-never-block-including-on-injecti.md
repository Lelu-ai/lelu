---
title: Add a test: shadow mode must never block, including on injection hits
labels: good first issue,tests,level-1-first-timer
---
`applyShadowMode` is applied to normal decisions, but the injection pre-filter used to write its denial directly. It is now routed through `applyShadowMode`; lock that in.

**What to do**
- In `engine/internal/server/server_test.go` add a case with `LELU_MODE=shadow` and a request whose `args` contain `ignore previous instructions`.
- Assert `allowed == true`, `shadow_mode == true` and `would_have_allowed == false`.

Audit reference: POL-16.
