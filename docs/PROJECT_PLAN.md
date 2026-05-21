# Project Plan — Lelu Authorization Engine

This document tracks the current implementation status, outstanding gaps, and next priorities.

Last updated: 2026-05-19

---

## Repository layout

```
lelu/
├── engine/                         Go HTTP authorization engine
│   ├── cmd/engine/main.go          Binary entry point
│   ├── internal/
│   │   ├── server/                 HTTP handler, routing, middleware
│   │   │   ├── server.go           All endpoints; shadow/confidence/risk wiring
│   │   │   └── risk.go             Risk model, actor stats, decision outcomes
│   │   ├── evaluator/              YAML + OPA/Rego policy evaluator
│   │   ├── confidence/             Confidence gate, signal extraction, auditor, escalator
│   │   ├── shadow/                 Shadow agent detector (fingerprint → registry → report)
│   │   ├── injection/              Prompt injection heuristic pre-filter
│   │   ├── queue/                  Human-review queue (Redis + in-memory fallback)
│   │   ├── tokens/                 JIT scoped JWT token service (Redis + in-memory fallback)
│   │   ├── incident/               Webhook notifier (Slack, Teams, PagerDuty)
│   │   ├── audit/                  Buffered audit log writer
│   │   ├── fallback/               Fail-open / fail-closed per dependency
│   │   ├── ratelimit/              Per-tenant rate limiter
│   │   ├── observability/          Phase 1: OTel tracing. Phase 2: reputation, anomaly, baseline, alerting
│   │   ├── sync/                   Policy hot-reload worker (polls control plane)
│   │   ├── telemetry/              OpenTelemetry provider bootstrap
│   │   └── db/migrations/          Postgres migration SQL files
│   └── proto/auth.proto            gRPC stub (Phase 2 — not yet generated)
│
├── platform/                       Go API backend + Next.js dashboard UI
├── sdk/
│   ├── go/                         Go client SDK
│   ├── python/                     Python client SDK
│   ├── typescript/                 TypeScript client SDK
│   └── mcp/                        MCP server SDK
├── config/
│   ├── auth.yaml                   Example YAML policy
│   ├── auth.rego                   Example OPA/Rego policy
│   └── skills/                     Skill-specific Rego policies
├── helm/prism/                     Kubernetes Helm chart
├── tests/integration/              Integration tests (shadow detection)
└── docs/                           This directory
```

---

## Authorization decision pipeline

Every `POST /v1/agent/authorize` request flows through these layers in order:

```
1. Auth middleware          API key check (Bearer token)
2. Rate limiter             Per-tenant request budget
3. Shadow agent detection   Fingerprint vs approved registry [advisory]
4. Injection pre-filter     Heuristic prompt-injection patterns
5. Confidence resolution    Extract score from provider signal
6. Confidence gate          Score vs policy thresholds → allow / review / read_only / deny
7. Policy evaluator         YAML roles + agent scopes   (or OPA/Rego)
8. Risk model               criticality × (1 - confidence) × reliability × anomaly_factor
9. Most-restrictive merge   Strictest outcome across steps 6–8 wins
10. Audit log               Non-blocking buffered write
11. Human review queue      Enqueue if requires_human_review
12. Incident webhook        Fire to Slack/Teams/PagerDuty if denied or flagged
13. Behavioral analytics    Background: reputation, anomaly, baseline, alerts
```

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/authorize` | Human authorization check |
| POST | `/v1/agent/authorize` | Agent authorization (full pipeline) |
| POST | `/v1/agent/delegate` | Agent-to-agent delegation + JIT token |
| POST | `/v1/simulator/replay` | Replay traces against a proposed policy |
| GET | `/v1/shadow/summary` | Shadow mode outcome buckets |
| POST | `/v1/tokens/mint` | Mint a JIT scoped token |
| DELETE | `/v1/tokens/{id}` | Revoke a token |
| GET | `/v1/queue/pending` | List pending review items |
| GET | `/v1/queue/{id}` | Get a single review item |
| POST | `/v1/queue/{id}/approve` | Approve a review item |
| POST | `/v1/queue/{id}/deny` | Deny a review item |
| GET | `/v1/analytics/reputation/{agentID}` | Agent reputation score |
| GET | `/v1/analytics/reputation` | Top / problematic agents |
| GET | `/v1/analytics/anomalies/{agentID}` | Recent anomalies |
| GET | `/v1/analytics/baseline/{agentID}` | Behavioral baseline + drift |
| POST | `/v1/analytics/baseline/{agentID}/refresh` | Force baseline refresh |
| GET | `/v1/analytics/alerts` | Active alerts |
| POST | `/v1/analytics/alerts/{id}/acknowledge` | Acknowledge alert |
| POST | `/v1/analytics/alerts/{id}/resolve` | Resolve alert |
| GET | `/v1/fallback/status` | Dependency health |
| GET | `/healthz` | Health check |
| GET | `/metrics` | Prometheus metrics |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LISTEN_ADDR` | `:8080` | HTTP listen address |
| `POLICY_PATH` | `/etc/lelu/auth.yaml` | YAML policy file |
| `REGO_POLICY_PATH` | — | OPA/Rego policy file or directory |
| `REGO_POLICY_QUERY` | `data.lelu.authz` | OPA query |
| `JWT_SIGNING_KEY` | — | **Required in production** |
| `API_KEY` | — | **Required in production** |
| `REDIS_ADDR` | — | Redis address (`host:port` or `redis://`) |
| `LELU_MODE` | `enforce` | `enforce` or `shadow` |
| `CONFIDENCE_ALLOW_UNVERIFIED` | `false` | Accept raw float confidence (no provider signal) |
| `CONFIDENCE_MISSING_MODE` | `deny` | `deny`, `review`, or `read_only` |
| `INCIDENT_WEBHOOK_URL` | — | Webhook for incident notifications |
| `INCIDENT_WEBHOOK_SLACK_MODE` | `false` | Format as Slack Block Kit |
| `INCIDENT_WEBHOOK_TEAMS_MODE` | `false` | Format as Teams Adaptive Card |
| `INCIDENT_WEBHOOK_PAGERDUTY_MODE` | `false` | Format as PagerDuty Events v2 |
| `PAGERDUTY_ROUTING_KEY` | — | PagerDuty integration key |
| `LELU_ENGINE_PUBLIC_URL` | — | Public URL for action buttons in notifications |
| `OTEL_ENABLED` | `false` | Enable OpenTelemetry tracing |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `localhost:4317` | OTLP collector endpoint |
| `DATABASE_PATH` | `/var/lib/lelu/lelu.db` | SQLite path for behavioral analytics |
| `BEHAVIORAL_ANALYTICS_ENABLED` | `true` | Enable Phase 2 analytics |
| `FALLBACK_REDIS_MODE` | `closed` | `open` or `closed` on Redis failure |
| `FALLBACK_CP_MODE` | `closed` | `open` or `closed` on control-plane failure |
| `TENANT_AUTH_RATE_LIMIT` | `0` | Auth checks per minute per tenant (0 = unlimited) |
| `CONTROL_PLANE_URL` | — | URL for policy hot-reload |

---

## Implementation status

### Fully implemented

| Component | Files |
|-----------|-------|
| HTTP server + routing | `server/server.go` |
| YAML policy evaluator | `evaluator/evaluator.go` |
| OPA/Rego evaluator (incl. delegation) | `evaluator/rego.go` |
| Confidence gate | `confidence/confidence.go` |
| Confidence signal extraction | `confidence/extract.go` |
| Drift scorer + escalator | `confidence/scorer.go`, `confidence/escalator.go` |
| Prompt injection pre-filter | `injection/detector.go` |
| Risk model (criticality × confidence × reliability × anomaly) | `server/risk.go` |
| Shadow agent detector | `shadow/` (all files) |
| Human-review queue (Redis + in-memory fallback) | `queue/queue.go` |
| JIT token mint / validate / revoke | `tokens/tokens.go` |
| Incident webhooks (Slack, Teams, PagerDuty) | `incident/` |
| Buffered audit log | `audit/audit.go` |
| Fallback strategy (fail-open / fail-closed) | `fallback/fallback.go` |
| Per-tenant rate limiter | `ratelimit/ratelimit.go` |
| Policy hot-reload worker | `sync/sync.go` |
| OpenTelemetry tracing (Phase 1) | `observability/tracer.go`, `telemetry/` |
| Behavioral analytics — reputation | `observability/reputation.go` |
| Behavioral analytics — anomaly detection | `observability/anomaly.go` |
| Behavioral analytics — baseline | `observability/baseline.go` |
| Behavioral analytics — alerting | `observability/alerting.go` |
| Enforcement shadow mode | `server/server.go` (`EnforcementModeShadow`) |
| Policy simulator / replay | `server/server.go` (`handleSimulatorReplay`) |
| S3 audit sink | `audit/s3sink/` |

---

## Outstanding gaps

### High priority

| # | Gap | File(s) | Notes |
|---|-----|---------|-------|
| H1 | `ExternalAuditor.Audit()` always returns 0.75 | `confidence/auditor.go` | Replace `computeDummyExternalScore` with a real Vertex AI / OpenAI call |
| H2 | External audit + escalation not called from server | `server/server.go` | Wire `ExternalAuditor` + `Escalator.EnqueueReview` into `handleAgentAuthorize` (async) |
| H3 | 7 drift-analysis methods in `BaselineManager` are empty stubs | `observability/baseline.go:519–557` | `analyzeConfidenceDrift`, `analyzeLatencyDrift`, `analyzePatternDrift`, etc. always return `"none"` |
| H4 | 11 data-retrieval + model-training methods in `PredictiveAnalytics` are placeholders | `observability/predictive.go:587–634` | All return hardcoded values; training data is never read from DB |
| H5 | Anomaly sequence features never computed | `observability/anomaly.go:279` | `RecentErrorRate`, `ConfidenceTrend`, `LatencyTrend` always 0 in `FeatureVector` |

### Medium priority

| # | Gap | File(s) | Notes |
|---|-----|---------|-------|
| M1 | No user→role assignment mechanism | `evaluator/evaluator.go:144` | `Evaluate()` scans all roles; users should be assigned to specific roles |
| M2 | `actorStats` resets on restart | `server/risk.go:223` | Reliability scores lost; should persist to `agent_decisions` table |
| M3 | `RefreshRegistry` never scheduled | `shadow/detector.go` | Approved shadow agents require restart to take effect |
| M4 | Fallback strategy not applied to auth decision path | `server/server.go` | Only token service consults fallback; auth denials don't |
| M5 | `ExtractCorrelationContext` returns empty strings | `observability/tracer.go:193` | Distributed trace linking is broken |

### Low priority

| # | Gap | File(s) | Notes |
|---|-----|---------|-------|
| L1 | `EvaluateAgent` with no `inherits` implicitly allows all non-denied actions | `evaluator/evaluator.go:205` | Misconfigured scopes silently allow everything |
| L2 | `ProviderAnthropic` uses OpenAI logprob path | `confidence/extract.go:29` | Anthropic API format differs — produces incorrect scores |
| L3 | No migration runner | `engine/cmd/engine/main.go` | `initDatabase` and SQL files in `db/migrations/` can drift |
| L4 | gRPC not wired | `proto/auth.proto` | Proto stub exists but codegen + server wiring not done |

---

## Completed work (session)

| Item | Description |
|------|-------------|
| Shadow detector DB backend | `reporter.go`, `store.go`, `detector.go` — upsert, load approved, initSchema |
| Shadow detector wired to server | `server.go` — called after injection check on every agent authorize |
| Fix `epochMillis()` stub | `confidence/escalator.go` — now uses `time.Now().UnixMilli()` |
| Fix dead `humanReviewQueue` | `confidence/escalator.go` — typed `ReviewEnqueuer` interface + `EnqueueReview` method |
| Fix `NewInMemory()` silent drop | `queue/queue.go` — real `inMemoryStore` backing; all operations work without Redis |
| Fix `CheckDelegation` Rego mode | `evaluator/rego.go` + `evaluator.go` — Rego checked first, YAML fallback |
| Fix `NewFromEnv` duplicate read | `incident/notifier.go` — removed dead backward-compat line |
| Fix duplicate SQL migration | `db/migrations/004_shadow_agents.sql` — duplicate block removed, UNIQUE added |

---

## Database schema summary

SQLite (local/dev via `initDatabase` in `main.go`):

| Table | Purpose |
|-------|---------|
| `agent_reputation` | Reputation scores per agent |
| `behavioral_baselines` | Statistical baselines per agent |
| `anomaly_results` | Anomaly detection history |
| `agent_decisions` | Full decision history for analytics |
| `alerts` | Active/resolved behavioral alerts |
| `shadow_agents` | Detected unregistered agents (status: unreviewed → approved/rejected) |

Postgres migration files in `engine/internal/db/migrations/`:

| File | Description |
|------|-------------|
| `001_*` – `003_*` | Core tables (tenants, policies, etc.) |
| `004_shadow_agents.sql` | Shadow agents table with UNIQUE on `fingerprint_hash` |
