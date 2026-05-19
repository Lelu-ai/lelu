package shadow

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/google/uuid"
)

// store wraps all shadow_agents DB operations.
type store struct {
	db *sql.DB
}

// upsert inserts a new shadow agent row keyed by fingerprint_hash, or updates
// last_seen, request_count, and endpoints_hit on conflict.
func (s *store) upsert(ctx context.Context, fp, tenantID, userAgent, apiKeyPrefix string, endpoints []string) error {
	endpointsJSON, _ := json.Marshal(endpoints)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO shadow_agents
			(id, tenant_id, fingerprint_hash, user_agent, api_key_prefix, endpoints_hit)
		VALUES
			(?, ?, ?, ?, ?, ?)
		ON CONFLICT(fingerprint_hash) DO UPDATE SET
			last_seen     = CURRENT_TIMESTAMP,
			request_count = request_count + 1,
			endpoints_hit = excluded.endpoints_hit
	`,
		uuid.NewString(),
		tenantID,
		fp,
		userAgent,
		apiKeyPrefix,
		string(endpointsJSON),
	)
	return err
}

// loadApproved returns all fingerprints with status = 'approved' so the
// detector can seed its in-memory registry.
func (s *store) loadApproved(ctx context.Context) (map[string]bool, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT fingerprint_hash FROM shadow_agents WHERE status = 'approved'`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	registry := make(map[string]bool)
	for rows.Next() {
		var fp string
		if err := rows.Scan(&fp); err != nil {
			return nil, err
		}
		registry[fp] = true
	}
	return registry, rows.Err()
}

// initSchema ensures the shadow_agents table exists (SQLite-compatible DDL).
// Call this during DB initialisation; safe to call multiple times.
func initSchema(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS shadow_agents (
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
		CREATE INDEX IF NOT EXISTS idx_shadow_agents_status
			ON shadow_agents(status);
		CREATE INDEX IF NOT EXISTS idx_shadow_agents_tenant
			ON shadow_agents(tenant_id);
	`)
	return err
}
