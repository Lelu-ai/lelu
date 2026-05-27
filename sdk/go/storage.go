package lelu

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

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
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			trace_id   TEXT NOT NULL,
			user_id    TEXT,
			key_id     TEXT,
			actor      TEXT NOT NULL,
			action     TEXT NOT NULL,
			decision   TEXT NOT NULL,
			reason     TEXT NOT NULL DEFAULT '',
			rule       TEXT NOT NULL DEFAULT '',
			policy_name TEXT,
			confidence REAL NOT NULL DEFAULT 0,
			latency_ms REAL NOT NULL DEFAULT 0,
			mode       TEXT NOT NULL DEFAULT 'live',
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_audit_trace  ON audit_events(trace_id);
		CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_events(actor, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_audit_ts     ON audit_events(created_at DESC);

		CREATE TABLE IF NOT EXISTS policies (
			id          TEXT PRIMARY KEY,
			user_id     TEXT NOT NULL DEFAULT '',
			name        TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			rules       TEXT NOT NULL DEFAULT '[]',
			is_active   INTEGER NOT NULL DEFAULT 1,
			created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(name)
		);
	`

	_, err := s.db.Exec(schema)
	return err
}

// ─── Audit Events ──────────────────────────────────────────────────────────────

// InsertAuditEvent inserts an audit event into local storage.
func (s *LocalStorage) InsertAuditEvent(event AuditEvent) error {
	var policyName *string
	if event.PolicyName != nil && *event.PolicyName != "" {
		policyName = event.PolicyName
	}

	_, err := s.db.Exec(`
		INSERT INTO audit_events (
			trace_id, user_id, key_id, actor, action, decision,
			reason, rule, policy_name, confidence, latency_ms, mode
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		event.TraceID,
		event.UserID,
		event.KeyID,
		event.Actor,
		event.Action,
		event.Decision,
		event.Reason,
		event.Rule,
		policyName,
		event.Confidence,
		event.LatencyMS,
		event.Mode,
	)

	return err
}

// ListAuditEventsParams holds parameters for listing audit events.
type ListAuditEventsParams struct {
	Limit  int
	Cursor int64
	Actor  string
}

// LocalAuditEventsResult holds the result of listing audit events.
type LocalAuditEventsResult struct {
	Events     []AuditEvent
	Count      int
	NextCursor int64
}

// ListAuditEvents lists audit events from local storage.
func (s *LocalStorage) ListAuditEvents(params ListAuditEventsParams) (*LocalAuditEventsResult, error) {
	if params.Limit == 0 {
		params.Limit = 20
	}

	query := `SELECT id, trace_id, user_id, key_id, actor, action, decision,
		reason, rule, policy_name, confidence, latency_ms, mode, created_at
		FROM audit_events WHERE id > ?`
	args := []interface{}{params.Cursor}

	if params.Actor != "" {
		query += " AND actor = ?"
		args = append(args, params.Actor)
	}

	query += " ORDER BY created_at DESC LIMIT ?"
	args = append(args, params.Limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []AuditEvent
	var lastID int64

	for rows.Next() {
		var e AuditEvent
		err := rows.Scan(
			&e.ID, &e.TraceID, &e.UserID, &e.KeyID, &e.Actor, &e.Action, &e.Decision,
			&e.Reason, &e.Rule, &e.PolicyName, &e.Confidence, &e.LatencyMS, &e.Mode, &e.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		events = append(events, e)
		lastID = e.ID
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	nextCursor := params.Cursor
	if len(events) > 0 {
		nextCursor = lastID
	}

	var count int
	if err := s.db.QueryRow("SELECT COUNT(*) FROM audit_events").Scan(&count); err != nil {
		return nil, err
	}

	return &LocalAuditEventsResult{
		Events:     events,
		Count:      count,
		NextCursor: nextCursor,
	}, nil
}

// ─── Policies ──────────────────────────────────────────────────────────────────

// ListPolicies lists all policies from local storage.
func (s *LocalStorage) ListPolicies() ([]Policy, error) {
	rows, err := s.db.Query(`
		SELECT id, user_id, name, description, rules, is_active, created_at, updated_at
		FROM policies ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var policies []Policy
	for rows.Next() {
		var p Policy
		var rulesJSON string
		var isActive int
		err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.Description, &rulesJSON, &isActive, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		p.IsActive = isActive == 1
		if err := json.Unmarshal([]byte(rulesJSON), &p.Rules); err != nil {
			p.Rules = []PolicyRule{}
		}
		policies = append(policies, p)
	}

	return policies, rows.Err()
}

// GetPolicy retrieves a specific policy from local storage by ID.
func (s *LocalStorage) GetPolicy(id string) (*Policy, error) {
	var p Policy
	var rulesJSON string
	var isActive int

	err := s.db.QueryRow(`
		SELECT id, user_id, name, description, rules, is_active, created_at, updated_at
		FROM policies WHERE id = ?
	`, id).Scan(&p.ID, &p.UserID, &p.Name, &p.Description, &rulesJSON, &isActive, &p.CreatedAt, &p.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	p.IsActive = isActive == 1
	if err := json.Unmarshal([]byte(rulesJSON), &p.Rules); err != nil {
		p.Rules = []PolicyRule{}
	}

	return &p, nil
}

// UpsertPolicy creates or updates a policy in local storage.
func (s *LocalStorage) UpsertPolicy(p Policy) error {
	rulesJSON, err := json.Marshal(p.Rules)
	if err != nil {
		return fmt.Errorf("marshal rules: %w", err)
	}

	isActive := 0
	if p.IsActive {
		isActive = 1
	}

	if p.ID == "" {
		p.ID = fmt.Sprintf("local-%s", p.Name)
	}

	_, err = s.db.Exec(`
		INSERT INTO policies (id, user_id, name, description, rules, is_active, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(name) DO UPDATE SET
			description = excluded.description,
			rules       = excluded.rules,
			is_active   = excluded.is_active,
			updated_at  = CURRENT_TIMESTAMP
	`, p.ID, p.UserID, p.Name, p.Description, string(rulesJSON), isActive)

	return err
}

// DeletePolicy deletes a policy from local storage by ID.
func (s *LocalStorage) DeletePolicy(id string) (bool, error) {
	result, err := s.db.Exec("DELETE FROM policies WHERE id = ?", id)
	if err != nil {
		return false, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}

	return rowsAffected > 0, nil
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

// Close closes the database connection.
func (s *LocalStorage) Close() error {
	return s.db.Close()
}

// GetDBPath returns the database file path.
func (s *LocalStorage) GetDBPath() string {
	return s.dbPath
}
