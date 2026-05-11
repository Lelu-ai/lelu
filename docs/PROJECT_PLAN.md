# Project Plan: Lelu — Updated Project Structure

This document is a canonical, actionable plan describing the updated repository layout, phase 1 priorities, and the new database migration for `shadow_agents`.

## Updated Repository Structure (phase flags included)

```
lelu/
├── .github/
│   └── workflows/                        # (existing) CI/CD pipelines
│       ├── engine.yml                    # Go build + Cloud Run deploy
│       ├── wasm.yml                      # WASM compilation + publish
│       ├── web.yml                       # Next.js deploy
│       └── shadow.yml                    # [NEW] Shadow detector smoke tests
│
├── docs/
│   ├── AUTHORIZATION_FLOW.md             # (existing)
│   ├── DATA_FLOW_COMPLETE.md             # (existing)
│   ├── SHADOW_AGENT_DETECTOR.md          # [NEW] How detection works
│   └── CONFIDENCE_AUDITOR.md             # [NEW] External auditor design
│
... (trimmed for brevity; full plan exists in repository root proposal)
```

## Phase 1 priority order

1. `engine/internal/shadow/` — highest impact, easiest demo
2. `tests/integration/` — needed before any enterprise sales conversation
3. `engine/internal/confidence/` — closes the self-reporting vulnerability
4. `web/app/shadow-agents/` — the CISO demo screen
5. `wasm/shadow_scan.go` — WASM client-side fingerprinting

## New database migration (add to `engine/internal/db/migrations/`)

```sql
CREATE TABLE shadow_agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  fingerprint_hash TEXT NOT NULL,
  user_agent      TEXT,
  api_key_prefix  TEXT,
  first_seen      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count   INTEGER NOT NULL DEFAULT 1,
  risk_score      FLOAT NOT NULL DEFAULT 0.0,
  status          TEXT NOT NULL DEFAULT 'unreviewed',
  endpoints_hit   TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shadow_agents_tenant ON shadow_agents(tenant_id);
CREATE INDEX idx_shadow_agents_status ON shadow_agents(status);
CREATE INDEX idx_shadow_agents_fingerprint ON shadow_agents(fingerprint_hash);
```

Note: `gen_random_uuid()` requires the `pgcrypto` extension or `pgcrypto`-equivalent setup on managed Postgres; add a migration enabling the extension if necessary.

## Verification checklist (minimal)

- Add migration and run it against staging DB
- Implement detector skeleton under `engine/internal/shadow/`
- Add integration tests that simulate shadow traffic
- Add UI page for review and promotion of shadow agents
- Ensure backups, monitoring, and secret management are in place

## Next steps

1. Implement `engine/internal/shadow/` detector with unit tests.  
2. Add `tests/integration/shadow_detection_test.go` and fixtures.  
3. Create UI components under `web/app/shadow-agents/`.  
4. Run migration in staging and validate retention/archival policies.
