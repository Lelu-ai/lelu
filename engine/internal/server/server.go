// Package server exposes the Auth Permission Engine over HTTP/JSON and,
// once proto stubs are generated via `make generate`, over gRPC as well.
// The HTTP layer is production-ready from day one; gRPC is wired in Phase 2.
package server

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/lelu/engine/internal/audit"
	"github.com/lelu/engine/internal/confidence"
	"github.com/lelu/engine/internal/evaluator"
	"github.com/lelu/engine/internal/fallback"
	"github.com/lelu/engine/internal/incident"
	"github.com/lelu/engine/internal/injection"
	"github.com/lelu/engine/internal/observability"
	"github.com/lelu/engine/internal/queue"
	"github.com/lelu/engine/internal/ratelimit"
	"github.com/lelu/engine/internal/telemetry"
	"github.com/lelu/engine/internal/tokens"
)

// ─── Metrics ──────────────────────────────────────────────────────────────────

var (
	httpRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "lelu_http_requests_total",
		Help: "Total number of HTTP requests",
	}, []string{"method", "path", "status"})

	httpRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "lelu_http_request_duration_seconds",
		Help:    "Duration of HTTP requests in seconds",
		Buckets: prometheus.DefBuckets,
	}, []string{"method", "path"})

	authDecisionsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "lelu_auth_decisions_total",
		Help: "Total number of authorization decisions",
	}, []string{"type", "allowed"})

	injectionAttemptsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "lelu_injection_attempts_total",
		Help: "Total number of detected prompt injection attempts",
	})

	anomalyAlertsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "lelu_anomaly_alerts_total",
		Help: "Total number of anomaly spike alerts fired per actor",
	}, []string{"actor"})
)

// ─── Handler ──────────────────────────────────────────────────────────────────

// Handler wires all engine sub-services into HTTP endpoints.
type Handler struct {
	eval           *evaluator.Evaluator
	tokenSvc       *tokens.Service
	confGate       *confidence.Gate
	riskModel      *riskModel
	actorStat      *actorStats
	audit          *audit.Writer
	queue          *queue.Queue
	apiKey         string
	confCfg        ConfidenceConfig
	mode           EnforcementMode
	shadow         *shadowStats
	incident       *incident.Notifier
	anomaly        *anomalyTracker
	rateLimit      *ratelimit.Limiter
	fallback       *fallback.Strategy
	tracer         trace.Tracer
	
	// Phase 1: Enhanced Observability
	agentTracer    *observability.AgentTracer
	correlationMgr *observability.CorrelationManager
	
	// Phase 2: Behavioral Analytics
	reputationMgr  *observability.ReputationManager
	anomalyDetector *observability.AnomalyDetector
	baselineMgr    *observability.BaselineManager
	alertMgr       *observability.AlertManager
}

// ─── Anomaly Tracker ──────────────────────────────────────────────────────────

// anomalyTracker counts agent denials using a sliding window to detect
// abnormal denial spikes for a single actor within a configurable time window.
type anomalyTracker struct {
	mu        sync.Mutex
	buckets   map[string][]time.Time
	threshold int
	window    time.Duration
}

func newAnomalyTracker(threshold int, window time.Duration) *anomalyTracker {
	if threshold <= 0 {
		threshold = 5
	}
	if window <= 0 {
		window = 60 * time.Second
	}
	return &anomalyTracker{
		buckets:   make(map[string][]time.Time),
		threshold: threshold,
		window:    window,
	}
}

// record registers a denial for the actor and returns true if the spike
// threshold has been crossed within the sliding window.
func (a *anomalyTracker) record(actor string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-a.window)

	// Prune old entries.
	times := a.buckets[actor]
	filtered := times[:0]
	for _, t := range times {
		if t.After(cutoff) {
			filtered = append(filtered, t)
		}
	}
	filtered = append(filtered, now)
	a.buckets[actor] = filtered

	return len(filtered) >= a.threshold
}

func (a *anomalyTracker) currentCount(actor string) int {
	a.mu.Lock()
	defer a.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-a.window)
	times := a.buckets[actor]
	filtered := times[:0]
	for _, t := range times {
		if t.After(cutoff) {
			filtered = append(filtered, t)
		}
	}
	a.buckets[actor] = filtered
	return len(filtered)
}

type EnforcementMode string

const (
	EnforcementModeEnforce EnforcementMode = "enforce"
	EnforcementModeShadow  EnforcementMode = "shadow"
)

func ParseEnforcementMode(v string) EnforcementMode {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "shadow", "observe", "observation":
		return EnforcementModeShadow
	case "enforce", "":
		fallthrough
	default:
		return EnforcementModeEnforce
	}
}

type MissingConfidenceMode string

const (
	MissingConfidenceDeny     MissingConfidenceMode = "deny"
	MissingConfidenceReview   MissingConfidenceMode = "review"
	MissingConfidenceReadOnly MissingConfidenceMode = "read_only"
)

type ConfidenceConfig struct {
	AllowUnverifiedConfidence bool
	MissingSignalMode         MissingConfidenceMode
}

func (c ConfidenceConfig) withDefaults() ConfidenceConfig {
	if c.MissingSignalMode == "" {
		c.MissingSignalMode = MissingConfidenceDeny
	}
	return c
}

func ParseMissingConfidenceMode(v string) MissingConfidenceMode {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "deny", "":
		return MissingConfidenceDeny
	case "review", "human_review", "requires_human_review":
		return MissingConfidenceReview
	case "read_only", "readonly":
		return MissingConfidenceReadOnly
	default:
		return MissingConfidenceDeny
	}
}

// New constructs a Handler from its dependencies.
func New(
	eval *evaluator.Evaluator,
	tokenSvc *tokens.Service,
	confGate *confidence.Gate,
	auditWriter *audit.Writer,
	q *queue.Queue,
	apiKey string,
	confCfg ConfidenceConfig,
	mode EnforcementMode,
	incidentNotifier *incident.Notifier,
	rl *ratelimit.Limiter,
	fb *fallback.Strategy,
	tp *telemetry.Provider,
	db *sql.DB,
) *Handler {
	if mode == "" {
		mode = EnforcementModeEnforce
	}
	var tracer trace.Tracer
	if tp != nil {
		tracer = tp.Tracer()
	}

	// Initialize enhanced observability components (Phase 1)
	agentTracer := observability.NewAgentTracer("lelu-engine")
	correlationMgr := observability.NewCorrelationManager()
	
	// Initialize behavioral analytics components (Phase 2)
	var reputationMgr *observability.ReputationManager
	var anomalyDetector *observability.AnomalyDetector
	var baselineMgr *observability.BaselineManager
	var alertMgr *observability.AlertManager
	
	if db != nil {
		// Initialize Phase 2 components with database
		reputationMgr = observability.NewReputationManager(db, observability.DefaultReputationConfig())
		anomalyDetector = observability.NewAnomalyDetector(db, observability.DefaultAnomalyConfig())
		baselineMgr = observability.NewBaselineManager(db, observability.DefaultBaselineConfig())
		alertMgr = observability.NewAlertManager(db, observability.DefaultAlertConfig())
		
		log.Printf("Phase 2 behavioral analytics initialized")
	} else {
		log.Printf("Phase 2 behavioral analytics disabled (no database)")
	}

	return &Handler{
		eval:           eval,
		tokenSvc:       tokenSvc,
		confGate:       confGate,
		riskModel:      newRiskModel(NewRiskConfigFromEnv()),
		actorStat:      newActorStats(),
		audit:          auditWriter,
		queue:          q,
		apiKey:         apiKey,
		confCfg:        confCfg.withDefaults(),
		mode:           mode,
		shadow:         newShadowStats(),
		incident:       incidentNotifier,
		anomaly:        newAnomalyTracker(5, 60*time.Second),
		rateLimit:      rl,
		fallback:       fb,
		tracer:         tracer,
		
		// Phase 1: Enhanced Observability
		agentTracer:    agentTracer,
		correlationMgr: correlationMgr,
		
		// Phase 2: Behavioral Analytics
		reputationMgr:  reputationMgr,
		anomalyDetector: anomalyDetector,
		baselineMgr:    baselineMgr,
		alertMgr:       alertMgr,
	}
}

// RegisterRoutes attaches all engine endpoints to mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/authorize", h.handleAuthorize)
	mux.HandleFunc("POST /v1/agent/authorize", h.handleAgentAuthorize)
	mux.HandleFunc("POST /v1/agent/delegate", h.handleAgentDelegate) // multi-agent delegation
	mux.HandleFunc("POST /v1/simulator/replay", h.handleSimulatorReplay)
	mux.HandleFunc("GET /v1/shadow/summary", h.handleShadowSummary)
	mux.HandleFunc("POST /v1/tokens/mint", h.handleMintToken)
	mux.HandleFunc("DELETE /v1/tokens/{tokenID}", h.handleRevokeToken)
	
	// Phase 2 — Human approval queue
	mux.HandleFunc("GET /v1/queue/pending", h.handleQueueList)
	mux.HandleFunc("GET /v1/queue/{id}", h.handleQueueGet)
	mux.HandleFunc("POST /v1/queue/{id}/approve", h.handleQueueApprove)
	mux.HandleFunc("POST /v1/queue/{id}/deny", h.handleQueueDeny)
	
	// Phase 2 — Behavioral Analytics API
	mux.HandleFunc("GET /v1/analytics/reputation/{agentID}", h.handleGetReputation)
	mux.HandleFunc("GET /v1/analytics/reputation", h.handleListReputations)
	mux.HandleFunc("GET /v1/analytics/anomalies/{agentID}", h.handleGetAnomalies)
	mux.HandleFunc("GET /v1/analytics/baseline/{agentID}", h.handleGetBaseline)
	mux.HandleFunc("POST /v1/analytics/baseline/{agentID}/refresh", h.handleRefreshBaseline)
	mux.HandleFunc("GET /v1/analytics/alerts", h.handleGetAlerts)
	mux.HandleFunc("POST /v1/analytics/alerts/{alertID}/acknowledge", h.handleAcknowledgeAlert)
	mux.HandleFunc("POST /v1/analytics/alerts/{alertID}/resolve", h.handleResolveAlert)
	
	mux.HandleFunc("GET /v1/fallback/status", h.handleFallbackStatus)
	mux.HandleFunc("GET /healthz", h.handleHealth)
	mux.Handle("GET /metrics", promhttp.Handler())
}

// ─── Authorize ────────────────────────────────────────────────────────────────

type authorizeRequest struct {
	TenantID string            `json:"tenant_id"`
	UserID   string            `json:"user_id"`
	Action   string            `json:"action"`
	Resource map[string]string `json:"resource"`
}

type authorizeResponse struct {
	Allowed          bool   `json:"allowed"`
	Reason           string `json:"reason"`
	TraceID          string `json:"trace_id"`
	ShadowMode       bool   `json:"shadow_mode,omitempty"`
	WouldHaveAllowed *bool  `json:"would_have_allowed,omitempty"`
	WouldHaveReason  string `json:"would_have_reason,omitempty"`
}

func (h *Handler) handleAuthorize(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	var req authorizeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if h.rateLimit != nil && !h.rateLimit.AllowAuth(req.TenantID) {
		writeError(w, http.StatusTooManyRequests, "rate limit exceeded for tenant")
		return
	}

	dec, err := h.eval.Evaluate(r.Context(), evaluator.AuthRequest{
		TenantID: req.TenantID,
		UserID:   req.UserID,
		Action:   req.Action,
		Resource: req.Resource,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	traceID := audit.NewTraceID()
	h.audit.LogDecision(r.Context(), req.TenantID, req.UserID, req.Action, req.Resource, dec.Allowed, dec.Reason, 0, ms(start))

	authDecisionsTotal.WithLabelValues("human", fmt.Sprintf("%t", dec.Allowed)).Inc()

	allowed := dec.Allowed
	reason := dec.Reason
	var wouldHaveAllowed *bool
	var wouldHaveReason string
	shadowMode := false
	if h.mode == EnforcementModeShadow {
		shadowMode = true
		wouldHaveAllowed = boolPtr(dec.Allowed)
		wouldHaveReason = dec.Reason
		h.shadow.record(outcomeFrom(dec.Allowed, false))
		allowed = true
		reason = "shadow mode: action allowed (observation only)"
	}
	h.notifyIncident(r.Context(), incident.Event{
		Type:                "authorization.denied",
		Severity:            "high",
		TenantID:            req.TenantID,
		Actor:               req.UserID,
		Action:              req.Action,
		TraceID:             traceID,
		Reason:              dec.Reason,
		Decision:            decisionString(allowed, false),
		RequiresHumanReview: false,
		Resource:            req.Resource,
	}, allowed, false)

	writeJSON(w, http.StatusOK, authorizeResponse{
		Allowed:          allowed,
		Reason:           reason,
		TraceID:          traceID,
		ShadowMode:       shadowMode,
		WouldHaveAllowed: wouldHaveAllowed,
		WouldHaveReason:  wouldHaveReason,
	})
}

// ─── Agent Authorize ─────────────────────────────────────────────────────────

type agentAuthorizeRequest struct {
	TenantID   string             `json:"tenant_id"`
	Actor      string             `json:"actor"`
	Action     string             `json:"action"`
	Resource   map[string]string  `json:"resource"`
	Confidence *float64           `json:"confidence,omitempty"`
	Signal     *confidence.Signal `json:"confidence_signal,omitempty"`
	ActingFor  string             `json:"acting_for"`
	Scope      string             `json:"scope"`
}

type agentAuthorizeResponse struct {
	Allowed                      bool    `json:"allowed"`
	Reason                       string  `json:"reason"`
	TraceID                      string  `json:"trace_id"`
	DowngradedScope              string  `json:"downgraded_scope,omitempty"`
	EffectiveScope               string  `json:"effective_scope,omitempty"`
	RequiresHumanReview          bool    `json:"requires_human_review"`
	ConfidenceUsed               float64 `json:"confidence_used"`
	RiskScore                    float64 `json:"risk_score,omitempty"`
	RiskCriticality              float64 `json:"risk_criticality,omitempty"`
	RiskReliability              float64 `json:"risk_reliability,omitempty"`
	RiskAnomalyFactor            float64 `json:"risk_anomaly_factor,omitempty"`
	ShadowMode                   bool    `json:"shadow_mode,omitempty"`
	WouldHaveAllowed             *bool   `json:"would_have_allowed,omitempty"`
	WouldHaveReason              string  `json:"would_have_reason,omitempty"`
	WouldHaveRequiresHumanReview *bool   `json:"would_have_requires_human_review,omitempty"`
}

func (h *Handler) handleAgentAuthorize(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req agentAuthorizeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Start enhanced OpenTelemetry span with AI agent semantic conventions
	var span trace.Span
	ctx := r.Context()
	if h.agentTracer != nil {
		ctx, span = h.agentTracer.StartAuthorizationSpan(ctx, req.Actor, req.Action, getConfidenceFromRequest(req))
		defer span.End()

		// Add additional context attributes
		if span != nil {
			span.SetAttributes(
				attribute.String("tenant_id", req.TenantID),
				attribute.String(observability.AttrRequestActingFor, req.ActingFor),
				attribute.String(observability.AttrRequestScope, req.Scope),
			)
		}
	} else if h.tracer != nil {
		// Fallback to basic tracing
		ctx, span = h.tracer.Start(ctx, "agent.authorize")
		defer span.End()

		if span != nil {
			span.SetAttributes(
				attribute.String("actor", req.Actor),
				attribute.String("action", req.Action),
				attribute.String("tenant_id", req.TenantID),
			)
		}
	}

	if h.rateLimit != nil && !h.rateLimit.AllowAuth(req.TenantID) {
		writeError(w, http.StatusTooManyRequests, "rate limit exceeded for tenant")
		return
	}

	// ── Prompt injection pre-filter (fastest path, before confidence gate) ──
	if hit := injection.Detect(req.Action, req.Resource); hit.Detected {
		traceID := audit.NewTraceID()
		reason := fmt.Sprintf("prompt injection detected in %s: %q", hit.Source, hit.Pattern)
		h.audit.LogDecision(r.Context(), req.TenantID, req.Actor, req.Action, req.Resource, false, reason, 0, ms(start))
		injectionAttemptsTotal.Inc()

		// Record enhanced metrics
		observability.RecordAgentRequest(req.Actor, observability.AgentTypeAutonomous, req.Action, "injection_denied")

		h.notifyIncident(r.Context(), incident.Event{
			Type:     "security.injection_attempt",
			Severity: "critical",
			TenantID: req.TenantID,
			Actor:    req.Actor,
			Action:   req.Action,
			TraceID:  traceID,
			Reason:   reason,
			Decision: "denied",
			Resource: req.Resource,
		}, false, false)

		if h.agentTracer != nil && span != nil {
			h.agentTracer.RecordDecision(span, false, false, 0, 1.0, "injection_denied")
		}

		writeJSON(w, http.StatusOK, agentAuthorizeResponse{
			Allowed: false,
			Reason:  reason,
			TraceID: traceID,
		})
		return
	}

	confidenceScore, missingSignal, err := h.resolveConfidence(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("confidence: %v", err))
		return
	}

	// Record confidence score metrics
	observability.RecordConfidenceScore(req.Actor, req.Action, confidenceScore)

	if missingSignal {
		traceID := audit.NewTraceID()
		resp := h.decisionForMissingSignal(r.Context(), req, traceID, start)

		// Record enhanced metrics
		observability.RecordAgentRequest(req.Actor, observability.AgentTypeAutonomous, req.Action, "missing_signal")
		if resp.RequiresHumanReview {
			observability.RecordHumanReview(req.Actor, "missing_confidence_signal")
		}

		h.notifyIncident(r.Context(), incident.Event{
			Type:                eventTypeFrom(resp.Allowed, resp.RequiresHumanReview),
			Severity:            severityFrom(resp.Allowed, resp.RequiresHumanReview),
			TenantID:            req.TenantID,
			Actor:               req.Actor,
			ActingFor:           req.ActingFor,
			Action:              req.Action,
			TraceID:             traceID,
			Reason:              resp.Reason,
			Decision:            decisionString(resp.Allowed, resp.RequiresHumanReview),
			RequiresHumanReview: resp.RequiresHumanReview,
			ConfidenceUsed:      resp.ConfidenceUsed,
			Resource:            req.Resource,
		}, resp.Allowed, resp.RequiresHumanReview)

		if h.agentTracer != nil && span != nil {
			h.agentTracer.RecordDecision(span, resp.Allowed, resp.RequiresHumanReview, resp.ConfidenceUsed, 0, "missing_signal")
		}

		resp = h.applyShadowMode(resp)
		writeJSON(w, http.StatusOK, resp)
		return
	}

	// 1. Confidence gate with timing
	confStart := time.Now()
	confDec, err := h.confGate.Evaluate(r.Context(), confidenceScore, nil)
	confLatency := ms(confStart)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("confidence: %v", err))
		return
	}

	// 2. Policy evaluator with timing
	policyStart := time.Now()
	evalDec, err := h.eval.EvaluateAgent(ctx, evaluator.AgentAuthRequest{
		TenantID:   req.TenantID,
		Actor:      req.Actor,
		Action:     req.Action,
		Resource:   req.Resource,
		Confidence: confidenceScore,
		ActingFor:  req.ActingFor,
		Scope:      req.Scope,
	})
	policyLatency := ms(policyStart)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Record policy evaluation in span
	if h.agentTracer != nil && span != nil {
		h.agentTracer.RecordPolicyEvaluation(span, "default_policy", "1.0", fmt.Sprintf("%t", evalDec.Allowed), policyLatency)
	}

	// 3. Risk model with timing
	riskStart := time.Now()
	reliability := h.actorStat.reliability(req.Actor)
	anomalyCount := h.anomaly.currentCount(req.Actor)
	anomalyFactor := 1.0 + minFloat(float64(anomalyCount)/10.0, 0.5)
	riskDec := h.riskModel.evaluate(req.Action, confidenceScore, reliability, anomalyFactor)
	riskLatency := ms(riskStart)

	// Record risk score metrics
	observability.RecordRiskScore(req.Actor, req.Action, riskDec.Score)

	finalOutcome := outcomeAllow
	finalReason := evalDec.Reason

	if oc := confidenceOutcome(confDec); oc != outcomeAllow {
		merged := moreRestrictive(finalOutcome, oc)
		if merged != finalOutcome {
			finalOutcome = merged
			finalReason = confDec.Reason
		}
	}
	if oe := evaluatorOutcome(evalDec.Allowed, evalDec.RequiresHumanReview, evalDec.DowngradedScope); oe != outcomeAllow {
		merged := moreRestrictive(finalOutcome, oe)
		if merged != finalOutcome {
			finalOutcome = merged
			finalReason = evalDec.Reason
		}
	}
	if or := riskDec.Outcome; or != outcomeAllow {
		merged := moreRestrictive(finalOutcome, or)
		if merged != finalOutcome {
			finalOutcome = merged
			finalReason = riskDec.Reason
		}
	}

	allowed := false
	requiresReview := false
	downgradedScope := ""
	effectiveScope := ""

	switch finalOutcome {
	case outcomeAllow:
		allowed = true
	case outcomeReadOnly:
		allowed = true
		downgradedScope = "read_only"
		effectiveScope = "read_only"
	case outcomeReview:
		requiresReview = true
	case outcomeDeny:
		// defaults are already deny.
	}

	h.actorStat.record(req.Actor, finalOutcome)

	// Record enhanced metrics and latency
	totalLatency := ms(start)
	outcome := "denied"
	if allowed {
		outcome = "allowed"
	} else if requiresReview {
		outcome = "review"
	}

	observability.RecordAgentRequest(req.Actor, observability.AgentTypeAutonomous, req.Action, outcome)
	observability.RecordDecisionLatency(req.Actor, "total", totalLatency/1000.0)
	observability.RecordDecisionLatency(req.Actor, "confidence_gate", confLatency/1000.0)
	observability.RecordDecisionLatency(req.Actor, "policy_eval", policyLatency/1000.0)
	observability.RecordDecisionLatency(req.Actor, "risk_eval", riskLatency/1000.0)

	// Record comprehensive span attributes
	if h.agentTracer != nil && span != nil {
		h.agentTracer.RecordDecision(span, allowed, requiresReview, confidenceScore, riskDec.Score, outcome)
		h.agentTracer.RecordLatency(span, totalLatency, confLatency, policyLatency, riskLatency)
	} else if span != nil {
		// Fallback span attributes
		span.SetAttributes(
			attribute.Float64("confidence_score", confidenceScore),
			attribute.Bool("allowed", allowed),
			attribute.Bool("requires_review", requiresReview),
			attribute.Float64("risk_score", riskDec.Score),
			attribute.Float64("latency_ms", totalLatency),
		)
	}

	traceID := audit.NewTraceID()
	h.audit.LogDecision(r.Context(), req.TenantID, req.Actor, req.Action, req.Resource, allowed, finalReason, confidenceScore, totalLatency)

	authDecisionsTotal.WithLabelValues("agent", fmt.Sprintf("%t", allowed)).Inc()

	// Phase 2 — enqueue for human review when flagged.
	if requiresReview && h.queue != nil && h.mode != EnforcementModeShadow {
		observability.RecordHumanReview(req.Actor, finalReason)
		_, _ = h.queue.Enqueue(r.Context(), req.TenantID, req.Actor, req.Action, req.Resource, confidenceScore, finalReason, req.ActingFor)
	}

	resp := agentAuthorizeResponse{
		Allowed:             allowed,
		Reason:              finalReason,
		TraceID:             traceID,
		DowngradedScope:     downgradedScope,
		EffectiveScope:      effectiveScope,
		RequiresHumanReview: requiresReview,
		ConfidenceUsed:      confidenceScore,
		RiskScore:           riskDec.Score,
		RiskCriticality:     riskDec.Criticality,
		RiskReliability:     riskDec.Reliability,
		RiskAnomalyFactor:   riskDec.AnomalyFactor,
	}
	h.notifyIncident(r.Context(), incident.Event{
		Type:                eventTypeFrom(resp.Allowed, resp.RequiresHumanReview),
		Severity:            severityFrom(resp.Allowed, resp.RequiresHumanReview),
		TenantID:            req.TenantID,
		Actor:               req.Actor,
		ActingFor:           req.ActingFor,
		Action:              req.Action,
		TraceID:             traceID,
		Reason:              resp.Reason,
		Decision:            decisionString(resp.Allowed, resp.RequiresHumanReview),
		RequiresHumanReview: resp.RequiresHumanReview,
		ConfidenceUsed:      confidenceScore,
		Resource:            req.Resource,
	}, resp.Allowed, resp.RequiresHumanReview)

	// Anomaly tracking — record denials to the sliding window tracker.
	if !resp.Allowed && !resp.RequiresHumanReview {
		if spike := h.anomaly.record(req.Actor); spike {
			anomalyAlertsTotal.WithLabelValues(req.Actor).Inc()
			observability.UpdateAgentAnomalyScore(req.Actor, 1.0) // High anomaly score during spike
			h.notifyIncident(r.Context(), incident.Event{
				Type:     "security.anomaly_spike",
				Severity: "high",
				TenantID: req.TenantID,
				Actor:    req.Actor,
				Action:   req.Action,
				TraceID:  traceID,
				Reason:   fmt.Sprintf("anomaly: actor %q exceeded denial spike threshold", req.Actor),
				Decision: "denied",
				Resource: req.Resource,
			}, false, false)
		}
	} else {
		// Normal behavior, lower anomaly score
		observability.UpdateAgentAnomalyScore(req.Actor, 0.1)
	}

	// ── Phase 2: Behavioral Analytics Integration ────────────────────────────
	if h.reputationMgr != nil && h.anomalyDetector != nil && h.baselineMgr != nil && h.alertMgr != nil {
		go func() {
			// Run behavioral analytics in background to avoid blocking response
			ctx := context.Background()
			
			// 1. Record decision for reputation tracking
			wasCorrect := allowed || requiresReview // Assume allowed/review decisions are "correct"
			if err := h.reputationMgr.RecordDecision(ctx, req.Actor, "autonomous", confidenceScore, wasCorrect, outcome); err != nil {
				log.Printf("Failed to record decision for reputation: %v", err)
			}
			
			// 2. Update behavioral baseline
			if err := h.baselineMgr.UpdateBaseline(ctx, req.Actor, req.Action, outcome, confidenceScore, time.Duration(totalLatency)*time.Millisecond); err != nil {
				log.Printf("Failed to update behavioral baseline: %v", err)
			}
			
			// 3. Perform anomaly detection
			anomalyResult, err := h.anomalyDetector.DetectAnomaly(ctx, req.Actor, "autonomous", req.Action, confidenceScore, time.Duration(totalLatency)*time.Millisecond, outcome)
			if err != nil {
				log.Printf("Failed to detect anomaly: %v", err)
			} else if anomalyResult != nil && anomalyResult.IsAnomaly {
				// 4. Check for anomaly alerts
				if err := h.alertMgr.CheckAnomalyAlert(ctx, anomalyResult); err != nil {
					log.Printf("Failed to check anomaly alert: %v", err)
				}
			}
			
			// 5. Check reputation-based alerts
			if reputation, err := h.reputationMgr.GetReputation(ctx, req.Actor); err == nil {
				if err := h.alertMgr.CheckReputationAlert(ctx, req.Actor, reputation); err != nil {
					log.Printf("Failed to check reputation alert: %v", err)
				}
			}
			
			// 6. Check for baseline drift
			if driftAnalysis, err := h.baselineMgr.DetectDrift(ctx, req.Actor); err == nil && driftAnalysis != nil {
				if err := h.alertMgr.CheckDriftAlert(ctx, driftAnalysis); err != nil {
					log.Printf("Failed to check drift alert: %v", err)
				}
			}
		}()
	}

	writeJSON(w, http.StatusOK, h.applyShadowMode(resp))
}

// ─── Agent Delegate ────────────────────────────────────────────────────────────

type agentDelegateRequest struct {
	TenantID   string   `json:"tenant_id"`
	Delegator  string   `json:"delegator"`
	Delegatee  string   `json:"delegatee"`
	ScopedTo   []string `json:"scoped_to"`
	TTLSeconds int64    `json:"ttl_seconds"`
	Confidence float64  `json:"confidence"`
	ActingFor  string   `json:"acting_for"`
}

type agentDelegateResponse struct {
	Token         string   `json:"token"`
	TokenID       string   `json:"token_id"`
	ExpiresAt     int64    `json:"expires_at"`
	Delegator     string   `json:"delegator"`
	Delegatee     string   `json:"delegatee"`
	GrantedScopes []string `json:"granted_scopes"`
	TraceID       string   `json:"trace_id"`
}

func (h *Handler) handleAgentDelegate(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	var req agentDelegateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.Delegator == "" || req.Delegatee == "" {
		writeError(w, http.StatusBadRequest, "delegator and delegatee are required")
		return
	}

	// Start enhanced delegation span with correlation tracking
	var span trace.Span
	ctx := r.Context()
	if h.agentTracer != nil {
		ctx, span = h.agentTracer.StartDelegationSpan(ctx, req.Delegator, req.Delegatee)
		defer span.End()

		// Start delegation chain tracking
		chainID := h.correlationMgr.StartDelegationChain(ctx, req.Delegator, req.Delegatee)
		if span != nil {
			span.SetAttributes(
				attribute.String("ai.correlation.chain_id", chainID),
				attribute.String("tenant_id", req.TenantID),
				attribute.Float64("confidence", req.Confidence),
				attribute.String(observability.AttrRequestActingFor, req.ActingFor),
			)
		}
	} else if h.tracer != nil {
		// Fallback to basic tracing
		var span trace.Span
		ctx, span = h.tracer.Start(ctx, "agent.delegate")
		defer span.End()
	}

	// Validate delegation rules via evaluator.
	dec, err := h.eval.CheckDelegation(ctx, req.Delegator, req.Delegatee, req.ScopedTo, req.Confidence)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !dec.Allowed {
		traceID := audit.NewTraceID()
		h.audit.LogDecision(r.Context(), req.TenantID, req.Delegator,
			"agent:delegate", map[string]string{"delegatee": req.Delegatee},
			false, dec.Reason, req.Confidence, ms(start))

		// Record delegation metrics
		observability.RecordDelegation(req.Delegator, req.Delegatee, "denied")

		if h.agentTracer != nil && span != nil {
			h.agentTracer.RecordDecision(span, false, false, req.Confidence, 0, "delegation_denied")
		}

		writeJSON(w, http.StatusForbidden, map[string]any{
			"allowed":  false,
			"reason":   dec.Reason,
			"trace_id": traceID,
		})
		return
	}

	// Cap TTL to policy maximum.
	ttl := time.Duration(req.TTLSeconds) * time.Second
	if dec.MaxTTL > 0 {
		policyMax := time.Duration(dec.MaxTTL) * time.Second
		if ttl <= 0 || ttl > policyMax {
			ttl = policyMax
		}
	}
	if ttl <= 0 {
		ttl = 60 * time.Second // fallback
	}

	// Mint a child JIT token scoped to granted actions.
	scope := req.Delegatee
	if len(dec.GrantedScopes) > 0 {
		scope = strings.Join(dec.GrantedScopes, ",")
	}
	minted, err := h.tokenSvc.MintAgentToken(r.Context(), scope, req.ActingFor, ttl)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	traceID := audit.NewTraceID()
	h.audit.LogDecision(r.Context(), req.TenantID, req.Delegator,
		"agent:delegate", map[string]string{"delegatee": req.Delegatee, "scope": scope},
		true, dec.Reason, req.Confidence, ms(start))

	// Record successful delegation metrics
	observability.RecordDelegation(req.Delegator, req.Delegatee, "allowed")

	if h.agentTracer != nil && span != nil {
		h.agentTracer.RecordDecision(span, true, false, req.Confidence, 0, "delegation_allowed")
		span.SetAttributes(
			attribute.StringSlice("granted_scopes", dec.GrantedScopes),
			attribute.String("token_id", minted.TokenID),
			attribute.Int64("ttl_seconds", int64(ttl.Seconds())),
		)
	}

	writeJSON(w, http.StatusOK, agentDelegateResponse{
		Token:         minted.Token,
		TokenID:       minted.TokenID,
		ExpiresAt:     minted.ExpiresAt.Unix(),
		Delegator:     req.Delegator,
		Delegatee:     req.Delegatee,
		GrantedScopes: dec.GrantedScopes,
		TraceID:       traceID,
	})
}

func (h *Handler) resolveConfidence(req agentAuthorizeRequest) (score float64, missingSignal bool, err error) {
	if req.Signal != nil {
		score, err = confidence.ExtractScore(req.Signal)
		return score, false, err
	}
	if h.confCfg.AllowUnverifiedConfidence && req.Confidence != nil {
		return *req.Confidence, false, nil
	}
	return 0, true, nil
}

func (h *Handler) decisionForMissingSignal(ctx context.Context, req agentAuthorizeRequest, traceID string, start time.Time) agentAuthorizeResponse {
	var reason string
	var allowed bool
	var requiresReview bool
	var downgradedScope string

	switch h.confCfg.MissingSignalMode {
	case MissingConfidenceReview:
		reason = "missing confidence signal from provider; routed to human review"
		requiresReview = true
	case MissingConfidenceReadOnly:
		reason = "missing confidence signal from provider; downgraded to read_only"
		downgradedScope = "read_only"
	case MissingConfidenceDeny:
		reason = "missing confidence signal from provider; request denied"
	default:
		reason = "missing confidence signal from provider; request denied"
	}

	h.audit.LogDecision(ctx, req.TenantID, req.Actor, req.Action, req.Resource, allowed, reason, 0, ms(start))
	authDecisionsTotal.WithLabelValues("agent", fmt.Sprintf("%t", allowed)).Inc()

	if requiresReview && h.queue != nil && h.mode != EnforcementModeShadow {
		_, _ = h.queue.Enqueue(ctx, req.TenantID, req.Actor, req.Action, req.Resource, 0, reason, req.ActingFor)
	}

	return agentAuthorizeResponse{
		Allowed:             allowed,
		Reason:              reason,
		TraceID:             traceID,
		DowngradedScope:     downgradedScope,
		RequiresHumanReview: requiresReview,
		ConfidenceUsed:      0,
	}
}

func (h *Handler) applyShadowMode(resp agentAuthorizeResponse) agentAuthorizeResponse {
	if h.mode != EnforcementModeShadow {
		return resp
	}
	h.shadow.record(outcomeFrom(resp.Allowed, resp.RequiresHumanReview))
	resp.ShadowMode = true
	resp.WouldHaveAllowed = boolPtr(resp.Allowed)
	resp.WouldHaveReason = resp.Reason
	resp.WouldHaveRequiresHumanReview = boolPtr(resp.RequiresHumanReview)
	resp.Allowed = true
	resp.RequiresHumanReview = false
	resp.DowngradedScope = ""
	resp.EffectiveScope = ""
	resp.Reason = "shadow mode: action allowed (observation only)"
	return resp
}

type shadowOutcome string

const (
	shadowOutcomeAllow  shadowOutcome = "allow"
	shadowOutcomeReview shadowOutcome = "review"
	shadowOutcomeDeny   shadowOutcome = "deny"
)

type shadowBucket struct {
	Allow  int `json:"allow"`
	Review int `json:"review"`
	Deny   int `json:"deny"`
}

type shadowStats struct {
	mu       sync.Mutex
	byMinute map[time.Time]*shadowBucket
}

func newShadowStats() *shadowStats {
	return &shadowStats{byMinute: make(map[time.Time]*shadowBucket)}
}

func (s *shadowStats) record(outcome shadowOutcome) {
	now := time.Now().UTC().Truncate(time.Minute)
	s.mu.Lock()
	defer s.mu.Unlock()
	b, ok := s.byMinute[now]
	if !ok {
		b = &shadowBucket{}
		s.byMinute[now] = b
	}
	switch outcome {
	case shadowOutcomeAllow:
		b.Allow++
	case shadowOutcomeReview:
		b.Review++
	case shadowOutcomeDeny:
		b.Deny++
	default:
		b.Deny++
	}
}

type shadowSummaryBucket struct {
	Minute string `json:"minute"`
	Allow  int    `json:"allow"`
	Review int    `json:"review"`
	Deny   int    `json:"deny"`
}

type shadowSummaryResponse struct {
	Mode          EnforcementMode       `json:"mode"`
	WindowMinutes int                   `json:"window_minutes"`
	GeneratedAt   string                `json:"generated_at"`
	Totals        shadowBucket          `json:"totals"`
	Buckets       []shadowSummaryBucket `json:"buckets"`
}

func (h *Handler) handleShadowSummary(w http.ResponseWriter, r *http.Request) {
	windowMinutes := 60
	if raw := strings.TrimSpace(r.URL.Query().Get("window_minutes")); raw != "" {
		v, err := strconv.Atoi(raw)
		if err != nil || v <= 0 || v > 24*60 {
			writeError(w, http.StatusBadRequest, "window_minutes must be an integer between 1 and 1440")
			return
		}
		windowMinutes = v
	}

	resp := shadowSummaryResponse{
		Mode:          h.mode,
		WindowMinutes: windowMinutes,
		GeneratedAt:   time.Now().UTC().Format(time.RFC3339),
		Totals:        shadowBucket{},
		Buckets:       []shadowSummaryBucket{},
	}

	if h.mode != EnforcementModeShadow {
		writeJSON(w, http.StatusOK, resp)
		return
	}

	cutoff := time.Now().UTC().Add(-time.Duration(windowMinutes) * time.Minute).Truncate(time.Minute)
	h.shadow.mu.Lock()
	minutes := make([]time.Time, 0, len(h.shadow.byMinute))
	for minute := range h.shadow.byMinute {
		if !minute.Before(cutoff) {
			minutes = append(minutes, minute)
		}
	}
	sort.Slice(minutes, func(i, j int) bool { return minutes[i].Before(minutes[j]) })

	for _, minute := range minutes {
		b := h.shadow.byMinute[minute]
		resp.Totals.Allow += b.Allow
		resp.Totals.Review += b.Review
		resp.Totals.Deny += b.Deny
		resp.Buckets = append(resp.Buckets, shadowSummaryBucket{
			Minute: minute.Format(time.RFC3339),
			Allow:  b.Allow,
			Review: b.Review,
			Deny:   b.Deny,
		})
	}
	h.shadow.mu.Unlock()

	writeJSON(w, http.StatusOK, resp)
}

func outcomeFrom(allowed, requiresReview bool) shadowOutcome {
	if requiresReview {
		return shadowOutcomeReview
	}
	if allowed {
		return shadowOutcomeAllow
	}
	return shadowOutcomeDeny
}

// ─── Policy Simulator / Replay ──────────────────────────────────────────────

type simulatorReplayRequest struct {
	ProposedPolicyYAML string               `json:"proposed_policy_yaml"`
	Traces             []simulatorTraceItem `json:"traces"`
}

type simulatorTraceItem struct {
	ID         string             `json:"id,omitempty"`
	Kind       string             `json:"kind"` // "human" | "agent"
	TenantID   string             `json:"tenant_id"`
	UserID     string             `json:"user_id,omitempty"`
	Actor      string             `json:"actor,omitempty"`
	Action     string             `json:"action"`
	Resource   map[string]string  `json:"resource,omitempty"`
	ActingFor  string             `json:"acting_for,omitempty"`
	Scope      string             `json:"scope,omitempty"`
	Confidence *float64           `json:"confidence,omitempty"`
	Signal     *confidence.Signal `json:"confidence_signal,omitempty"`
}

type simulatorDecision struct {
	Allowed             bool    `json:"allowed"`
	RequiresHumanReview bool    `json:"requires_human_review"`
	DowngradedScope     string  `json:"downgraded_scope,omitempty"`
	Reason              string  `json:"reason"`
	Outcome             string  `json:"outcome"` // allow | review | deny
	ConfidenceUsed      float64 `json:"confidence_used,omitempty"`
}

type simulatorReplayDelta struct {
	ID      string            `json:"id,omitempty"`
	Index   int               `json:"index"`
	Kind    string            `json:"kind"`
	Action  string            `json:"action"`
	Actor   string            `json:"actor,omitempty"`
	UserID  string            `json:"user_id,omitempty"`
	Changed bool              `json:"changed"`
	Before  simulatorDecision `json:"before"`
	After   simulatorDecision `json:"after"`
}

type simulatorReplaySummary struct {
	Total         int `json:"total"`
	Changed       int `json:"changed"`
	AllowToDeny   int `json:"allow_to_deny"`
	AllowToReview int `json:"allow_to_review"`
	ReviewToDeny  int `json:"review_to_deny"`
	DenyToAllow   int `json:"deny_to_allow"`
	ReviewToAllow int `json:"review_to_allow"`
	DenyToReview  int `json:"deny_to_review"`
	OtherChanges  int `json:"other_changes"`
}

type simulatorReplayResponse struct {
	Summary simulatorReplaySummary `json:"summary"`
	Items   []simulatorReplayDelta `json:"items"`
}

func (h *Handler) handleSimulatorReplay(w http.ResponseWriter, r *http.Request) {
	var req simulatorReplayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.ProposedPolicyYAML) == "" {
		writeError(w, http.StatusBadRequest, "proposed_policy_yaml is required")
		return
	}

	proposed := evaluator.New()
	if err := proposed.LoadPolicyBytes([]byte(req.ProposedPolicyYAML)); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("invalid proposed_policy_yaml: %v", err))
		return
	}

	resp := simulatorReplayResponse{
		Summary: simulatorReplaySummary{Total: len(req.Traces)},
		Items:   make([]simulatorReplayDelta, 0, len(req.Traces)),
	}

	for i, tr := range req.Traces {
		before, err := h.evaluateTraceForSimulator(r.Context(), h.eval, tr)
		if err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("trace[%d]: %v", i, err))
			return
		}
		after, err := h.evaluateTraceForSimulator(r.Context(), proposed, tr)
		if err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("trace[%d] against proposed policy: %v", i, err))
			return
		}

		changed := before.Outcome != after.Outcome || before.DowngradedScope != after.DowngradedScope
		if changed {
			resp.Summary.Changed++
			h.incrementTransitionCounter(&resp.Summary, before.Outcome, after.Outcome)
		}

		resp.Items = append(resp.Items, simulatorReplayDelta{
			ID:      tr.ID,
			Index:   i,
			Kind:    strings.ToLower(strings.TrimSpace(tr.Kind)),
			Action:  tr.Action,
			Actor:   tr.Actor,
			UserID:  tr.UserID,
			Changed: changed,
			Before:  before,
			After:   after,
		})
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) evaluateTraceForSimulator(ctx context.Context, eval *evaluator.Evaluator, tr simulatorTraceItem) (simulatorDecision, error) {
	kind := strings.ToLower(strings.TrimSpace(tr.Kind))
	switch kind {
	case "human":
		dec, err := eval.Evaluate(ctx, evaluator.AuthRequest{
			TenantID: tr.TenantID,
			UserID:   tr.UserID,
			Action:   tr.Action,
			Resource: tr.Resource,
		})
		if err != nil {
			return simulatorDecision{}, err
		}
		return simulatorDecision{
			Allowed: dec.Allowed,
			Reason:  dec.Reason,
			Outcome: simulatorOutcome(dec.Allowed, false),
		}, nil

	case "agent":
		if strings.TrimSpace(tr.Actor) == "" {
			return simulatorDecision{}, fmt.Errorf("actor is required for agent traces")
		}
		confidenceScore, err := h.resolveSimulatorConfidence(tr)
		if err != nil {
			return simulatorDecision{}, err
		}

		confDec, err := h.confGate.Evaluate(ctx, confidenceScore, nil)
		if err != nil {
			return simulatorDecision{}, err
		}
		if confDec.Level == confidence.LevelHardDeny {
			return simulatorDecision{
				Allowed:        false,
				Reason:         confDec.Reason,
				Outcome:        "deny",
				ConfidenceUsed: confidenceScore,
			}, nil
		}

		evalDec, err := eval.EvaluateAgent(ctx, evaluator.AgentAuthRequest{
			TenantID:   tr.TenantID,
			Actor:      tr.Actor,
			Action:     tr.Action,
			Resource:   tr.Resource,
			Confidence: confidenceScore,
			ActingFor:  tr.ActingFor,
			Scope:      tr.Scope,
		})
		if err != nil {
			return simulatorDecision{}, err
		}

		requiresReview := evalDec.RequiresHumanReview || confDec.RequiresHumanReview
		return simulatorDecision{
			Allowed:             evalDec.Allowed,
			RequiresHumanReview: requiresReview,
			DowngradedScope:     evalDec.DowngradedScope,
			Reason:              evalDec.Reason,
			Outcome:             simulatorOutcome(evalDec.Allowed, requiresReview),
			ConfidenceUsed:      confidenceScore,
		}, nil

	default:
		return simulatorDecision{}, fmt.Errorf("kind must be one of: human, agent")
	}
}

func (h *Handler) resolveSimulatorConfidence(tr simulatorTraceItem) (float64, error) {
	if tr.Signal != nil {
		return confidence.ExtractScore(tr.Signal)
	}
	if tr.Confidence != nil {
		return *tr.Confidence, nil
	}
	return 0, fmt.Errorf("agent trace requires confidence or confidence_signal")
}

func simulatorOutcome(allowed, requiresReview bool) string {
	if requiresReview {
		return "review"
	}
	if allowed {
		return "allow"
	}
	return "deny"
}

func (h *Handler) incrementTransitionCounter(summary *simulatorReplaySummary, before, after string) {
	transition := before + "->" + after
	switch transition {
	case "allow->deny":
		summary.AllowToDeny++
	case "allow->review":
		summary.AllowToReview++
	case "review->deny":
		summary.ReviewToDeny++
	case "deny->allow":
		summary.DenyToAllow++
	case "review->allow":
		summary.ReviewToAllow++
	case "deny->review":
		summary.DenyToReview++
	default:
		summary.OtherChanges++
	}
}

// ─── Mint Token ───────────────────────────────────────────────────────────────

type mintTokenRequest struct {
	TenantID   string `json:"tenant_id"`
	Scope      string `json:"scope"`
	ActingFor  string `json:"acting_for"`
	TTLSeconds int64  `json:"ttl_seconds"`
}

type mintTokenResponse struct {
	Token     string `json:"token"`
	TokenID   string `json:"token_id"`
	ExpiresAt int64  `json:"expires_at"`
}

func (h *Handler) handleMintToken(w http.ResponseWriter, r *http.Request) {
	var req mintTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return

	}

	if h.rateLimit != nil && !h.rateLimit.AllowMint(req.TenantID) {
		writeError(w, http.StatusTooManyRequests, "rate limit exceeded for tenant")
		return
	}

	ttl := time.Duration(req.TTLSeconds) * time.Second
	result, err := h.tokenSvc.MintAgentToken(r.Context(), req.Scope, req.ActingFor, ttl)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, mintTokenResponse{
		Token:     result.Token,
		TokenID:   result.TokenID,
		ExpiresAt: result.ExpiresAt.Unix(),
	})
}

// ─── Revoke Token ─────────────────────────────────────────────────────────────

func (h *Handler) handleRevokeToken(w http.ResponseWriter, r *http.Request) {
	tokenID := r.PathValue("tokenID")
	if tokenID == "" {
		writeError(w, http.StatusBadRequest, "missing token_id")
		return
	}
	if err := h.tokenSvc.RevokeToken(r.Context(), tokenID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// ─── Human Approval Queue ─────────────────────────────────────────────────────

func (h *Handler) handleQueueList(w http.ResponseWriter, r *http.Request) {
	if h.queue == nil {
		writeError(w, http.StatusServiceUnavailable, "queue not configured")
		return
	}
	items, err := h.queue.ListPending(r.Context(), 50)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "count": len(items)})
}

func (h *Handler) handleQueueGet(w http.ResponseWriter, r *http.Request) {
	if h.queue == nil {
		writeError(w, http.StatusServiceUnavailable, "queue not configured")
		return
	}
	id := r.PathValue("id")
	item, err := h.queue.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, item)
}

type resolveRequest struct {
	ResolvedBy string `json:"resolved_by"`
	Note       string `json:"note"`
}

func (h *Handler) handleQueueApprove(w http.ResponseWriter, r *http.Request) {
	h.handleQueueResolve(w, r, true)
}

func (h *Handler) handleQueueDeny(w http.ResponseWriter, r *http.Request) {
	h.handleQueueResolve(w, r, false)
}

func (h *Handler) handleQueueResolve(w http.ResponseWriter, r *http.Request, approve bool) {
	if h.queue == nil {
		writeError(w, http.StatusServiceUnavailable, "queue not configured")
		return
	}
	id := r.PathValue("id")
	var req resolveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	var err error
	if approve {
		err = h.queue.Approve(r.Context(), id, req.ResolvedBy, req.Note)
	} else {
		err = h.queue.Deny(r.Context(), id, req.ResolvedBy, req.Note)
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// ─── Fallback Status ─────────────────────────────────────────────────────────

func (h *Handler) handleFallbackStatus(w http.ResponseWriter, _ *http.Request) {
	if h.fallback == nil {
		writeJSON(w, http.StatusOK, map[string]string{"status": "fallback not configured"})
		return
	}
	writeJSON(w, http.StatusOK, h.fallback.Status())
}

// ─── Health ───────────────────────────────────────────────────────────────────

func (h *Handler) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "lelu-engine",
	})
}

// ─── HTTP Server constructor ─────────────────────────────────────────────────

// NewHTTPServer builds a configured *http.Server ready to call ListenAndServe.
func NewHTTPServer(addr string, handler *Handler) *http.Server {
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	return &http.Server{
		Addr:         addr,
		Handler:      logging(handler.authMiddleware(mux)),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
}

// ─── Middleware ───────────────────────────────────────────────────────────────

// responseRecorder intercepts the status code for metrics
type responseRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (rec *responseRecorder) WriteHeader(statusCode int) {
	rec.statusCode = statusCode
	rec.ResponseWriter.WriteHeader(statusCode)
}

func (h *Handler) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip auth for health check and metrics
		if r.URL.Path == "/healthz" || r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}

		// In production, fail closed when API key is not configured.
		if strings.EqualFold(strings.TrimSpace(os.Getenv("ENV")), "production") && h.apiKey == "" {
			writeError(w, http.StatusInternalServerError, "server misconfigured: API key is required in production")
			return
		}

		// If no API key is configured, allow all (for local dev/testing).
		if h.apiKey == "" {
			next.ServeHTTP(w, r)
			return
		}

		authHeader := r.Header.Get("Authorization")
		expected := "Bearer " + h.apiKey
		if authHeader != expected {
			writeError(w, http.StatusUnauthorized, "unauthorized: invalid or missing API key")
			return
		}

		next.ServeHTTP(w, r)
	})
}

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		rec := &responseRecorder{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		next.ServeHTTP(rec, r)

		duration := time.Since(start).Seconds()

		// Record metrics
		httpRequestsTotal.WithLabelValues(r.Method, r.URL.Path, fmt.Sprintf("%d", rec.statusCode)).Inc()
		httpRequestDuration.WithLabelValues(r.Method, r.URL.Path).Observe(duration)
		log.Printf("%s %s %d %.2fms", r.Method, r.URL.Path, rec.statusCode, ms(start))
	})
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type errorResponse struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorResponse{Error: msg})
}

func ms(start time.Time) float64 {
	return float64(time.Since(start).Microseconds()) / 1000
}

func boolPtr(v bool) *bool {
	return &v
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func (h *Handler) notifyIncident(_ context.Context, evt incident.Event, allowed, requiresReview bool) {
	if h.mode == EnforcementModeShadow {
		return
	}
	if h.incident == nil || !h.incident.Enabled() {
		return
	}
	if allowed && !requiresReview {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err := h.incident.Notify(ctx, evt); err != nil {
			log.Printf("incident webhook notify failed: %v", err)
		}
	}()
}

func eventTypeFrom(allowed, requiresReview bool) string {
	if requiresReview {
		return "authorization.review_required"
	}
	if !allowed {
		return "authorization.denied"
	}
	return "authorization.allowed"
}

func severityFrom(allowed, requiresReview bool) string {
	if !allowed {
		return "high"
	}
	if requiresReview {
		return "medium"
	}
	return "low"
}

func decisionString(allowed, requiresReview bool) string {
	if requiresReview {
		return "human_review"
	}
	if allowed {
		return "allowed"
	}
	return "denied"
}

// getConfidenceFromRequest extracts confidence score from request for tracing
func getConfidenceFromRequest(req agentAuthorizeRequest) float64 {
	if req.Confidence != nil {
		return *req.Confidence
	}
	if req.Signal != nil {
		if score, err := confidence.ExtractScore(req.Signal); err == nil {
			return score
		}
	}
	return 0.0
}

// ─── Phase 2: Behavioral Analytics API Handlers ─────────────────────────────

// handleGetReputation returns reputation information for a specific agent
func (h *Handler) handleGetReputation(w http.ResponseWriter, r *http.Request) {
	if h.reputationMgr == nil {
		writeError(w, http.StatusServiceUnavailable, "behavioral analytics not enabled")
		return
	}
	
	agentID := r.PathValue("agentID")
	if agentID == "" {
		writeError(w, http.StatusBadRequest, "agent ID required")
		return
	}
	
	reputation, err := h.reputationMgr.GetReputation(r.Context(), agentID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get reputation: %v", err))
		return
	}
	
	writeJSON(w, http.StatusOK, reputation)
}

// handleListReputations returns reputation information for all agents
func (h *Handler) handleListReputations(w http.ResponseWriter, r *http.Request) {
	if h.reputationMgr == nil {
		writeError(w, http.StatusServiceUnavailable, "behavioral analytics not enabled")
		return
	}
	
	// Parse query parameters
	limitStr := r.URL.Query().Get("limit")
	limit := 50 // default
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	
	sortBy := r.URL.Query().Get("sort")
	switch sortBy {
	case "top":
		agents, err := h.reputationMgr.GetTopAgents(r.Context(), limit)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get top agents: %v", err))
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"agents": agents,
			"total":  len(agents),
			"sort":   "top",
		})
	case "problematic":
		threshold := 0.4 // default threshold
		if thresholdStr := r.URL.Query().Get("threshold"); thresholdStr != "" {
			if parsed, err := strconv.ParseFloat(thresholdStr, 64); err == nil {
				threshold = parsed
			}
		}
		agents, err := h.reputationMgr.GetProblematicAgents(r.Context(), threshold)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get problematic agents: %v", err))
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"agents":    agents,
			"total":     len(agents),
			"sort":      "problematic",
			"threshold": threshold,
		})
	default:
		writeError(w, http.StatusBadRequest, "sort parameter must be 'top' or 'problematic'")
	}
}

// handleGetAnomalies returns recent anomalies for a specific agent
func (h *Handler) handleGetAnomalies(w http.ResponseWriter, r *http.Request) {
	if h.anomalyDetector == nil {
		writeError(w, http.StatusServiceUnavailable, "behavioral analytics not enabled")
		return
	}
	
	agentID := r.PathValue("agentID")
	if agentID == "" {
		writeError(w, http.StatusBadRequest, "agent ID required")
		return
	}
	
	// Parse time window
	sinceStr := r.URL.Query().Get("since")
	since := time.Now().Add(-24 * time.Hour) // default: last 24 hours
	if sinceStr != "" {
		if parsed, err := time.Parse(time.RFC3339, sinceStr); err == nil {
			since = parsed
		}
	}
	
	anomalies, err := h.anomalyDetector.GetRecentAnomalies(r.Context(), agentID, since)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get anomalies: %v", err))
		return
	}
	
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"agent_id":   agentID,
		"anomalies":  anomalies,
		"total":      len(anomalies),
		"since":      since,
	})
}

// handleGetBaseline returns behavioral baseline information for a specific agent
func (h *Handler) handleGetBaseline(w http.ResponseWriter, r *http.Request) {
	if h.baselineMgr == nil {
		writeError(w, http.StatusServiceUnavailable, "behavioral analytics not enabled")
		return
	}
	
	agentID := r.PathValue("agentID")
	if agentID == "" {
		writeError(w, http.StatusBadRequest, "agent ID required")
		return
	}
	
	// Get baseline health assessment
	health, err := h.baselineMgr.AssessBaselineHealth(r.Context(), agentID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to assess baseline health: %v", err))
		return
	}
	
	// Get drift analysis
	drift, err := h.baselineMgr.DetectDrift(r.Context(), agentID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to detect drift: %v", err))
		return
	}
	
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"agent_id": agentID,
		"health":   health,
		"drift":    drift,
	})
}

// handleRefreshBaseline triggers a baseline refresh for a specific agent
func (h *Handler) handleRefreshBaseline(w http.ResponseWriter, r *http.Request) {
	if h.baselineMgr == nil {
		writeError(w, http.StatusServiceUnavailable, "behavioral analytics not enabled")
		return
	}
	
	agentID := r.PathValue("agentID")
	if agentID == "" {
		writeError(w, http.StatusBadRequest, "agent ID required")
		return
	}
	
	err := h.baselineMgr.RefreshBaseline(r.Context(), agentID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to refresh baseline: %v", err))
		return
	}
	
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"agent_id": agentID,
		"status":   "baseline refreshed successfully",
	})
}

// handleGetAlerts returns active alerts
func (h *Handler) handleGetAlerts(w http.ResponseWriter, r *http.Request) {
	if h.alertMgr == nil {
		writeError(w, http.StatusServiceUnavailable, "behavioral analytics not enabled")
		return
	}
	
	agentID := r.URL.Query().Get("agent_id")
	
	alerts, err := h.alertMgr.GetActiveAlerts(r.Context(), agentID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get alerts: %v", err))
		return
	}
	
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"alerts": alerts,
		"total":  len(alerts),
	})
}

// handleAcknowledgeAlert acknowledges an alert
func (h *Handler) handleAcknowledgeAlert(w http.ResponseWriter, r *http.Request) {
	if h.alertMgr == nil {
		writeError(w, http.StatusServiceUnavailable, "behavioral analytics not enabled")
		return
	}
	
	alertID := r.PathValue("alertID")
	if alertID == "" {
		writeError(w, http.StatusBadRequest, "alert ID required")
		return
	}
	
	var req struct {
		AcknowledgedBy string `json:"acknowledged_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	
	if req.AcknowledgedBy == "" {
		writeError(w, http.StatusBadRequest, "acknowledged_by required")
		return
	}
	
	err := h.alertMgr.AcknowledgeAlert(r.Context(), alertID, req.AcknowledgedBy)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to acknowledge alert: %v", err))
		return
	}
	
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"alert_id": alertID,
		"status":   "acknowledged",
	})
}

// handleResolveAlert resolves an alert
func (h *Handler) handleResolveAlert(w http.ResponseWriter, r *http.Request) {
	if h.alertMgr == nil {
		writeError(w, http.StatusServiceUnavailable, "behavioral analytics not enabled")
		return
	}
	
	alertID := r.PathValue("alertID")
	if alertID == "" {
		writeError(w, http.StatusBadRequest, "alert ID required")
		return
	}
	
	err := h.alertMgr.ResolveAlert(r.Context(), alertID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to resolve alert: %v", err))
		return
	}
	
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"alert_id": alertID,
		"status":   "resolved",
	})
}