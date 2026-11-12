---
title: Go SDK: call `/v1/agent/authorize` and add review helpers
labels: help wanted,enhancement,level-2-intermediate
---
`sdk/go` posts to `/api/v1/authorize`, a hosted-platform route, so every call returns 404 against the open-source engine. There is no way to send a confidence signal and no wait or redeem helper.

**What to do** target the engine route, send actor, action, resource, args and signal, and add `WaitForReview` and `RedeemReview`. Add an integration test that starts a real engine binary.

Audit reference: S5, V7.
