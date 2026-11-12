---
title: Shared state for more than one replica (queue, rate limits, revocation, audit sequence)
labels: help wanted,enhancement,level-3-advanced
---
The engine keeps state in SQLite and process memory, yet the Helm values run two replicas and the GCP config scales to 20. Each replica gets its own audit chain, rate-limit budget and review queue, and the README's "Postgres (prod)" refers only to the dashboard.

**What to do** design and implement a `Store` interface with SQLite and Postgres backends, a single audit sequence, and shared limiter counters (Redis or Postgres). Until it lands, make Helm default to one replica with a PVC.

Audit reference: V9, V18.
