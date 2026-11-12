---
title: Return `allowed:false` for read-only downgrades of write actions
labels: help wanted,enhancement,level-2-intermediate
---
At confidence 0.50 to 0.69 the engine returns `allowed:true, downgraded_scope:"read_only"` for every action, including `update_customer_record` and `send_email`. A client that checks only `allowed` runs the write.

**What to do**
- Classify the requested action as read or write (reuse the token lists in `server/risk.go`).
- Return `allowed:false` for a downgraded write; keep `allowed:true` for a read.
- Update SDK wrappers and docs, and add tests across all three SDKs.

Audit reference: CONF-07, V6.
