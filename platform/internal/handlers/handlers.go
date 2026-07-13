// Package handlers wires all cloud control plane HTTP endpoints.
package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	auditstore "github.com/lelu/platform/internal/audit"
	"github.com/lelu/platform/internal/policy"
)

// ─── Handler ──────────────────────────────────────────────────────────────────

// Handler holds all control-plane HTTP handlers.
type Handler struct {
	policies           *policy.Store
	audit              *auditstore.Store
	apiKey             string // SHA-256 of the real key stored in memory
	oidcAuth           *OIDCAuth
	trustedHeader      string
	trustedDomain      string
	evidenceSigningKey string
}

// New returns a Handler.
func New(policies *policy.Store, audit *auditstore.Store, apiKey string, oidcAuth *OIDCAuth, trustedHeader, trustedDomain, evidenceSigningKey string) *Handler {
	hash := sha256.Sum256([]byte(apiKey))
	return &Handler{
		policies:           policies,
		audit:              audit,
		apiKey:             hex.EncodeToString(hash[:]),
		oidcAuth:           oidcAuth,
		trustedHeader:      trustedHeader,
		trustedDomain:      strings.ToLower(strings.TrimSpace(trustedDomain)),
		evidenceSigningKey: evidenceSigningKey,
	}
}

// RegisterRoutes attaches all routes to mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// Health
	mux.HandleFunc("GET /healthz", h.handleHealth)

	// Policies (requires API key)
	mux.HandleFunc("GET /api/v1/policies", h.auth(h.handleListPolicies))
	mux.HandleFunc("GET /api/v1/policies/{name}", h.auth(h.handleGetPolicy))
	mux.HandleFunc("PUT /api/v1/policies/{name}", h.auth(h.handleUpsertPolicy))
	mux.HandleFunc("DELETE /api/v1/policies/{name}", h.auth(h.handleDeletePolicy))

	// Audit / Trace Explorer (requires API key)
	mux.HandleFunc("GET /api/v1/audit", h.auth(h.handleListAudit))
	mux.HandleFunc("GET /api/v1/audit/trace/{traceID}", h.auth(h.handleGetTrace))
	mux.HandleFunc("GET /api/v1/compliance/export", h.auth(h.handleComplianceExport))

	// Ingest — called by engine sidecar (requires API key)
	mux.HandleFunc("POST /api/v1/audit/ingest", h.auth(h.handleIngestAudit))
}

// ─── Health ──────────────────────────────────────────────────────────────────

func (h *Handler) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "lelu-platform"})
}

// ─── Policies ─────────────────────────────────────────────────────────────────

func (h *Handler) handleListPolicies(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	list, err := h.policies.List(tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"policies": list, "count": len(list)})
}

func (h *Handler) handleGetPolicy(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	p, err := h.policies.Get(tenantID, r.PathValue("name"))
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, p)
}

type upsertPolicyRequest struct {
	Content string `json:"content"`
	Version string `json:"version"`
}

func (h *Handler) handleUpsertPolicy(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	var req upsertPolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.Content == "" {
		writeError(w, http.StatusBadRequest, "content is required")
		return
	}
	if req.Version == "" {
		req.Version = "1.0"
	}
	p, err := h.policies.Upsert(tenantID, r.PathValue("name"), req.Content, req.Version)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *Handler) handleDeletePolicy(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if err := h.policies.Delete(tenantID, r.PathValue("name")); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

// ─── Audit / Trace Explorer ───────────────────────────────────────────────────

func (h *Handler) handleListAudit(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	q := r.URL.Query()
	limit, cursor, err := parsePagination(q.Get("limit"), q.Get("cursor"), defaultAuditPageLimit, maxAuditPageLimit)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	filter := auditstore.QueryFilter{
		TenantID: tenantID,
		Actor:    q.Get("actor"),
		Action:   q.Get("action"),
		Decision: q.Get("decision"),
		TraceID:  q.Get("trace_id"),
		Limit:    limit,
		Offset:   cursor,
	}
	if from := q.Get("from"); from != "" {
		t, err := time.Parse(time.RFC3339, from)
		if err == nil {
			filter.From = &t
		}
	}
	if to := q.Get("to"); to != "" {
		t, err := time.Parse(time.RFC3339, to)
		if err == nil {
			filter.To = &t
		}
	}

	events, err := h.audit.Query(filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	nextCursor := int64(0)
	if int64(len(events)) == limit {
		nextCursor = cursor + int64(len(events))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"events":      events,
		"count":       len(events),
		"limit":       limit,
		"cursor":      cursor,
		"next_cursor": nextCursor,
	})
}

func (h *Handler) handleGetTrace(w http.ResponseWriter, r *http.Request) {
	events, err := h.audit.GetByTraceID(r.PathValue("traceID"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"trace_id": r.PathValue("traceID"), "events": events})
}

func (h *Handler) handleIngestAudit(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	var e auditstore.Event
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if e.TenantID == "" {
		e.TenantID = tenantID
	}
	if e.Timestamp.IsZero() {
		e.Timestamp = time.Now().UTC()
	}
	id, err := h.audit.Append(e)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

type complianceFramework string

const (
	frameworkOWASPGenAI complianceFramework = "owasp_genai"
	frameworkNISTAIRMF  complianceFramework = "nist_ai_rmf"
)

type complianceControlSummary struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	EventCount  int      `json:"event_count"`
	SampleTrace []string `json:"sample_trace_ids"`
}

type complianceExportResponse struct {
	Framework   string                     `json:"framework"`
	TenantID    string                     `json:"tenant_id"`
	GeneratedAt string                     `json:"generated_at"`
	From        string                     `json:"from,omitempty"`
	To          string                     `json:"to,omitempty"`
	TotalEvents int                        `json:"total_events"`
	Controls    []complianceControlSummary `json:"controls"`
	Evidence    complianceEvidenceMetadata `json:"evidence"`
}

type complianceEvidenceMetadata struct {
	ChecksumSHA256 string `json:"checksum_sha256"`
	Signature      string `json:"signature,omitempty"`
	Signed         bool   `json:"signed"`
	Signer         string `json:"signer,omitempty"`
	Algorithm      string `json:"algorithm"`
}

const (
	defaultAuditPageLimit      int64 = 50
	maxAuditPageLimit          int64 = 500
	defaultCompliancePageLimit int64 = 500
	maxCompliancePageLimit     int64 = 2000
)

func (h *Handler) handleComplianceExport(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	q := r.URL.Query()
	limit, cursor, err := parsePagination(q.Get("limit"), q.Get("cursor"), defaultCompliancePageLimit, maxCompliancePageLimit)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	framework := parseComplianceFramework(q.Get("framework"))
	if framework == "" {
		writeError(w, http.StatusBadRequest, "framework must be one of: owasp_genai, nist_ai_rmf, all")
		return
	}

	filter := auditstore.QueryFilter{
		TenantID: tenantID,
		Limit:    limit,
		Offset:   cursor,
	}
	if from := q.Get("from"); from != "" {
		t, err := time.Parse(time.RFC3339, from)
		if err != nil {
			writeError(w, http.StatusBadRequest, "from must be RFC3339")
			return
		}
		filter.From = &t
	}
	if to := q.Get("to"); to != "" {
		t, err := time.Parse(time.RFC3339, to)
		if err != nil {
			writeError(w, http.StatusBadRequest, "to must be RFC3339")
			return
		}
		filter.To = &t
	}

	events, err := h.audit.Query(filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	resp := complianceExportResponse{
		Framework:   string(framework),
		TenantID:    tenantID,
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		TotalEvents: len(events),
		Controls:    summarizeControls(framework, events),
	}
	if filter.From != nil {
		resp.From = filter.From.Format(time.RFC3339)
	}
	if filter.To != nil {
		resp.To = filter.To.Format(time.RFC3339)
	}
	resp.Evidence = buildComplianceEvidence(resp, h.evidenceSigningKey)
	nextCursor := int64(0)
	if int64(len(events)) == limit {
		nextCursor = cursor + int64(len(events))
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"export":      resp,
		"limit":       limit,
		"cursor":      cursor,
		"next_cursor": nextCursor,
	})
}

func parsePagination(limitRaw, cursorRaw string, defaultLimit, maxLimit int64) (int64, int64, error) {
	limit := defaultLimit
	cursor := int64(0)

	if strings.TrimSpace(limitRaw) != "" {
		v, err := strconv.ParseInt(strings.TrimSpace(limitRaw), 10, 64)
		if err != nil || v <= 0 {
			return 0, 0, httpErrorf("limit must be a positive integer")
		}
		if v > maxLimit {
			v = maxLimit
		}
		limit = v
	}

	if strings.TrimSpace(cursorRaw) != "" {
		v, err := strconv.ParseInt(strings.TrimSpace(cursorRaw), 10, 64)
		if err != nil || v < 0 {
			return 0, 0, httpErrorf("cursor must be a non-negative integer")
		}
		cursor = v
	}

	return limit, cursor, nil
}

func httpErrorf(msg string) error {
	return &handlerError{msg: msg}
}

type handlerError struct {
	msg string
}

func (e *handlerError) Error() string {
	return e.msg
}

func buildComplianceEvidence(resp complianceExportResponse, signingKey string) complianceEvidenceMetadata {
	payload := struct {
		Framework   string                     `json:"framework"`
		TenantID    string                     `json:"tenant_id"`
		GeneratedAt string                     `json:"generated_at"`
		From        string                     `json:"from,omitempty"`
		To          string                     `json:"to,omitempty"`
		TotalEvents int                        `json:"total_events"`
		Controls    []complianceControlSummary `json:"controls"`
	}{
		Framework:   resp.Framework,
		TenantID:    resp.TenantID,
		GeneratedAt: resp.GeneratedAt,
		From:        resp.From,
		To:          resp.To,
		TotalEvents: resp.TotalEvents,
		Controls:    resp.Controls,
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return complianceEvidenceMetadata{Algorithm: "sha256"}
	}
	hash := sha256.Sum256(raw)
	checksum := hex.EncodeToString(hash[:])

	evidence := complianceEvidenceMetadata{
		ChecksumSHA256: checksum,
		Signed:         false,
		Algorithm:      "sha256",
	}

	key := strings.TrimSpace(signingKey)
	if key == "" {
		return evidence
	}

	m := hmac.New(sha256.New, []byte(key))
	_, _ = m.Write(raw)
	sig := m.Sum(nil)
	evidence.Signature = hex.EncodeToString(sig)
	evidence.Signed = true
	evidence.Signer = "platform-hmac"
	evidence.Algorithm = "hmac-sha256"
	return evidence
}

func parseComplianceFramework(value string) complianceFramework {
	v := strings.ToLower(strings.TrimSpace(value))
	switch v {
	case "", "all":
		return complianceFramework("all")
	case string(frameworkOWASPGenAI):
		return frameworkOWASPGenAI
	case string(frameworkNISTAIRMF):
		return frameworkNISTAIRMF
	default:
		return ""
	}
}

func summarizeControls(framework complianceFramework, events []auditstore.Event) []complianceControlSummary {
	type bucket struct {
		title    string
		count    int
		traces   []string
		traceSet map[string]struct{}
	}

	buckets := make(map[string]*bucket)

	add := func(id, title, traceID string) {
		b, ok := buckets[id]
		if !ok {
			b = &bucket{title: title, traceSet: make(map[string]struct{})}
			buckets[id] = b
		}
		b.count++
		if traceID != "" {
			if _, seen := b.traceSet[traceID]; !seen && len(b.traces) < 10 {
				b.traceSet[traceID] = struct{}{}
				b.traces = append(b.traces, traceID)
			}
		}
	}

	for _, e := range events {
		controls := mapEventToControls(framework, e)
		for _, c := range controls {
			add(c.ID, c.Title, e.TraceID)
		}
	}

	ids := make([]string, 0, len(buckets))
	for id := range buckets {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	out := make([]complianceControlSummary, 0, len(ids))
	for _, id := range ids {
		b := buckets[id]
		out = append(out, complianceControlSummary{
			ID:          id,
			Title:       b.title,
			EventCount:  b.count,
			SampleTrace: b.traces,
		})
	}
	return out
}

type controlRef struct {
	ID    string
	Title string
}

func mapEventToControls(framework complianceFramework, e auditstore.Event) []controlRef {
	refs := make([]controlRef, 0, 4)
	addOWASP := framework == frameworkOWASPGenAI || framework == complianceFramework("all")
	addNIST := framework == frameworkNISTAIRMF || framework == complianceFramework("all")

	if addOWASP {
		if e.Decision == "denied" {
			refs = append(refs, controlRef{ID: "OWASP-LLM01", Title: "Prompt Injection Controls"})
		}
		if e.Decision == "human_review" {
			refs = append(refs, controlRef{ID: "OWASP-LLM06", Title: "Sensitive Action Approval"})
		}
		if e.Decision == "denied" || e.Decision == "human_review" {
			refs = append(refs, controlRef{ID: "OWASP-LLM08", Title: "Excessive Agency Mitigation"})
		}
	}

	if addNIST {
		if e.Decision == "denied" {
			refs = append(refs, controlRef{ID: "NIST-AI-RMF-MAP-2.3", Title: "Risk-Based Decision Controls"})
		}
		if e.Decision == "human_review" {
			refs = append(refs, controlRef{ID: "NIST-AI-RMF-GOV-1.6", Title: "Human Oversight Procedures"})
		}
		if e.Decision == "allowed" || e.Decision == "denied" || e.Decision == "human_review" {
			refs = append(refs, controlRef{ID: "NIST-AI-RMF-MEASURE-2.11", Title: "Decision Logging and Traceability"})
		}
	}

	return refs
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

func (h *Handler) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw := r.Header.Get("Authorization")
		raw = strings.TrimPrefix(raw, "Bearer ")
		if raw == "" {
			writeError(w, http.StatusUnauthorized, "missing Authorization header")
			return
		}
		got := sha256.Sum256([]byte(raw))
		gotHex := hex.EncodeToString(got[:])
		if subtle.ConstantTimeCompare([]byte(gotHex), []byte(h.apiKey)) != 1 {
			if h.oidcAuth != nil {
				if err := h.oidcAuth.Verify(r.Context(), raw); err == nil {
					next(w, r)
					return
				}
			}
			if h.trustedHeader != "" {
				identity := strings.TrimSpace(r.Header.Get(h.trustedHeader))
				if identity != "" {
					if h.trustedDomain == "" || strings.HasSuffix(strings.ToLower(identity), "@"+h.trustedDomain) {
						next(w, r)
						return
					}
				}
			}
			writeError(w, http.StatusUnauthorized, "invalid API key or OIDC token")
			return
		}
		next(w, r)
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
