-- Migration 004: Behavioral Analytics Tables for Phase 2 Observability
-- This migration adds tables for agent reputation, behavioral baselines, anomaly detection, and alerting

-- Agent reputation tracking
CREATE TABLE IF NOT EXISTS agent_reputation (
    agent_id TEXT PRIMARY KEY,
    reputation_score REAL NOT NULL DEFAULT 0.5,
    decision_count INTEGER NOT NULL DEFAULT 0,
    accuracy_rate REAL NOT NULL DEFAULT 0.0,
    calibration_score REAL NOT NULL DEFAULT 0.5,
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Detailed metrics for reputation calculation
    confidence_sum REAL NOT NULL DEFAULT 0.0,
    correct_decisions INTEGER NOT NULL DEFAULT 0,
    high_conf_errors INTEGER NOT NULL DEFAULT 0,
    low_conf_correct INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Behavioral baselines for anomaly detection
CREATE TABLE IF NOT EXISTS behavioral_baselines (
    agent_id TEXT PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sample_count INTEGER NOT NULL DEFAULT 0,
    
    -- Statistical baselines
    confidence_mean REAL NOT NULL DEFAULT 0.0,
    confidence_std_dev REAL NOT NULL DEFAULT 0.0,
    latency_mean REAL NOT NULL DEFAULT 0.0,
    latency_std_dev REAL NOT NULL DEFAULT 0.0,
    
    -- Pattern baselines (stored as JSON)
    action_frequencies TEXT NOT NULL DEFAULT '{}',      -- JSON: {"action": frequency}
    hourly_patterns TEXT NOT NULL DEFAULT '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]', -- JSON: 24-hour array
    decision_outcomes TEXT NOT NULL DEFAULT '{}',       -- JSON: {"outcome": frequency}
    
    -- Advanced features (stored as JSON)
    confidence_distribution TEXT NOT NULL DEFAULT '[]', -- JSON: confidence histogram
    latency_percentiles TEXT NOT NULL DEFAULT '{}'      -- JSON: {"p50": value, "p95": value, etc.}
);

-- Anomaly detection results
CREATE TABLE IF NOT EXISTS anomaly_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    anomaly_score REAL NOT NULL,
    is_anomaly BOOLEAN NOT NULL DEFAULT FALSE,
    severity TEXT NOT NULL DEFAULT 'none',
    
    -- Context
    features TEXT NOT NULL DEFAULT '{}',                -- JSON: feature values
    explanation TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL DEFAULT '',
    confidence REAL NOT NULL DEFAULT 0.0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    outcome TEXT NOT NULL DEFAULT '',
    
    -- Indexing
    FOREIGN KEY (agent_id) REFERENCES agent_reputation(agent_id)
);

-- Agent decision history for baseline calculation and drift detection
CREATE TABLE IF NOT EXISTS agent_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    action TEXT NOT NULL,
    confidence REAL NOT NULL,
    latency_ms INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    was_correct BOOLEAN,
    
    -- Additional context
    risk_score REAL,
    human_review_required BOOLEAN DEFAULT FALSE,
    policy_version TEXT,
    
    -- Correlation
    trace_id TEXT,
    span_id TEXT,
    
    -- Indexing
    INDEX idx_agent_decisions_agent_timestamp (agent_id, timestamp),
    INDEX idx_agent_decisions_timestamp (timestamp),
    FOREIGN KEY (agent_id) REFERENCES agent_reputation(agent_id)
);

-- Alert management
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Alert details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    priority INTEGER NOT NULL DEFAULT 3,
    
    -- Context (stored as JSON)
    trigger_data TEXT NOT NULL DEFAULT '{}',
    context TEXT NOT NULL DEFAULT '{}',
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active',
    acked_by TEXT,
    acked_at TIMESTAMP,
    resolved_at TIMESTAMP,
    
    -- Grouping
    group_id TEXT,
    group_count INTEGER DEFAULT 1,
    
    -- Metadata (stored as JSON)
    tags TEXT NOT NULL DEFAULT '{}',
    channels TEXT NOT NULL DEFAULT '[]',
    
    -- Indexing
    INDEX idx_alerts_agent_status (agent_id, status),
    INDEX idx_alerts_timestamp (timestamp),
    INDEX idx_alerts_status (status),
    FOREIGN KEY (agent_id) REFERENCES agent_reputation(agent_id)
);

-- Alert rules configuration
CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Rule definition (stored as JSON)
    conditions TEXT NOT NULL DEFAULT '[]',
    operator TEXT NOT NULL DEFAULT 'AND',
    
    -- Actions (stored as JSON)
    channels TEXT NOT NULL DEFAULT '[]',
    severity TEXT NOT NULL DEFAULT 'medium',
    priority INTEGER NOT NULL DEFAULT 3,
    
    -- Timing
    cooldown_seconds INTEGER NOT NULL DEFAULT 900,      -- 15 minutes
    escalation_seconds INTEGER NOT NULL DEFAULT 3600,   -- 1 hour
    
    -- Metadata (stored as JSON)
    tags TEXT NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Alert groups for managing related alerts
CREATE TABLE IF NOT EXISTS alert_groups (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    severity TEXT NOT NULL DEFAULT 'medium',
    first_alert TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_alert TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'active',
    
    -- Agent context
    agent_ids TEXT NOT NULL DEFAULT '[]',               -- JSON array of agent IDs
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_reputation_score ON agent_reputation(reputation_score);
CREATE INDEX IF NOT EXISTS idx_agent_reputation_updated ON agent_reputation(last_updated);

CREATE INDEX IF NOT EXISTS idx_behavioral_baselines_updated ON behavioral_baselines(updated_at);
CREATE INDEX IF NOT EXISTS idx_behavioral_baselines_samples ON behavioral_baselines(sample_count);

CREATE INDEX IF NOT EXISTS idx_anomaly_results_agent_timestamp ON anomaly_results(agent_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_anomaly_results_score ON anomaly_results(anomaly_score);
CREATE INDEX IF NOT EXISTS idx_anomaly_results_anomaly ON anomaly_results(is_anomaly);

-- Insert default alert rules
INSERT OR IGNORE INTO alert_rules (id, name, description, conditions, channels, severity, priority) VALUES
('reputation_low', 'Low Agent Reputation', 'Alert when agent reputation drops below threshold', 
 '[{"field":"reputation_score","operator":"lt","value":0.3,"duration":"5m"}]', 
 '["slack","email"]', 'high', 4),

('anomaly_detected', 'Behavioral Anomaly Detected', 'Alert when behavioral anomaly is detected',
 '[{"field":"anomaly_score","operator":"gt","value":0.7,"duration":"1m"}]',
 '["slack","email"]', 'medium', 3),

('baseline_drift', 'Behavioral Baseline Drift', 'Alert when agent behavior drifts from baseline',
 '[{"field":"drift_score","operator":"gt","value":0.5,"duration":"10m"}]',
 '["slack","email"]', 'medium', 3),

('accuracy_drop', 'Agent Accuracy Drop', 'Alert when agent accuracy drops significantly',
 '[{"field":"accuracy_rate","operator":"lt","value":0.7,"duration":"15m"}]',
 '["slack","email"]', 'high', 4),

('confidence_miscalibration', 'Confidence Miscalibration', 'Alert when agent confidence is poorly calibrated',
 '[{"field":"calibration_score","operator":"lt","value":0.4,"duration":"30m"}]',
 '["email"]', 'medium', 3);

-- Add columns to existing audit_events table for enhanced observability
-- (These may already exist from Phase 1, so we use ALTER TABLE IF NOT EXISTS equivalent)
ALTER TABLE audit_events ADD COLUMN span_id TEXT;
ALTER TABLE audit_events ADD COLUMN parent_span_id TEXT;
ALTER TABLE audit_events ADD COLUMN agent_reputation_score REAL;
ALTER TABLE audit_events ADD COLUMN anomaly_score REAL;
ALTER TABLE audit_events ADD COLUMN confidence_score REAL;
ALTER TABLE audit_events ADD COLUMN latency_ms INTEGER;

-- Create indexes on new audit_events columns
CREATE INDEX IF NOT EXISTS idx_audit_events_span_id ON audit_events(span_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_agent_reputation ON audit_events(agent_reputation_score);
CREATE INDEX IF NOT EXISTS idx_audit_events_anomaly_score ON audit_events(anomaly_score);

-- Views for common queries

-- Agent health summary view
CREATE VIEW IF NOT EXISTS agent_health_summary AS
SELECT 
    ar.agent_id,
    ar.reputation_score,
    ar.accuracy_rate,
    ar.calibration_score,
    ar.decision_count,
    bb.sample_count as baseline_samples,
    bb.updated_at as baseline_updated,
    CASE 
        WHEN ar.reputation_score >= 0.8 THEN 'excellent'
        WHEN ar.reputation_score >= 0.6 THEN 'good'
        WHEN ar.reputation_score >= 0.4 THEN 'fair'
        WHEN ar.reputation_score >= 0.2 THEN 'poor'
        ELSE 'critical'
    END as health_status,
    (SELECT COUNT(*) FROM alerts WHERE agent_id = ar.agent_id AND status = 'active') as active_alerts,
    (SELECT COUNT(*) FROM anomaly_results WHERE agent_id = ar.agent_id AND is_anomaly = TRUE AND timestamp > datetime('now', '-24 hours')) as recent_anomalies
FROM agent_reputation ar
LEFT JOIN behavioral_baselines bb ON ar.agent_id = bb.agent_id;

-- Recent anomalies view
CREATE VIEW IF NOT EXISTS recent_anomalies AS
SELECT 
    ar.agent_id,
    ar.timestamp,
    ar.anomaly_score,
    ar.severity,
    ar.explanation,
    ar.action,
    ar.confidence,
    ar.outcome
FROM anomaly_results ar
WHERE ar.is_anomaly = TRUE 
  AND ar.timestamp > datetime('now', '-7 days')
ORDER BY ar.timestamp DESC;

-- Active alerts summary view
CREATE VIEW IF NOT EXISTS active_alerts_summary AS
SELECT 
    a.agent_id,
    COUNT(*) as alert_count,
    MAX(a.severity) as max_severity,
    MIN(a.timestamp) as oldest_alert,
    MAX(a.timestamp) as newest_alert,
    GROUP_CONCAT(DISTINCT a.rule_id) as alert_types
FROM alerts a
WHERE a.status IN ('active', 'acknowledged')
GROUP BY a.agent_id;

-- Commit the transaction
COMMIT;