package lelu

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

// LocalStorage provides SQLite-based local storage for audit logs and policies.
// Automatically creates ~/.lelu/lelu.db on first use.
type LocalStorage struct {
	db     *sql.DB
	dbPath string
}

// NewLocalStorage creates a new LocalStorage instance.
// If dbPath is empty, defaults to ~/.lelu/lelu.db
func NewLocalStorage(dbPath string) (*LocalStorage, error) {
	if dbPath == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("get home dir: %w", err)
		}
		leluDir := filepath.Join(homeDir, ".lelu")
		if err := os.MkdirAll(leluDir, 0755); err != nil {
			return nil, fmt.Errorf("create .lelu dir: %w", err)
		}
		dbPath = filepath.Join(leluDir, "lelu.db")
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	storage := &LocalStorage{
		db:     db,
		dbPath: dbPath,
	}

	if err := storage.initialize(); err != nil {
		db.Close()
		return nil, err
	}

	return storage, nil
}

func (s *LocalStorage) initialize() error {
	schema := `
		CREATE TABLE IF NOT EXISTS audit_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			tenant_id TEXT NOT NULL DEFAULT 'default',
			trace_id TEXT NOT NULL,
			timestamp TEXT NOT NULL,
			actor TEXT NOT NULL,
			action TEXT NOT NULL,
			resource TEXT,
			confidence_score REAL,
			decision TEXT NOT NULL,
			reason TEXT,
			downgraded_scope TEXT,
			latency_ms REAL,
			engine_version TEXT,
			policy_version TEXT,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_audit_tenant_trace ON audit_events(tenant_id, trace_id);
		CREATE INDEX IF NOT EXISTS idx_audit_tenant_actor ON audit_events(tenant_id, actor, timestamp DESC);
		CREATE INDEX IF NOT EXISTS idx_audit_tenant_ts ON audit_events(tenant_id, timestamp DESC);

		CREATE TABLE IF NOT EXISTS policies (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL DEFAULT 'default',
			name TEXT NOT NULL,
			content TEXT NOT NULL,
			version TEXT NOT NULL DEFAULT '1.0',
			hmac_sha256 TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(tenant_id, name)
		);
	`

	_, err := s.db.Exec(schema)
	return err
}

// ─── Audit Events ─────────────────────────────────────────────────────────

// InsertAuditEvent inserts an audit event into local storage.
func (s *LocalStorage) InsertAuditEvent(event map[string]interface{}) error {
	tenantID := "default"
	if tid, ok := event["tenant_id"].(string); ok {
		tenantID = tid
	}

	var resourceJSON *string
	if resource := event["resource"]; resource != nil {
		data, err := json.Marshal(resource)
		if err != nil {
			return fmt.Errorf("marshal resource: %w", err)
		}
		str := string(data)
		resourceJSON = &str
	}

	_, err := s.db.Exec(`
		INSERT INTO audit_events (
			tenant_id, trace_id, timestamp, actor, action, resource,
			confidence_score, decision, reason, downgraded_scope,
			latency_ms, engine_version, policy_version
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		tenantID,
		event["trace_id"],
		event["timestamp"],
		event["actor"],
		event["action"],
		resourceJSON,
		event["confidence_score"],
		event["decision"],
		event["reason"],
		event["downgraded_scope"],
		event["latency_ms"],
		event["engine_version"],
		event["policy_version"],
	)

	return err
}

// ListAuditEventsParams holds parameters for listing audit events.
type ListAuditEventsParams struct {
	TenantID string
	Limit    int
	Cursor   int64
	Actor    string
}

// ListAuditEventsResult holds the result of listing audit events.
type LocalAuditEventsResult struct {
	Events     []map[string]interface{}
	Count      int
	NextCursor int64
}

// ListAuditEvents lists audit events from local storage.
func (s *LocalStorage) ListAuditEvents(params ListAuditEventsParams) (*LocalAuditEventsResult, error) {
	if params.TenantID == "" {
		params.TenantID = "default"
	}
	if params.Limit == 0 {
		params.Limit = 20
	}

	query := `
		SELECT * FROM audit_events
		WHERE tenant_id = ? AND id > ?
	`
	args := []interface{}{params.TenantID, params.Cursor}

	if params.Actor != "" {
		query += " AND actor = ?"
		args = append(args, params.Actor)
	}

	query += " ORDER BY timestamp DESC LIMIT ?"
	args = append(args, params.Limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []map[string]interface{}
	var lastID int64

	for rows.Next() {
		var (
			id                                                                 int64
			tenantID, traceID, timestamp, actor, action, decision              string
			resourceJSON, reason, downgradedScope, engineVersion, policyVersion *string
			confidenceScore, latencyMs                                         *float64
			createdAt                                                          string
		)

		err := rows.Scan(
			&id, &tenantID, &traceID, &timestamp, &actor, &action,
			&resourceJSON, &confidenceScore, &decision, &reason,
			&downgradedScope, &latencyMs, &engineVersion, &policyVersion, &createdAt,
		)
		if err != nil {
			return nil, err
		}

		event := map[string]interface{}{
			"id":         id,
			"tenant_id":  tenantID,
			"trace_id":   traceID,
			"timestamp":  timestamp,
			"actor":      actor,
			"action":     action,
			"decision":   decision,
			"created_at": createdAt,
		}

		if resourceJSON != nil {
			var resource interface{}
			if err := json.Unmarshal([]byte(*resourceJSON), &resource); err == nil {
				event["resource"] = resource
			}
		}
		if confidenceScore != nil {
			event["confidence_score"] = *confidenceScore
		}
		if reason != nil {
			event["reason"] = *reason
		}
		if downgradedScope != nil {
			event["downgraded_scope"] = *downgradedScope
		}
		if latencyMs != nil {
			event["latency_ms"] = *latencyMs
		}
		if engineVersion != nil {
			event["engine_version"] = *engineVersion
		}
		if policyVersion != nil {
			event["policy_version"] = *policyVersion
		}

		events = append(events, event)
		lastID = id
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	nextCursor := params.Cursor
	if len(events) > 0 {
		nextCursor = lastID
	}

	var count int
	err = s.db.QueryRow("SELECT COUNT(*) FROM audit_events WHERE tenant_id = ?", params.TenantID).Scan(&count)
	if err != nil {
		return nil, err
	}

	return &LocalAuditEventsResult{
		Events:     events,
		Count:      count,
		NextCursor: nextCursor,
	}, nil
}

// ─── Policies ─────────────────────────────────────────────────────────────

// ListPolicies lists all policies from local storage.
func (s *LocalStorage) ListPolicies(tenantID string) ([]Policy, error) {
	if tenantID == "" {
		tenantID = "default"
	}

	rows, err := s.db.Query("SELECT * FROM policies WHERE tenant_id = ? ORDER BY name", tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var policies []Policy
	for rows.Next() {
		var p Policy
		err := rows.Scan(&p.ID, &p.TenantID, &p.Name, &p.Content, &p.Version, &p.HMACSha256, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		policies = append(policies, p)
	}

	return policies, rows.Err()
}

// GetPolicy retrieves a specific policy from local storage.
func (s *LocalStorage) GetPolicy(name, tenantID string) (*Policy, error) {
	if tenantID == "" {
		tenantID = "default"
	}

	var p Policy
	err := s.db.QueryRow(
		"SELECT * FROM policies WHERE tenant_id = ? AND name = ?",
		tenantID, name,
	).Scan(&p.ID, &p.TenantID, &p.Name, &p.Content, &p.Version, &p.HMACSha256, &p.CreatedAt, &p.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &p, nil
}

// UpsertPolicy creates or updates a policy in local storage.
func (s *LocalStorage) UpsertPolicy(name, content, version, tenantID string) error {
	if tenantID == "" {
		tenantID = "default"
	}
	if version == "" {
		version = "1.0"
	}

	hash := sha256.Sum256([]byte(content))
	hmacSha256 := hex.EncodeToString(hash[:])
	id := fmt.Sprintf("%d-%s", time.Now().UnixMilli(), name)

	_, err := s.db.Exec(`
		INSERT INTO policies (id, tenant_id, name, content, version, hmac_sha256, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(tenant_id, name) DO UPDATE SET
			content = excluded.content,
			version = excluded.version,
			hmac_sha256 = excluded.hmac_sha256,
			updated_at = CURRENT_TIMESTAMP
	`, id, tenantID, name, content, version, hmacSha256)

	return err
}

// DeletePolicy deletes a policy from local storage.
func (s *LocalStorage) DeletePolicy(name, tenantID string) (bool, error) {
	if tenantID == "" {
		tenantID = "default"
	}

	result, err := s.db.Exec("DELETE FROM policies WHERE tenant_id = ? AND name = ?", tenantID, name)
	if err != nil {
		return false, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}

	return rowsAffected > 0, nil
}

// ─── Utilities ────────────────────────────────────────────────────────────

// Close closes the database connection.
func (s *LocalStorage) Close() error {
	return s.db.Close()
}

// GetDBPath returns the database file path.
func (s *LocalStorage) GetDBPath() string {
	return s.dbPath
}
