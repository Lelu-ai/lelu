-- Migration: 004_shadow_agents.sql
-- Adds a table to store detected shadow agents for review and analytics.

CREATE TABLE IF NOT EXISTS shadow_agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  fingerprint_hash TEXT NOT NULL UNIQUE,
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

CREATE INDEX IF NOT EXISTS idx_shadow_agents_tenant      ON shadow_agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shadow_agents_status      ON shadow_agents(status);
CREATE INDEX IF NOT EXISTS idx_shadow_agents_fingerprint ON shadow_agents(fingerprint_hash);
