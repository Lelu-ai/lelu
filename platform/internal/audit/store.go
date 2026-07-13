// Package audit implements SOC 2-ready persistent audit log storage.
//
// All events written here are immutable (no UPDATE/DELETE). The BigSerial
// primary key provides a tamper-evident sequence number for forensic ordering.
package audit

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// Event is a single immutable authorization decision record.
type Event struct {
	ID              int64             `json:"id"`
	TenantID        string            `json:"tenant_id"`
	TraceID         string            `json:"trace_id"`
	Timestamp       time.Time         `json:"timestamp"`
	Actor           string            `json:"actor"`
	Action          string            `json:"action"`
	Resource        map[string]string `json:"resource,omitempty"`
	ConfidenceScore float64           `json:"confidence_score,omitempty"`
	Decision        string            `json:"decision"` // "allowed" | "denied" | "human_review"
	Reason          string            `json:"reason,omitempty"`
	DowngradedScope string            `json:"downgraded_scope,omitempty"`
	LatencyMS       float64           `json:"latency_ms"`
	EngineVersion   string            `json:"engine_version,omitempty"`
	PolicyVersion   string            `json:"policy_version,omitempty"`
	CreatedAt       time.Time         `json:"created_at"`
}

// QueryFilter filters the audit log query.
type QueryFilter struct {
	TenantID string
	Actor    string
	Action   string
	Decision string
	TraceID  string
	From     *time.Time
	To       *time.Time
	Limit    int64
	Offset   int64
}

// Store persists audit events to Postgres.
type Store struct {
	db *sql.DB
}

// New returns a Store.
func New(db *sql.DB) *Store { return &Store{db: db} }

// Append writes an immutable audit event. Returns the assigned sequence ID.
func (s *Store) Append(e Event) (int64, error) {
	res, err := json.Marshal(e.Resource)
	if err != nil {
		return 0, fmt.Errorf("audit: marshal resource: %w", err)
	}

	var id int64
	err = s.db.QueryRow(`
		INSERT INTO audit_events
			(tenant_id, trace_id, timestamp, actor, action, resource, confidence_score,
			 decision, reason, downgraded_scope, latency_ms, engine_version, policy_version)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		RETURNING id
	`,
		e.TenantID, e.TraceID, e.Timestamp, e.Actor, e.Action,
		string(res), e.ConfidenceScore,
		e.Decision, e.Reason, e.DowngradedScope, e.LatencyMS,
		e.EngineVersion, e.PolicyVersion,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("audit: append: %w", err)
	}
	return id, nil
}

// Query returns audit events matching the filter, newest first.
func (s *Store) Query(f QueryFilter) ([]Event, error) {
	if f.Limit <= 0 {
		f.Limit = 50
	}
	if f.Limit > 500 {
		f.Limit = 500
	}

	q := `SELECT id, tenant_id, trace_id, timestamp, actor, action, resource,
		         confidence_score, decision, reason, downgraded_scope,
		         latency_ms, engine_version, policy_version, created_at
		  FROM audit_events WHERE 1=1`
	args := []any{}
	n := 1

	if f.TenantID != "" {
		q += fmt.Sprintf(" AND tenant_id = $%d", n)
		args = append(args, f.TenantID)
		n++
	}
	if f.Actor != "" {
		q += fmt.Sprintf(" AND actor = $%d", n)
		args = append(args, f.Actor)
		n++
	}
	if f.Action != "" {
		q += fmt.Sprintf(" AND action = $%d", n)
		args = append(args, f.Action)
		n++
	}
	if f.Decision != "" {
		q += fmt.Sprintf(" AND decision = $%d", n)
		args = append(args, f.Decision)
		n++
	}
	if f.TraceID != "" {
		q += fmt.Sprintf(" AND trace_id = $%d", n)
		args = append(args, f.TraceID)
		n++
	}
	if f.From != nil {
		q += fmt.Sprintf(" AND timestamp >= $%d", n)
		args = append(args, *f.From)
		n++
	}
	if f.To != nil {
		q += fmt.Sprintf(" AND timestamp <= $%d", n)
		args = append(args, *f.To)
		n++
	}
	q += fmt.Sprintf(" ORDER BY id DESC LIMIT $%d OFFSET $%d", n, n+1)
	args = append(args, f.Limit, f.Offset)

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("audit: query: %w", err)
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var e Event
		var resourceJSON string
		var confidenceScore sql.NullFloat64
		var engineVer, policyVer, reason, downgradedScope sql.NullString
		if err := rows.Scan(
			&e.ID, &e.TenantID, &e.TraceID, &e.Timestamp, &e.Actor, &e.Action,
			&resourceJSON, &confidenceScore, &e.Decision,
			&reason, &downgradedScope, &e.LatencyMS,
			&engineVer, &policyVer, &e.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("audit: scan: %w", err)
		}
		if confidenceScore.Valid {
			e.ConfidenceScore = confidenceScore.Float64
		}
		if reason.Valid {
			e.Reason = reason.String
		}
		if downgradedScope.Valid {
			e.DowngradedScope = downgradedScope.String
		}
		if engineVer.Valid {
			e.EngineVersion = engineVer.String
		}
		if policyVer.Valid {
			e.PolicyVersion = policyVer.String
		}
		if resourceJSON != "" && resourceJSON != "null" {
			_ = json.Unmarshal([]byte(resourceJSON), &e.Resource)
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

// GetByTraceID returns all events for a given trace, ordered by sequence ID.
func (s *Store) GetByTraceID(traceID string) ([]Event, error) {
	return s.Query(QueryFilter{TraceID: traceID, Limit: 500})
}
