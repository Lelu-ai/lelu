# Shadow Agent Detector

Detects AI agents that call the engine without being registered in the approved-agent registry. Detected agents are persisted for human review; approved agents are promoted and no longer flagged.

## Status

Fully implemented. Wired into live traffic on `POST /v1/agent/authorize`.

## Architecture

```
Incoming /v1/agent/authorize request
               │
               ▼
    ┌─────────────────────┐
    │   fingerprinter.go  │  SHA-256( user_agent | api_key_prefix | actor )
    └──────────┬──────────┘
               │ fingerprint hash
               ▼
    ┌─────────────────────┐
    │  registry_diff.go   │  in-memory map[string]bool  (loaded from DB)
    └──────────┬──────────┘
               │
        registered? ──YES──▶  result.IsShadow = false
               │
              NO
               │
               ▼
    ┌─────────────────────┐
    │     reporter.go     │  upsert into shadow_agents table
    └──────────┬──────────┘
               │
               ▼
     result.IsShadow = true
     audit log + Prometheus counter
     (request continues — detection is advisory)
```

## Components

### `fingerprinter.go`
Computes a stable SHA-256 hash from three request fields:

| Field | Source |
|-------|--------|
| `user_agent` | `User-Agent` HTTP header |
| `api_key_prefix` | First 8 chars of the Bearer token |
| `actor` | `actor` field in the JSON body |

The hash is deterministic — the same agent always produces the same fingerprint regardless of request content.

### `registry_diff.go`
Checks whether a fingerprint appears in the in-memory approved-agent set. Returns `false` (unregistered) when the registry is nil.

### `detector.go`
Orchestrates the pipeline. Two constructors:

| Constructor | Use case |
|-------------|----------|
| `New(registry, reporter)` | Tests — pass an in-memory map directly |
| `NewWithDB(db)` | Production — loads approved registry from DB, writes findings to DB |

`RefreshRegistry(ctx)` reloads the approved set from the DB. Call it periodically (e.g. via a background ticker) so newly approved agents are recognised without a restart.

### `reporter.go`
Writes shadow findings to the `shadow_agents` SQLite/Postgres table via `store.upsert()`. On conflict with an existing fingerprint it increments `request_count` and updates `last_seen` and `endpoints_hit`. A nil DB produces a no-op reporter (used in tests).

### `store.go`
DB layer:

| Method | Description |
|--------|-------------|
| `upsert(ctx, fp, …)` | Insert or update a shadow agent row |
| `loadApproved(ctx)` | Load all `status='approved'` fingerprints into memory |
| `initSchema(ctx, db)` | Create `shadow_agents` table if it does not exist |

## Database schema

```sql
CREATE TABLE shadow_agents (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL DEFAULT '',
  fingerprint_hash TEXT NOT NULL UNIQUE,
  user_agent      TEXT NOT NULL DEFAULT '',
  api_key_prefix  TEXT NOT NULL DEFAULT '',
  first_seen      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  request_count   INTEGER NOT NULL DEFAULT 1,
  risk_score      REAL NOT NULL DEFAULT 0.0,
  status          TEXT NOT NULL DEFAULT 'unreviewed',
  endpoints_hit   TEXT NOT NULL DEFAULT '[]',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

`status` lifecycle: `unreviewed` → `approved` | `rejected`

## Server integration

The detector is initialised in `server.New()` when a DB is available and called in `handleAgentAuthorize` immediately after the injection check:

```go
if h.shadowDetector != nil {
    res, _ := h.shadowDetector.Detect(map[string]interface{}{
        "user_agent":     r.Header.Get("User-Agent"),
        "api_key_prefix": apiKeyPrefix(r),
        "actor":          req.Actor,
        "tenant_id":      req.TenantID,
        "endpoint":       r.URL.Path,
    })
    if res.IsShadow {
        shadowAgentsDetectedTotal.Inc()          // Prometheus
        h.audit.LogDecision(…)                   // Audit trail
    }
}
```

Detection is **advisory** — a shadow agent is logged and counted but the request is not blocked. Blocking is a human decision made via the review UI after inspecting the agent's record.

## Observability

| Signal | Name |
|--------|------|
| Prometheus counter | `lelu_shadow_agents_detected_total` |
| Audit log | Decision with reason `"shadow agent detected: unregistered fingerprint: <hash>"` |

## Security notes

- Fingerprint data is operational telemetry; do not store PII in the hash inputs.
- The first 8 chars of the Bearer token (`api_key_prefix`) identify the key without leaking it.
- Rate-limit detection publishing if the shadow_agents table grows very large; add a background archival job for old `rejected` rows.

## Known gaps

- `RefreshRegistry` is not yet called on a background ticker — approved agents require a restart to be recognised. Add a `time.NewTicker` in `server.New()`.
- No Postgres migration runner: `initSchema` creates the SQLite schema; the Postgres migration is `engine/internal/db/migrations/004_shadow_agents.sql`.
