---
title: Cap review-queue growth: deduplicate identical pending reviews and limit per actor
labels: help wanted,bug,level-2-intermediate
---
1,500 identical `human_review` requests created 1,500 queue items in 8 seconds. A noisy or hostile agent can bury real reviews.

**What to do** (in `engine/internal/queue/`)
- If a pending item with the same effect fingerprint already exists for the actor, return its ID instead of creating a new one.
- Add `LELU_QUEUE_MAX_PENDING_PER_ACTOR` (default 100); beyond it, deny with a clear reason.
- Tests for both.

Audit reference: HITL-06, V21.
