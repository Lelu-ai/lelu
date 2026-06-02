-- Migration: 005_credential_vault.sql
-- Per-(agent_id, user_id, provider) encrypted OAuth credential storage.
-- access_enc and refresh_enc are AES-256-GCM encrypted, base64-encoded blobs.

CREATE TABLE IF NOT EXISTS credential_vault (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    provider    TEXT NOT NULL,     -- "google" | "github" | "slack" | "salesforce" | custom
    access_enc  TEXT NOT NULL,     -- AES-256-GCM encrypted access token
    refresh_enc TEXT,              -- AES-256-GCM encrypted refresh token (nullable)
    scopes      TEXT NOT NULL DEFAULT '',  -- space-separated OAuth scopes
    expires_at  INTEGER,           -- Unix seconds; NULL = non-expiring
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    UNIQUE(agent_id, user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_vault_agent    ON credential_vault(agent_id);
CREATE INDEX IF NOT EXISTS idx_vault_agent_user ON credential_vault(agent_id, user_id);
