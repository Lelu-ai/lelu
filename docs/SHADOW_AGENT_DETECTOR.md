# Shadow Agent Detector — Design Overview

This document describes the high-level design for the Shadow Agent Detector to be implemented under `engine/internal/shadow/`.

Signal sources:
- `pubsub/` audit stream — anomalous agent IDs not in registry
- `api/` request logs — unusual User-Agent strings, API key prefixes
- `cache/` (Redis) — rate anomalies from unknown origins

Main components:
- `fingerprinter.go` — extracts behavioral and header fingerprints
- `registry_diff.go` — compares fingerprints with known agents
- `detector.go` — orchestrates scoring and deduplication
- `reporter.go` — publishes alerts to `pubsub/` → BigQuery

Outputs:
- Persistent `shadow_agents` rows in Postgres for review
- Alerts to BigQuery for analytics and dashboards
- Web UI entries under `web/app/shadow-agents/` for human workflow

Security notes:
- Treat fingerprint data as operational telemetry; avoid storing PII.
- Rate-limit detection publishing to avoid noisy signals.
