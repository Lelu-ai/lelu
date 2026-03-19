package observability

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// AlertManager handles real-time alerting for behavioral anomalies and reputation issues
type AlertManager struct {
	db     *sql.DB
	config AlertConfig

	// Alert channels and handlers
	alertChannels map[string]AlertChannel
	alertRules    []*AlertRule

	// Prometheus metrics
	alertsTriggered prometheus.CounterVec
	alertsResolved  prometheus.CounterVec
	alertLatency    prometheus.HistogramVec
	activeAlerts    prometheus.GaugeVec
}

// AlertConfig configures alerting behavior
type AlertConfig struct {
	// Alert thresholds
	ReputationThreshold float64 // Reputation below this triggers alert
	AnomalyThreshold    float64 // Anomaly score above this triggers alert
	DriftThreshold      float64 // Drift score above this triggers alert

	// Alert timing
	AlertCooldown   time.Duration // Minimum time between same alerts
	AlertEscalation time.Duration // Time before escalating unresolved alerts
	AlertResolution time.Duration // Time to auto-resolve if no new incidents

	// Alert grouping
	GroupingWindow time.Duration // Window for grouping similar alerts
	MaxGroupSize   int           // Maximum alerts in a group

	// Notification settings
	EnableSlack     bool // Enable Slack notifications
	EnableEmail     bool // Enable email notifications
	EnableWebhook   bool // Enable webhook notifications
	EnablePagerDuty bool // Enable PagerDuty integration
}

// AlertChannel defines how alerts are delivered
type AlertChannel interface {
	SendAlert(ctx context.Context, alert *Alert) error
	GetChannelType() string
	IsHealthy() bool
}

// AlertRule defines conditions for triggering alerts
type AlertRule struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`

	// Conditions
	Conditions []AlertCondition `json:"conditions"`
	Operator   string           `json:"operator"` // "AND" or "OR"

	// Actions
	Channels []string `json:"channels"` // Channel IDs to notify
	Severity string   `json:"severity"` // "low", "medium", "high", "critical"
	Priority int      `json:"priority"` // 1-5, higher = more urgent

	// Timing
	Cooldown   time.Duration `json:"cooldown"`
	Escalation time.Duration `json:"escalation"`

	// Metadata
	Tags      map[string]string `json:"tags"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}

// AlertCondition defines a specific condition for triggering alerts
type AlertCondition struct {
	Field    string        `json:"field"`    // "reputation", "anomaly_score", "drift_score", etc.
	Operator string        `json:"operator"` // "lt", "gt", "eq", "ne", "contains"
	Value    interface{}   `json:"value"`    // Threshold value
	Duration time.Duration `json:"duration"` // How long condition must be true
}

// Alert represents a triggered alert
type Alert struct {
	ID        string    `json:"id"`
	RuleID    string    `json:"rule_id"`
	AgentID   string    `json:"agent_id"`
	Timestamp time.Time `json:"timestamp"`

	// Alert details
	Title       string `json:"title"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
	Priority    int    `json:"priority"`

	// Context
	TriggerData map[string]interface{} `json:"trigger_data"`
	Context     map[string]interface{} `json:"context"`

	// Status
	Status     string     `json:"status"` // "active", "acknowledged", "resolved"
	AckedBy    string     `json:"acked_by"`
	AckedAt    *time.Time `json:"acked_at"`
	ResolvedAt *time.Time `json:"resolved_at"`

	// Grouping
	GroupID    string `json:"group_id"`
	GroupCount int    `json:"group_count"`

	// Metadata
	Tags     map[string]string `json:"tags"`
	Channels []string          `json:"channels"`
}

// AlertGroup represents a group of related alerts
type AlertGroup struct {
	ID         string    `json:"id"`
	Title      string    `json:"title"`
	Count      int       `json:"count"`
	Severity   string    `json:"severity"`
	FirstAlert time.Time `json:"first_alert"`
	LastAlert  time.Time `json:"last_alert"`
	Status     string    `json:"status"`
	AgentIDs   []string  `json:"agent_ids"`
}

// DefaultAlertConfig returns sensible defaults for alerting
func DefaultAlertConfig() AlertConfig {
	return AlertConfig{
		ReputationThreshold: 0.3, // Alert if reputation < 30%
		AnomalyThreshold:    0.7, // Alert if anomaly score > 70%
		DriftThreshold:      0.5, // Alert if drift score > 50%

		AlertCooldown:   15 * time.Minute, // 15 min cooldown
		AlertEscalation: 1 * time.Hour,    // Escalate after 1 hour
		AlertResolution: 24 * time.Hour,   // Auto-resolve after 24 hours

		GroupingWindow: 5 * time.Minute, // Group alerts within 5 minutes
		MaxGroupSize:   10,              // Max 10 alerts per group

		EnableSlack:     true,
		EnableEmail:     true,
		EnableWebhook:   false,
		EnablePagerDuty: false,
	}
}

// NewAlertManager creates a new alert manager
func NewAlertManager(db *sql.DB, config AlertConfig) *AlertManager {
	am := &AlertManager{
		db:            db,
		config:        config,
		alertChannels: make(map[string]AlertChannel),
		alertRules:    []*AlertRule{},

		alertsTriggered: *promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "ai_agent_alerts_triggered_total",
				Help: "Total alerts triggered for AI agents",
			},
			[]string{"agent_id", "rule_id", "severity"},
		),

		alertsResolved: *promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "ai_agent_alerts_resolved_total",
				Help: "Total alerts resolved for AI agents",
			},
			[]string{"agent_id", "rule_id", "severity"},
		),

		alertLatency: *promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "ai_agent_alert_latency_seconds",
				Help:    "Latency from trigger to notification",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"channel_type"},
		),

		activeAlerts: *promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "ai_agent_active_alerts",
				Help: "Number of active alerts for AI agents",
			},
			[]string{"agent_id", "severity"},
		),
	}

	// Load default alert rules
	am.loadDefaultAlertRules()

	// Start background processes
	go am.startAlertProcessor()
	go am.startAlertResolver()

	return am
}

// CheckReputationAlert checks if reputation triggers an alert
func (am *AlertManager) CheckReputationAlert(ctx context.Context, agentID string, reputation *AgentReputation) error {
	if reputation.ReputationScore >= am.config.ReputationThreshold {
		return nil // No alert needed
	}

	// Check if we're in cooldown period
	if am.isInCooldown(ctx, agentID, "reputation_low") {
		return nil
	}

	// Create alert
	alert := &Alert{
		ID:        am.generateAlertID(),
		RuleID:    "reputation_low",
		AgentID:   agentID,
		Timestamp: time.Now(),

		Title: fmt.Sprintf("Low Agent Reputation: %s", agentID),
		Description: fmt.Sprintf("Agent reputation dropped to %.2f (threshold: %.2f)",
			reputation.ReputationScore, am.config.ReputationThreshold),
		Severity: am.getReputationSeverity(reputation.ReputationScore),
		Priority: am.getReputationPriority(reputation.ReputationScore),

		TriggerData: map[string]interface{}{
			"reputation_score": reputation.ReputationScore,
			"accuracy_rate":    reputation.AccuracyRate,
			"decision_count":   reputation.DecisionCount,
			"calibration":      reputation.CalibrationScore,
		},

		Context:  map[string]interface{}{},
		Status:   "active",
		Channels: []string{"slack", "email"},
		Tags: map[string]string{
			"alert_type": "reputation",
			"agent_id":   agentID,
		},
	}

	return am.triggerAlert(ctx, alert)
}

// CheckAnomalyAlert checks if anomaly detection triggers an alert
func (am *AlertManager) CheckAnomalyAlert(ctx context.Context, result *AnomalyResult) error {
	if !result.IsAnomaly || result.AnomalyScore < am.config.AnomalyThreshold {
		return nil // No alert needed
	}

	// Check cooldown
	if am.isInCooldown(ctx, result.AgentID, "anomaly_detected") {
		return nil
	}

	alert := &Alert{
		ID:        am.generateAlertID(),
		RuleID:    "anomaly_detected",
		AgentID:   result.AgentID,
		Timestamp: result.Timestamp,

		Title: fmt.Sprintf("Behavioral Anomaly: %s", result.AgentID),
		Description: fmt.Sprintf("Anomaly detected with score %.2f: %s",
			result.AnomalyScore, result.Explanation),
		Severity: result.Severity,
		Priority: am.getAnomalyPriority(result.AnomalyScore),

		TriggerData: map[string]interface{}{
			"anomaly_score": result.AnomalyScore,
			"features":      result.Features,
			"action":        result.Action,
			"confidence":    result.Confidence,
		},

		Status:   "active",
		Channels: []string{"slack", "email"},
		Tags: map[string]string{
			"alert_type": "anomaly",
			"agent_id":   result.AgentID,
			"severity":   result.Severity,
		},
	}

	return am.triggerAlert(ctx, alert)
}

// CheckDriftAlert checks if baseline drift triggers an alert
func (am *AlertManager) CheckDriftAlert(ctx context.Context, analysis *DriftAnalysis) error {
	if analysis.DriftScore < am.config.DriftThreshold {
		return nil // No alert needed
	}

	// Check cooldown
	if am.isInCooldown(ctx, analysis.AgentID, "baseline_drift") {
		return nil
	}

	alert := &Alert{
		ID:        am.generateAlertID(),
		RuleID:    "baseline_drift",
		AgentID:   analysis.AgentID,
		Timestamp: analysis.DetectedAt,

		Title: fmt.Sprintf("Baseline Drift: %s", analysis.AgentID),
		Description: fmt.Sprintf("Behavioral drift detected (%.2f): %s",
			analysis.DriftScore, analysis.Explanation),
		Severity: analysis.Severity,
		Priority: am.getDriftPriority(analysis.DriftScore),

		TriggerData: map[string]interface{}{
			"drift_score":      analysis.DriftScore,
			"drift_type":       analysis.DriftType,
			"confidence_drift": analysis.ConfidenceDrift,
			"latency_drift":    analysis.LatencyDrift,
			"pattern_drift":    analysis.PatternDrift,
		},

		Status:   "active",
		Channels: []string{"slack", "email"},
		Tags: map[string]string{
			"alert_type": "drift",
			"agent_id":   analysis.AgentID,
			"drift_type": analysis.DriftType,
		},
	}

	return am.triggerAlert(ctx, alert)
}

// triggerAlert processes and sends an alert
func (am *AlertManager) triggerAlert(ctx context.Context, alert *Alert) error {
	startTime := time.Now()

	// Store alert in database
	err := am.storeAlert(ctx, alert)
	if err != nil {
		return fmt.Errorf("failed to store alert: %w", err)
	}

	// Check for grouping
	groupID := am.findOrCreateGroup(ctx, alert)
	if groupID != "" {
		alert.GroupID = groupID
	}

	// Send notifications
	for _, channelID := range alert.Channels {
		if channel, exists := am.alertChannels[channelID]; exists && channel.IsHealthy() {
			go func(ch AlertChannel) {
				err := ch.SendAlert(ctx, alert)
				if err != nil {
					// Log error but don't fail the alert
					fmt.Printf("Failed to send alert via %s: %v\n", ch.GetChannelType(), err)
				}

				// Record latency
				am.alertLatency.WithLabelValues(ch.GetChannelType()).Observe(time.Since(startTime).Seconds())
			}(channel)
		}
	}

	// Update metrics
	am.alertsTriggered.WithLabelValues(alert.AgentID, alert.RuleID, alert.Severity).Inc()
	am.activeAlerts.WithLabelValues(alert.AgentID, alert.Severity).Inc()

	return nil
}

// AcknowledgeAlert marks an alert as acknowledged
func (am *AlertManager) AcknowledgeAlert(ctx context.Context, alertID, acknowledgedBy string) error {
	now := time.Now()
	query := `
		UPDATE alerts 
		SET status = 'acknowledged', acked_by = ?, acked_at = ?
		WHERE id = ? AND status = 'active'
	`

	_, err := am.db.ExecContext(ctx, query, acknowledgedBy, now, alertID)
	if err != nil {
		return fmt.Errorf("failed to acknowledge alert: %w", err)
	}

	return nil
}

// ResolveAlert marks an alert as resolved
func (am *AlertManager) ResolveAlert(ctx context.Context, alertID string) error {
	now := time.Now()

	// Get alert details for metrics update
	var agentID, ruleID, severity string
	query := `SELECT agent_id, rule_id, severity FROM alerts WHERE id = ?`
	err := am.db.QueryRowContext(ctx, query, alertID).Scan(&agentID, &ruleID, &severity)
	if err != nil {
		return fmt.Errorf("failed to get alert details: %w", err)
	}

	// Update alert status
	updateQuery := `
		UPDATE alerts 
		SET status = 'resolved', resolved_at = ?
		WHERE id = ? AND status IN ('active', 'acknowledged')
	`

	_, err = am.db.ExecContext(ctx, updateQuery, now, alertID)
	if err != nil {
		return fmt.Errorf("failed to resolve alert: %w", err)
	}

	// Update metrics
	am.alertsResolved.WithLabelValues(agentID, ruleID, severity).Inc()
	am.activeAlerts.WithLabelValues(agentID, severity).Dec()

	return nil
}

// GetActiveAlerts retrieves currently active alerts
func (am *AlertManager) GetActiveAlerts(ctx context.Context, agentID string) ([]*Alert, error) {
	var query string
	var rows *sql.Rows
	var err error

	if agentID != "" {
		query = `
			SELECT id, rule_id, agent_id, timestamp, title, description, severity, priority,
				   trigger_data, context, status, acked_by, acked_at, resolved_at,
				   group_id, group_count, tags, channels
			FROM alerts 
			WHERE status IN ('active', 'acknowledged') AND agent_id = ?
			ORDER BY timestamp DESC
		`
		rows, err = am.db.QueryContext(ctx, query, agentID)
	} else {
		query = `
			SELECT id, rule_id, agent_id, timestamp, title, description, severity, priority,
				   trigger_data, context, status, acked_by, acked_at, resolved_at,
				   group_id, group_count, tags, channels
			FROM alerts 
			WHERE status IN ('active', 'acknowledged')
			ORDER BY timestamp DESC
		`
		rows, err = am.db.QueryContext(ctx, query)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get active alerts: %w", err)
	}
	defer rows.Close()

	var alerts []*Alert
	for rows.Next() {
		alert, err := am.scanAlert(rows)
		if err != nil {
			continue
		}
		alerts = append(alerts, alert)
	}

	// Return empty slice instead of nil if no alerts
	if alerts == nil {
		alerts = []*Alert{}
	}

	return alerts, nil
}

// Helper methods

func (am *AlertManager) generateAlertID() string {
	return fmt.Sprintf("alert_%d", time.Now().UnixNano())
}

func (am *AlertManager) isInCooldown(ctx context.Context, agentID, ruleID string) bool {
	query := `
		SELECT COUNT(*) FROM alerts 
		WHERE agent_id = ? AND rule_id = ? AND timestamp > ?
	`

	since := time.Now().Add(-am.config.AlertCooldown)
	var count int
	err := am.db.QueryRowContext(ctx, query, agentID, ruleID, since).Scan(&count)

	return err == nil && count > 0
}

func (am *AlertManager) getReputationSeverity(score float64) string {
	switch {
	case score < 0.1:
		return "critical"
	case score < 0.2:
		return "high"
	case score < 0.3:
		return "medium"
	default:
		return "low"
	}
}

func (am *AlertManager) getReputationPriority(score float64) int {
	switch {
	case score < 0.1:
		return 5 // Critical
	case score < 0.2:
		return 4 // High
	case score < 0.3:
		return 3 // Medium
	default:
		return 2 // Low
	}
}

func (am *AlertManager) getAnomalyPriority(score float64) int {
	switch {
	case score >= 0.9:
		return 5 // Critical
	case score >= 0.8:
		return 4 // High
	case score >= 0.7:
		return 3 // Medium
	default:
		return 2 // Low
	}
}

func (am *AlertManager) getDriftPriority(score float64) int {
	switch {
	case score >= 0.8:
		return 4 // High
	case score >= 0.6:
		return 3 // Medium
	default:
		return 2 // Low
	}
}

func (am *AlertManager) storeAlert(ctx context.Context, alert *Alert) error {
	triggerDataJSON, _ := json.Marshal(alert.TriggerData)
	contextJSON, _ := json.Marshal(alert.Context)
	tagsJSON, _ := json.Marshal(alert.Tags)
	channelsJSON, _ := json.Marshal(alert.Channels)

	// Set defaults for optional fields
	if alert.GroupID == "" {
		alert.GroupID = ""
	}
	if alert.GroupCount == 0 {
		alert.GroupCount = 1
	}

	query := `
		INSERT INTO alerts (
			id, rule_id, agent_id, timestamp, title, description, severity, priority,
			trigger_data, context, status, group_id, group_count, tags, channels
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := am.db.ExecContext(ctx, query,
		alert.ID, alert.RuleID, alert.AgentID, alert.Timestamp, alert.Title, alert.Description,
		alert.Severity, alert.Priority, string(triggerDataJSON), string(contextJSON),
		alert.Status, alert.GroupID, alert.GroupCount, string(tagsJSON), string(channelsJSON),
	)

	if err != nil {
		return fmt.Errorf("failed to store alert: %w", err)
	}

	return nil
}

func (am *AlertManager) scanAlert(rows *sql.Rows) (*Alert, error) {
	var alert Alert
	var triggerDataJSON, contextJSON, tagsJSON, channelsJSON string
	var ackedAt, resolvedAt *time.Time

	err := rows.Scan(
		&alert.ID, &alert.RuleID, &alert.AgentID, &alert.Timestamp, &alert.Title, &alert.Description,
		&alert.Severity, &alert.Priority, &triggerDataJSON, &contextJSON, &alert.Status,
		&alert.AckedBy, &ackedAt, &resolvedAt, &alert.GroupID, &alert.GroupCount,
		&tagsJSON, &channelsJSON,
	)

	if err != nil {
		return nil, err
	}

	alert.AckedAt = ackedAt
	alert.ResolvedAt = resolvedAt

	// Unmarshal JSON fields with error checking
	if err := json.Unmarshal([]byte(triggerDataJSON), &alert.TriggerData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal trigger data: %w", err)
	}
	if err := json.Unmarshal([]byte(contextJSON), &alert.Context); err != nil {
		return nil, fmt.Errorf("failed to unmarshal context: %w", err)
	}
	if err := json.Unmarshal([]byte(tagsJSON), &alert.Tags); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tags: %w", err)
	}
	if err := json.Unmarshal([]byte(channelsJSON), &alert.Channels); err != nil {
		return nil, fmt.Errorf("failed to unmarshal channels: %w", err)
	}

	return &alert, nil
}

func (am *AlertManager) findOrCreateGroup(_ context.Context, _ *Alert) string {
	// Implementation would find or create alert groups
	return ""
}

func (am *AlertManager) loadDefaultAlertRules() {
	// Implementation would load default alert rules
}

func (am *AlertManager) startAlertProcessor() {
	// Implementation would run background alert processing
}

func (am *AlertManager) startAlertResolver() {
	// Implementation would run background alert resolution
}
