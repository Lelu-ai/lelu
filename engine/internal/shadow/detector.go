package shadow

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
)

// Detector orchestrates shadow detection: fingerprinting, registry diff, and reporting.
type Detector struct {
	mu       sync.RWMutex
	registry map[string]bool
	reporter *Reporter
	db       *sql.DB
}

// New returns a Detector backed by an in-memory registry (used in tests).
func New(registry map[string]bool, reporter *Reporter) *Detector {
	if reporter == nil {
		reporter = NewReporter(nil)
	}
	return &Detector{
		registry: registry,
		reporter: reporter,
	}
}

// NewWithDB returns a Detector that loads its approved-agent registry from db
// and persists new shadow findings back to db.
func NewWithDB(db *sql.DB) (*Detector, error) {
	if err := initSchema(context.Background(), db); err != nil {
		return nil, fmt.Errorf("shadow: init schema: %w", err)
	}
	s := &store{db: db}
	registry, err := s.loadApproved(context.Background())
	if err != nil {
		return nil, fmt.Errorf("shadow: load registry: %w", err)
	}
	return &Detector{
		registry: registry,
		reporter: NewReporter(db),
		db:       db,
	}, nil
}

// RefreshRegistry reloads the approved-agent set from db. Call periodically
// so newly approved agents are recognised without a restart.
func (d *Detector) RefreshRegistry(ctx context.Context) error {
	if d.db == nil {
		return nil
	}
	s := &store{db: d.db}
	registry, err := s.loadApproved(ctx)
	if err != nil {
		return fmt.Errorf("shadow: refresh registry: %w", err)
	}
	d.mu.Lock()
	d.registry = registry
	d.mu.Unlock()
	return nil
}

// DetectionResult holds the outcome of a single shadow-detection check.
type DetectionResult struct {
	Fingerprint string
	IsShadow    bool
	Reason      string
}

// Detect computes a fingerprint for req, checks whether it appears in the
// approved registry, and — if it does not — persists the finding via the
// reporter for later human review.
//
// Keys consulted in req: user_agent, api_key_prefix, actor (for fingerprint);
// tenant_id, endpoint (stored in the DB record).
func (d *Detector) Detect(req map[string]interface{}) (*DetectionResult, error) {
	fp := Fingerprint(req)

	d.mu.RLock()
	registered := IsRegistered(fp, d.registry)
	d.mu.RUnlock()

	result := &DetectionResult{
		Fingerprint: fp,
		IsShadow:    !registered,
	}

	if !registered {
		result.Reason = fmt.Sprintf("unregistered fingerprint: %s", fp)
		if err := d.reporter.Report(fp, req); err != nil {
			return result, fmt.Errorf("report shadow: %w", err)
		}
	} else {
		result.Reason = "fingerprint registered"
	}

	return result, nil
}
