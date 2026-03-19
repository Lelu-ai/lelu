-- Phase 3: Real-time Intelligence Database Schema
-- Adds tables for predictive analytics, alerts, and real-time monitoring

-- Alerts table for real-time alerting
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Alert details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5),
    
    -- Context
    trigger_data TEXT NOT NULL, -- JSON
    context TEXT NOT NULL,      -- JSON
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    acked_by TEXT,
    acked_at TIMESTAMP,
    resolved_at TIMESTAMP,
    
    -- Grouping
    group_id TEXT,
    group_count INTEGER DEFAULT 1,
    
    -- Metadata
    tags TEXT NOT NULL,     -- JSON
    channels TEXT NOT NULL, -- JSON
    
    -- Indexes
    INDEX idx_alerts_agent_id (agent_id),
    INDEX idx_alerts_status (status),
    INDEX idx_alerts_timestamp (timestamp),
    INDEX idx_alerts_severity (severity)
);

-- Alert rules table
CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Conditions
    conditions TEXT NOT NULL, -- JSON array of conditions
    operator TEXT NOT NULL CHECK (operator IN ('AND', 'OR')),
    
    -- Actions
    channels TEXT NOT NULL, -- JSON array of channel IDs
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5),
    
    -- Timing
    cooldown_seconds INTEGER NOT NULL DEFAULT 900,
    escalation_seconds INTEGER NOT NULL DEFAULT 3600,
    
    -- Metadata
    tags TEXT NOT NULL, -- JSON
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_alert_rules_enabled (enabled)
);

-- Anomaly results table (already exists, but adding indexes)
CREATE TABLE IF NOT EXISTS anomaly_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Anomaly details
    anomaly_score REAL NOT NULL,
    is_anomaly BOOLEAN NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('none', 'low', 'medium', 'high', 'severe')),
    
    -- Context
    features TEXT NOT NULL,    -- JSON
    explanation TEXT NOT NULL,
    
    -- Decision context
    action TEXT NOT NULL,
    confidence REAL NOT NULL,
    latency_ms INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    
    INDEX idx_anomaly_agent_id (agent_id),
    INDEX idx_anomaly_timestamp (timestamp),
    INDEX idx_anomaly_is_anomaly (is_anomaly),
    INDEX idx_anomaly_severity (severity)
);

-- Confidence predictions table
CREATE TABLE IF NOT EXISTS confidence_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    action TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Prediction
    predicted_confidence REAL NOT NULL,
    actual_confidence REAL,
    prediction_error REAL,
    
    -- Features
    features TEXT NOT NULL, -- JSON
    
    -- Model info
    model_version TEXT NOT NULL,
    
    INDEX idx_conf_pred_agent_id (agent_id),
    INDEX idx_conf_pred_timestamp (timestamp)
);

-- Human review predictions table
CREATE TABLE IF NOT EXISTS human_review_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    action TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Prediction
    needs_review BOOLEAN NOT NULL,
    review_probability REAL NOT NULL,
    confidence REAL NOT NULL,
    
    -- Risk factors
    risk_factors TEXT NOT NULL, -- JSON array
    features TEXT NOT NULL,     -- JSON
    
    -- Actual outcome
    actual_needs_review BOOLEAN,
    prediction_correct BOOLEAN,
    
    -- Model info
    model_version TEXT NOT NULL,
    
    INDEX idx_review_pred_agent_id (agent_id),
    INDEX idx_review_pred_timestamp (timestamp),
    INDEX idx_review_pred_needs_review (needs_review)
);

-- Policy optimization suggestions table
CREATE TABLE IF NOT EXISTS policy_optimization_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_name TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Suggestion
    current_score REAL NOT NULL,
    suggestion TEXT NOT NULL,
    expected_impact REAL NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    rationale TEXT NOT NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'implemented')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    
    INDEX idx_policy_opt_policy_name (policy_name),
    INDEX idx_policy_opt_timestamp (timestamp),
    INDEX idx_policy_opt_status (status)
);

-- Policy evaluations table (for tracking policy performance)
CREATE TABLE IF NOT EXISTS policy_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_name TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Evaluation details
    result TEXT NOT NULL CHECK (result IN ('allowed', 'denied', 'error')),
    latency_ms REAL NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'error')),
    
    -- Context
    action TEXT NOT NULL,
    confidence REAL NOT NULL,
    
    INDEX idx_policy_eval_policy_name (policy_name),
    INDEX idx_policy_eval_agent_id (agent_id),
    INDEX idx_policy_eval_timestamp (timestamp),
    INDEX idx_policy_eval_outcome (outcome)
);

-- Agent decisions table (for tracking all agent decisions)
CREATE TABLE IF NOT EXISTS agent_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Decision details
    action TEXT NOT NULL,
    confidence REAL NOT NULL,
    latency_ms INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    
    -- Authorization result
    allowed BOOLEAN NOT NULL,
    requires_human_review BOOLEAN NOT NULL,
    risk_score REAL NOT NULL,
    
    -- Context
    policy_name TEXT,
    policy_version TEXT,
    
    INDEX idx_agent_dec_agent_id (agent_id),
    INDEX idx_agent_dec_timestamp (timestamp),
    INDEX idx_agent_dec_outcome (outcome)
);

-- Real-time metrics aggregation table
CREATE TABLE IF NOT EXISTS metrics_aggregations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    agent_id TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Aggregated values
    count INTEGER NOT NULL DEFAULT 0,
    sum REAL NOT NULL DEFAULT 0,
    min REAL,
    max REAL,
    avg REAL,
    p50 REAL,
    p95 REAL,
    p99 REAL,
    
    -- Time window
    window_start TIMESTAMP NOT NULL,
    window_end TIMESTAMP NOT NULL,
    window_duration_seconds INTEGER NOT NULL,
    
    INDEX idx_metrics_agg_metric_name (metric_name),
    INDEX idx_metrics_agg_agent_id (agent_id),
    INDEX idx_metrics_agg_timestamp (timestamp)
);

-- Dashboard configurations table
CREATE TABLE IF NOT EXISTS dashboard_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Configuration
    config TEXT NOT NULL, -- JSON
    
    -- Metadata
    created_by TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Sharing
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    shared_with TEXT, -- JSON array of user IDs
    
    INDEX idx_dashboard_created_by (created_by),
    INDEX idx_dashboard_is_public (is_public)
);

-- Predictive model metadata table
CREATE TABLE IF NOT EXISTS predictive_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_type TEXT NOT NULL CHECK (model_type IN ('confidence', 'human_review', 'policy_optimization')),
    version TEXT NOT NULL,
    
    -- Model parameters
    weights TEXT NOT NULL, -- JSON
    bias REAL NOT NULL,
    
    -- Performance metrics
    accuracy REAL,
    precision REAL,
    recall REAL,
    f1_score REAL,
    
    -- Training info
    sample_size INTEGER NOT NULL,
    trained_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    training_duration_seconds INTEGER,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    INDEX idx_pred_models_type (model_type),
    INDEX idx_pred_models_active (is_active),
    INDEX idx_pred_models_trained_at (trained_at)
);

-- Create views for common queries

-- Active alerts view
CREATE VIEW IF NOT EXISTS v_active_alerts AS
SELECT 
    a.*,
    ar.name as rule_name,
    ar.description as rule_description
FROM alerts a
LEFT JOIN alert_rules ar ON a.rule_id = ar.id
WHERE a.status IN ('active', 'acknowledged')
ORDER BY a.priority DESC, a.timestamp DESC;

-- Agent performance summary view
CREATE VIEW IF NOT EXISTS v_agent_performance AS
SELECT 
    ar.agent_id,
    ar.reputation_score,
    ar.accuracy_rate,
    ar.decision_count,
    COUNT(DISTINCT aa.id) as anomaly_count,
    COUNT(DISTINCT al.id) as alert_count
FROM agent_reputation ar
LEFT JOIN anomaly_results aa ON ar.agent_id = aa.agent_id AND aa.is_anomaly = TRUE
LEFT JOIN alerts al ON ar.agent_id = al.agent_id AND al.status = 'active'
GROUP BY ar.agent_id;

-- Policy effectiveness view
CREATE VIEW IF NOT EXISTS v_policy_effectiveness AS
SELECT 
    policy_name,
    policy_version,
    COUNT(*) as total_evaluations,
    SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successful_evaluations,
    CAST(SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as success_rate,
    AVG(latency_ms) as avg_latency_ms,
    MIN(timestamp) as first_evaluation,
    MAX(timestamp) as last_evaluation
FROM policy_evaluations
GROUP BY policy_name, policy_version;

-- Recent anomalies view
CREATE VIEW IF NOT EXISTS v_recent_anomalies AS
SELECT 
    ar.*,
    rep.reputation_score,
    rep.accuracy_rate
FROM anomaly_results ar
LEFT JOIN agent_reputation rep ON ar.agent_id = rep.agent_id
WHERE ar.is_anomaly = TRUE
  AND ar.timestamp >= datetime('now', '-7 days')
ORDER BY ar.timestamp DESC;
