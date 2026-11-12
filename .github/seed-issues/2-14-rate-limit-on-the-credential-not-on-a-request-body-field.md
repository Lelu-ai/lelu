---
title: Rate-limit on the credential, not on a request-body field
labels: help wanted,bug,level-2-intermediate
---
In single-key mode the limiter key is the `tenant_id` the caller puts in the request, so rotating it gives a fresh budget each time (30 calls with 30 different tenant IDs all succeeded against a limit of 20).

**What to do** (`engine/internal/server/principal.go`, `rateLimitKey`) key static-key requests on a hash of the credential, and keep platform-key requests keyed on the account. Update `principal_test.go`, which currently asserts the old behaviour.

Audit reference: POL-18, V20.
