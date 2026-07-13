// Package nhi implements the Non-Human Identity (NHI) inventory and risk
// posture layer for Lelu.
//
// It merges three runtime data sources — registered agents, shadow agents, and
// OAuth vault credentials — into a single normalized view, scores each identity
// for risk using OWASP NHI top-10 checks, and exposes that posture via the
// /v1/nhi/* endpoints.
//
// This is Lelu's answer to Okta ISPM: not just "block the bad request at
// runtime" but "here is the risk posture of every non-human identity in
// your org before something goes wrong."
package nhi

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"time"
)

// ── Domain types ──────────────────────────────────────────────────────────────

// NHIType classifies the source of a non-human identity.
type NHIType string

const (
	NHITypeRegisteredAgent NHIType = "registered_agent"
	NHITypeShadowAgent     NHIType = "shadow_agent"
	NHITypeCredential      NHIType = "credential"
)

// NHIStatus reflects the current lifecycle state of the identity.
type NHIStatus string

const (
	NHIStatusActive    NHIStatus = "active"
	NHIStatusShadow    NHIStatus = "shadow" // unregistered, runtime-detected
	NHIStatusSuspended NHIStatus = "suspended"
	NHIStatusRevoked   NHIStatus = "revoked"
	NHIStatusStale     NHIStatus = "stale" // no activity in > 30 days
)

// NHIEntry is a normalized non-human identity record with risk posture.
type NHIEntry struct {
	ID        string         `json:"id"`
	TenantID  string         `json:"tenant_id"`
	Type      NHIType        `json:"type"`
	Name      string         `json:"name"`
	Status    NHIStatus      `json:"status"`
	Scopes    []string       `json:"scopes"`
	RiskScore float64        `json:"risk_score"` // 0.0–1.0
	RiskLevel string         `json:"risk_level"` // "critical" | "high" | "medium" | "low" | "none"
	Findings  []OWASPFinding `json:"findings"`
	LastSeen  time.Time      `json:"last_seen"`
	CreatedAt time.Time      `json:"created_at"`
	// Type-specific fields
	AgentType    string     `json:"agent_type,omitempty"`    // registered_agent
	OwnerEmail   string     `json:"owner_email,omitempty"`   // registered_agent
	Provider     string     `json:"provider,omitempty"`      // credential
	RequestCount int        `json:"request_count,omitempty"` // shadow_agent
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`    // credential
}

// ScanResult summarises a full NHI scan across the org.
type ScanResult struct {
	TenantID      string         `json:"tenant_id"`
	ScannedAt     time.Time      `json:"scanned_at"`
	TotalNHIs     int            `json:"total_nhis"`
	ByType        map[string]int `json:"by_type"`
	ByStatus      map[string]int `json:"by_status"`
	ByRiskLevel   map[string]int `json:"by_risk_level"`
	TopRisks      []*NHIEntry    `json:"top_risks"`
	FindingCounts map[string]int `json:"finding_counts"` // by OWASP check ID
}

// Stats is a lightweight aggregate view of the NHI population.
type Stats struct {
	TenantID    string         `json:"tenant_id"`
	TotalNHIs   int            `json:"total_nhis"`
	ByType      map[string]int `json:"by_type"`
	ByStatus    map[string]int `json:"by_status"`
	ByRiskLevel map[string]int `json:"by_risk_level"`
	GeneratedAt time.Time      `json:"generated_at"`
}

// ── Inventory ─────────────────────────────────────────────────────────────────

// Inventory merges all NHI data sources and exposes the unified posture view.
type Inventory struct {
	db *sql.DB
}

// New creates an Inventory backed by db. The same SQLite database used by the
// rest of the engine (registered_agents, shadow_agents, credential_vault).
func New(db *sql.DB) (*Inventory, error) {
	if db == nil {
		return nil, fmt.Errorf("nhi: db is required")
	}
	return &Inventory{db: db}, nil
}

// List returns all NHIs for a tenant, enriched with OWASP findings and risk
// scores. Pass "" to list across all tenants. Results are sorted risk_score DESC.
func (inv *Inventory) List(ctx context.Context, tenantID string) ([]*NHIEntry, error) {
	var entries []*NHIEntry

	// 1. Registered agents
	registered, err := inv.listRegisteredAgents(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("nhi: list registered agents: %w", err)
	}
	entries = append(entries, registered...)

	// 2. Shadow agents
	shadows, err := inv.listShadowAgents(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("nhi: list shadow agents: %w", err)
	}
	entries = append(entries, shadows...)

	// 3. OAuth vault credentials
	creds, err := inv.listCredentials(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("nhi: list credentials: %w", err)
	}
	entries = append(entries, creds...)

	// Enrich each entry with OWASP findings + risk score.
	for _, e := range entries {
		e.Findings = RunChecks(ctx, inv.db, e)
		e.RiskScore = computeRiskScore(e)
		e.RiskLevel = riskLevel(e.RiskScore)
	}

	// Sort by risk_score descending so the most dangerous NHIs surface first.
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].RiskScore > entries[j].RiskScore
	})

	return entries, nil
}

// Get returns a single NHI by ID, searching across all source tables.
func (inv *Inventory) Get(ctx context.Context, id string) (*NHIEntry, error) {
	// Try registered agents first.
	e, err := inv.getRegisteredAgent(ctx, id)
	if err == nil {
		e.Findings = RunChecks(ctx, inv.db, e)
		e.RiskScore = computeRiskScore(e)
		e.RiskLevel = riskLevel(e.RiskScore)
		return e, nil
	}

	// Try shadow agents.
	e, err = inv.getShadowAgent(ctx, id)
	if err == nil {
		e.Findings = RunChecks(ctx, inv.db, e)
		e.RiskScore = computeRiskScore(e)
		e.RiskLevel = riskLevel(e.RiskScore)
		return e, nil
	}

	// Try vault credentials.
	e, err = inv.getCredential(ctx, id)
	if err == nil {
		e.Findings = RunChecks(ctx, inv.db, e)
		e.RiskScore = computeRiskScore(e)
		e.RiskLevel = riskLevel(e.RiskScore)
		return e, nil
	}

	return nil, fmt.Errorf("nhi: identity %q not found", id)
}

// TopRisks returns the top-N highest-risk NHIs for a tenant.
func (inv *Inventory) TopRisks(ctx context.Context, tenantID string, limit int) ([]*NHIEntry, error) {
	if limit <= 0 {
		limit = 10
	}
	all, err := inv.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if len(all) > limit {
		all = all[:limit]
	}
	return all, nil
}

// Scan runs a full NHI scan for a tenant and returns an aggregated summary.
func (inv *Inventory) Scan(ctx context.Context, tenantID string) (*ScanResult, error) {
	all, err := inv.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	result := &ScanResult{
		TenantID:      tenantID,
		ScannedAt:     time.Now().UTC(),
		TotalNHIs:     len(all),
		ByType:        make(map[string]int),
		ByStatus:      make(map[string]int),
		ByRiskLevel:   make(map[string]int),
		FindingCounts: make(map[string]int),
	}

	for _, e := range all {
		result.ByType[string(e.Type)]++
		result.ByStatus[string(e.Status)]++
		result.ByRiskLevel[e.RiskLevel]++
		for _, f := range e.Findings {
			result.FindingCounts[f.CheckID]++
		}
	}

	// Top 5 risks in the scan summary.
	top := all
	if len(top) > 5 {
		top = top[:5]
	}
	result.TopRisks = top

	return result, nil
}

// Stats returns lightweight aggregate counts without running full checks.
func (inv *Inventory) Stats(ctx context.Context, tenantID string) (*Stats, error) {
	all, err := inv.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	s := &Stats{
		TenantID:    tenantID,
		TotalNHIs:   len(all),
		ByType:      make(map[string]int),
		ByStatus:    make(map[string]int),
		ByRiskLevel: make(map[string]int),
		GeneratedAt: time.Now().UTC(),
	}
	for _, e := range all {
		s.ByType[string(e.Type)]++
		s.ByStatus[string(e.Status)]++
		s.ByRiskLevel[e.RiskLevel]++
	}
	return s, nil
}

// ── Data source queries ───────────────────────────────────────────────────────

func (inv *Inventory) listRegisteredAgents(ctx context.Context, tenantID string) ([]*NHIEntry, error) {
	q := `SELECT id, tenant_id, name, description, agent_type, owner_email, status,
	             scopes, created_at, updated_at
	      FROM registered_agents`
	args := []any{}
	if tenantID != "" {
		q += " WHERE tenant_id = ?"
		args = append(args, tenantID)
	}
	rows, err := inv.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*NHIEntry
	for rows.Next() {
		e, err := scanRegisteredAgent(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (inv *Inventory) getRegisteredAgent(ctx context.Context, id string) (*NHIEntry, error) {
	row := inv.db.QueryRowContext(ctx,
		`SELECT id, tenant_id, name, description, agent_type, owner_email, status,
		        scopes, created_at, updated_at
		 FROM registered_agents WHERE id = ?`, id)
	return scanRegisteredAgent(row)
}

func (inv *Inventory) listShadowAgents(ctx context.Context, tenantID string) ([]*NHIEntry, error) {
	q := `SELECT id, tenant_id, fingerprint_hash, user_agent, status,
	             request_count, first_seen, last_seen
	      FROM shadow_agents`
	args := []any{}
	if tenantID != "" {
		q += " WHERE tenant_id = ?"
		args = append(args, tenantID)
	}
	rows, err := inv.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*NHIEntry
	for rows.Next() {
		e, err := scanShadowAgent(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (inv *Inventory) getShadowAgent(ctx context.Context, id string) (*NHIEntry, error) {
	row := inv.db.QueryRowContext(ctx,
		`SELECT id, tenant_id, fingerprint_hash, user_agent, status,
		        request_count, first_seen, last_seen
		 FROM shadow_agents WHERE id = ?`, id)
	return scanShadowAgent(row)
}

func (inv *Inventory) listCredentials(ctx context.Context, tenantID string) ([]*NHIEntry, error) {
	// credential_vault doesn't have tenant_id directly — join via registered_agents.
	q := `SELECT cv.id, COALESCE(ra.tenant_id, 'default') as tenant_id,
	             cv.agent_id, cv.provider, cv.scopes, cv.expires_at,
	             cv.created_at, cv.updated_at
	      FROM credential_vault cv
	      LEFT JOIN registered_agents ra ON cv.agent_id = ra.id`
	args := []any{}
	if tenantID != "" {
		q += " WHERE COALESCE(ra.tenant_id, 'default') = ?"
		args = append(args, tenantID)
	}
	rows, err := inv.db.QueryContext(ctx, q, args...)
	if err != nil {
		// credential_vault may not exist if vault was never initialized — treat as empty.
		return nil, nil
	}
	defer rows.Close()

	var out []*NHIEntry
	for rows.Next() {
		e, err := scanCredential(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (inv *Inventory) getCredential(ctx context.Context, id string) (*NHIEntry, error) {
	row := inv.db.QueryRowContext(ctx,
		`SELECT cv.id, COALESCE(ra.tenant_id, 'default') as tenant_id,
		        cv.agent_id, cv.provider, cv.scopes, cv.expires_at,
		        cv.created_at, cv.updated_at
		 FROM credential_vault cv
		 LEFT JOIN registered_agents ra ON cv.agent_id = ra.id
		 WHERE cv.id = ?`, id)
	return scanCredential(row)
}

// ── Row scanners ──────────────────────────────────────────────────────────────

type scanner interface {
	Scan(dest ...any) error
}

func scanRegisteredAgent(s scanner) (*NHIEntry, error) {
	var (
		e          NHIEntry
		scopesJSON string
		statusStr  string
		agentType  string
		desc       string
		createdAt  int64
		updatedAt  int64
	)
	if err := s.Scan(
		&e.ID, &e.TenantID, &e.Name, &desc,
		&agentType, &e.OwnerEmail, &statusStr,
		&scopesJSON, &createdAt, &updatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("not found")
		}
		return nil, err
	}
	_ = json.Unmarshal([]byte(scopesJSON), &e.Scopes)
	if e.Scopes == nil {
		e.Scopes = []string{}
	}
	e.Type = NHITypeRegisteredAgent
	e.AgentType = agentType
	e.CreatedAt = time.Unix(createdAt, 0).UTC()
	e.LastSeen = time.Unix(updatedAt, 0).UTC()

	// Map agent status → NHI status; mark stale if no activity in 30 days.
	switch statusStr {
	case "suspended":
		e.Status = NHIStatusSuspended
	case "revoked":
		e.Status = NHIStatusRevoked
	default:
		if time.Since(e.LastSeen) > staleIdentityDays*24*time.Hour {
			e.Status = NHIStatusStale
		} else {
			e.Status = NHIStatusActive
		}
	}
	return &e, nil
}

func scanShadowAgent(s scanner) (*NHIEntry, error) {
	var (
		e            NHIEntry
		fpHash       string
		userAgent    string
		statusStr    string
		firstSeenRaw string
		lastSeenRaw  string
	)
	if err := s.Scan(
		&e.ID, &e.TenantID, &fpHash, &userAgent,
		&statusStr, &e.RequestCount,
		&firstSeenRaw, &lastSeenRaw,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("not found")
		}
		return nil, err
	}
	e.Type = NHITypeShadowAgent
	e.Status = NHIStatusShadow
	e.Name = "shadow:" + fpHash[:min(8, len(fpHash))]
	e.Scopes = []string{}

	// Shadow agent timestamps are stored as strings by SQLite CURRENT_TIMESTAMP.
	if t, err := time.Parse("2006-01-02 15:04:05", firstSeenRaw); err == nil {
		e.CreatedAt = t.UTC()
	} else {
		e.CreatedAt = time.Now().UTC()
	}
	if t, err := time.Parse("2006-01-02 15:04:05", lastSeenRaw); err == nil {
		e.LastSeen = t.UTC()
	} else {
		e.LastSeen = time.Now().UTC()
	}
	return &e, nil
}

func scanCredential(s scanner) (*NHIEntry, error) {
	var (
		e         NHIEntry
		agentID   string
		scopesStr string
		expiresAt sql.NullInt64
		createdAt int64
		updatedAt int64
	)
	if err := s.Scan(
		&e.ID, &e.TenantID, &agentID, &e.Provider,
		&scopesStr, &expiresAt, &createdAt, &updatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("not found")
		}
		return nil, err
	}

	e.Type = NHITypeCredential
	e.Name = e.Provider + " credential for " + agentID
	e.Status = NHIStatusActive
	e.CreatedAt = time.Unix(createdAt, 0).UTC()
	e.LastSeen = time.Unix(updatedAt, 0).UTC()

	// Scopes stored as space-separated string in vault.
	if scopesStr != "" {
		for _, sc := range splitScopes(scopesStr) {
			if sc != "" {
				e.Scopes = append(e.Scopes, sc)
			}
		}
	}
	if e.Scopes == nil {
		e.Scopes = []string{}
	}

	if expiresAt.Valid {
		t := time.Unix(expiresAt.Int64, 0).UTC()
		e.ExpiresAt = &t
		if t.Before(time.Now().UTC()) {
			e.Status = NHIStatusStale
		}
	}
	return &e, nil
}

// ── Risk scoring ──────────────────────────────────────────────────────────────

// computeRiskScore derives a 0.0–1.0 risk score from the OWASP findings,
// with bonuses for shadow agents and stale identities.
func computeRiskScore(e *NHIEntry) float64 {
	if len(e.Findings) == 0 && e.Type != NHITypeShadowAgent {
		return 0.0
	}

	severityWeight := map[string]float64{
		"critical": 1.0,
		"high":     0.7,
		"medium":   0.4,
		"low":      0.15,
	}

	var total, maxPossible float64
	for _, f := range e.Findings {
		w := severityWeight[f.Severity]
		total += w
		if w > maxPossible {
			maxPossible = w
		}
	}

	var score float64
	if len(e.Findings) > 0 {
		// Weighted average, biased toward the worst finding.
		score = (total/float64(len(e.Findings)) + maxPossible) / 2.0
	}

	// Shadow agents start with a base risk since they're unregistered.
	if e.Type == NHITypeShadowAgent {
		score += 0.30
	}
	// Stale identities add risk even if no other findings.
	if e.Status == NHIStatusStale {
		score += 0.15
	}

	if score > 1.0 {
		score = 1.0
	}
	return score
}

// riskLevel converts a 0.0–1.0 score to a human-readable severity label.
func riskLevel(score float64) string {
	switch {
	case score >= 0.8:
		return "critical"
	case score >= 0.55:
		return "high"
	case score >= 0.30:
		return "medium"
	case score > 0.0:
		return "low"
	default:
		return "none"
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func splitScopes(s string) []string {
	var out []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ' ' || s[i] == ',' {
			if i > start {
				out = append(out, s[start:i])
			}
			start = i + 1
		}
	}
	return out
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
