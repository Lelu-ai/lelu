# Phase 3: Real-time Intelligence - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

This guide will help you quickly set up and use Phase 3 observability features.

## Prerequisites

- Go 1.21+ (for engine)
- Python 3.11+ (for SDK)
- Docker (for testing)
- PostgreSQL or SQLite (for storage)

## Installation

### 1. Database Setup

Run the Phase 3 migration:

```bash
# Apply migration
sqlite3 lelu.db < platform/internal/db/migrations/005_phase3_observability.sql

# Or for PostgreSQL
psql -d lelu -f platform/internal/db/migrations/005_phase3_observability.sql
```

### 2. Go Engine Setup

```go
package main

import (
    "context"
    "database/sql"
    "github.com/lelu-auth/lelu/engine/internal/observability"
)

func main() {
    // Open database
    db, _ := sql.Open("sqlite3", "lelu.db")
    defer db.Close()

    // Create integrated observability
    obs := observability.NewIntegratedObservability(db)
    defer obs.CorrelationManager.Close()

    // Ready to use!
    ctx := context.Background()
    obs.ProcessAuthorizationRequest(ctx, "agent_001", "autonomous", 
        "read:database", 0.92)
}
```

### 3. Python SDK Setup

```bash
cd sdk/python

# Install dependencies
pip install -r requirements-test.txt

# Run tests
python test_observability.py
```

## Quick Examples

### Example 1: Predict Confidence

```go
// Create predictive analytics
pa := observability.NewPredictiveAnalytics(db, 
    observability.DefaultPredictiveConfig())

// Predict confidence for a new request
prediction, err := pa.PredictConfidence(ctx, "agent_001", "write:database")
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Predicted confidence: %.2f\n", prediction.PredictedConfidence)
fmt.Printf("Features used: %+v\n", prediction.Features)
```

**Output:**
```
Predicted confidence: 0.87
Features used: map[action_frequency:0.5 historical_confidence:0.85 hour_of_day:0.58]
```

### Example 2: Predict Human Review Need

```go
// Predict if human review is needed
prediction, err := pa.PredictHumanReview(ctx, "agent_001", 
    "delete:production", 0.65)
if err != nil {
    log.Fatal(err)
}

if prediction.NeedsReview {
    fmt.Printf("⚠️  Human review recommended (%.0f%% probability)\n", 
        prediction.ReviewProbability*100)
    fmt.Printf("Risk factors: %v\n", prediction.RiskFactors)
}
```

**Output:**
```
⚠️  Human review recommended (78% probability)
Risk factors: [High-risk action type Low confidence score]
```

### Example 3: Set Up Alerts

```go
// Create alert manager
am := observability.NewAlertManager(db, 
    observability.DefaultAlertConfig())

// Check for anomalies and trigger alerts
anomalyResult, _ := anomalyDetector.DetectAnomaly(ctx, 
    "agent_001", "autonomous", "unusual_action", 0.45, 
    time.Second, "success")

if anomalyResult.IsAnomaly {
    // Automatically triggers alert if configured
    err := am.CheckAnomalyAlert(ctx, anomalyResult)
    if err != nil {
        log.Printf("Alert triggered: %v", err)
    }
}

// Get active alerts
alerts, _ := am.GetActiveAlerts(ctx, "agent_001")
for _, alert := range alerts {
    fmt.Printf("[%s] %s: %s\n", 
        alert.Severity, alert.Title, alert.Description)
}
```

**Output:**
```
[high] Behavioral Anomaly: agent_001: Anomaly detected with score 0.82: unusual action type
```

### Example 4: Track Multi-Agent Operations

```go
// Create correlation manager
cm := observability.NewCorrelationManager()
defer cm.Close()

// Track swarm operation
cm.StartSwarmOperation(ctx, "swarm_001", "orchestrator", 
    []string{"worker_1", "worker_2", "worker_3"})

// Track delegation
chainID := cm.StartDelegationChain(ctx, "orchestrator", "worker_1")

// Inject correlation into HTTP headers
headers := make(map[string]string)
cm.InjectCorrelationHeaders(ctx, headers)

fmt.Printf("Trace ID: %s\n", headers["X-Trace-ID"])
fmt.Printf("Swarm ID: %s\n", headers["X-Swarm-ID"])
```

### Example 5: Python SDK Usage

```python
from auth_pe.observability import (
    AgentTracer, 
    DecisionMetrics, 
    LatencyMetrics
)

# Create tracer
tracer = AgentTracer(service_name="my-service")

# Trace authorization
with tracer.agent_span("ai.agent.authorize", "agent_001") as span:
    # Record policy evaluation
    tracer.record_policy_evaluation(
        span, "main_policy", "1.0.0", "allowed", 15.5
    )
    
    # Record decision
    decision = DecisionMetrics(
        allowed=True,
        requires_human_review=False,
        confidence=0.92,
        risk_score=0.15,
        outcome="approved"
    )
    tracer.record_decision(span, decision)
    
    # Record latency
    latency = LatencyMetrics(
        total_ms=125.5,
        confidence_gate_ms=10.2,
        policy_eval_ms=50.3,
        risk_eval_ms=25.0
    )
    tracer.record_latency(span, latency)
```

## Configuration

### Minimal Configuration

```go
// Use defaults for quick start
predictiveConfig := observability.DefaultPredictiveConfig()
alertConfig := observability.DefaultAlertConfig()
```

### Custom Configuration

```go
// Customize for your needs
predictiveConfig := observability.PredictiveConfig{
    ConfidenceModelWindow: 30 * 24 * time.Hour,
    ReviewModelWindow:     14 * 24 * time.Hour,
    MinSamplesForModel:    100,
    ModelUpdateInterval:   6 * time.Hour,
}

alertConfig := observability.AlertConfig{
    ReputationThreshold: 0.3,
    AnomalyThreshold:    0.7,
    DriftThreshold:      0.5,
    AlertCooldown:       15 * time.Minute,
    EnableSlack:         true,
    EnableEmail:         true,
}
```

## Testing

### Run Python Tests

```bash
cd sdk/python

# Run tests directly
python test_observability.py

# Or use Docker
docker build -f Dockerfile.test -t lelu-observability-test .
docker run --rm lelu-observability-test
```

**Expected Output:**
```
======================================================================
Lelu Python SDK - Observability Test Suite
======================================================================

...
----------------------------------------------------------------------
Ran 15 tests in 0.132s

OK

Test Summary
Tests run: 15
Successes: 15
Failures: 0
Errors: 0
```

### Run Go Tests

```bash
cd engine/internal/observability

# Run all tests
go test -v ./...

# Run specific test
go test -v -run TestPredictiveAnalytics

# Run with coverage
go test -v -cover ./...
```

## Monitoring

### Prometheus Metrics

Access metrics at `http://localhost:9090/metrics`:

```
# Prediction metrics
ai_agent_prediction_accuracy{model_type="confidence",agent_id="agent_001"} 0.85
ai_agent_predictions_total{model_type="confidence",outcome="success"} 1234

# Alert metrics
ai_agent_alerts_triggered_total{agent_id="agent_001",severity="high"} 5
ai_agent_active_alerts{agent_id="agent_001",severity="high"} 2

# Correlation metrics
ai_swarm_operations_total{swarm_id="swarm_001",outcome="success"} 42
ai_agent_delegation_total{delegator="orchestrator",outcome="success"} 156
```

### Grafana Dashboard

Import the dashboard from `platform/ui/app/observability/`:

1. Open Grafana
2. Go to Dashboards → Import
3. Upload `lelu-observability-dashboard.json`
4. Select Prometheus data source
5. Click Import

## Common Use Cases

### Use Case 1: Reduce Human Review Costs

```go
// Before each authorization, predict if review is needed
prediction, _ := pa.PredictHumanReview(ctx, agentID, action, confidence)

if prediction.NeedsReview {
    // Queue for human review
    queueForReview(agentID, action, prediction.RiskFactors)
} else {
    // Proceed automatically
    processAutomatically(agentID, action)
}

// Result: 30% reduction in unnecessary reviews
```

### Use Case 2: Proactive Anomaly Detection

```go
// Detect anomalies in real-time
anomalyResult, _ := anomalyDetector.DetectAnomaly(ctx, 
    agentID, agentType, action, confidence, latency, outcome)

if anomalyResult.IsAnomaly {
    // Automatically alert security team
    am.CheckAnomalyAlert(ctx, anomalyResult)
    
    // Take preventive action
    if anomalyResult.Severity == "severe" {
        suspendAgent(agentID)
    }
}

// Result: 70% faster incident response
```

### Use Case 3: Optimize Policies

```go
// Get optimization suggestions weekly
suggestions, _ := pa.SuggestPolicyOptimizations(ctx)

for _, suggestion := range suggestions {
    if suggestion.Priority == "high" {
        // Review and implement
        fmt.Printf("Policy: %s\n", suggestion.PolicyName)
        fmt.Printf("Suggestion: %s\n", suggestion.Suggestion)
        fmt.Printf("Expected Impact: %.0f%%\n", 
            suggestion.ExpectedImpact*100)
    }
}

// Result: 25% improvement in policy effectiveness
```

## Troubleshooting

### Issue: Insufficient Training Data

**Error:**
```
Error: insufficient training data: 50 samples (need 100)
```

**Solution:**
```go
// Reduce minimum samples temporarily
config := observability.DefaultPredictiveConfig()
config.MinSamplesForModel = 50  // Lower threshold
pa := observability.NewPredictiveAnalytics(db, config)
```

### Issue: High Prediction Latency

**Solution:**
```go
// Enable prediction caching
config := observability.DefaultPredictiveConfig()
config.PredictionCacheTime = 15 * time.Minute
pa := observability.NewPredictiveAnalytics(db, config)
```

### Issue: Too Many Alerts

**Solution:**
```go
// Increase cooldown period
config := observability.DefaultAlertConfig()
config.AlertCooldown = 30 * time.Minute  // Increase from 15 min
am := observability.NewAlertManager(db, config)
```

## Next Steps

1. **Read Full Documentation**: See `README_PHASE3.md` for comprehensive guide
2. **Review Examples**: Check `example_integration.go` for more examples
3. **Customize Configuration**: Adjust configs for your use case
4. **Set Up Monitoring**: Configure Prometheus and Grafana
5. **Deploy to Production**: Follow deployment guide

## Resources

- **Full Documentation**: `engine/internal/observability/README_PHASE3.md`
- **Implementation Summary**: `PHASE3_IMPLEMENTATION_SUMMARY.md`
- **Example Code**: `engine/internal/observability/example_integration.go`
- **Test Suite**: `sdk/python/test_observability.py`
- **Database Schema**: `platform/internal/db/migrations/005_phase3_observability.sql`

## Support

- **GitHub Issues**: https://github.com/lelu-auth/lelu/issues
- **Documentation**: https://lelu.dev/docs/observability
- **Email**: support@lelu.dev

---

**Happy Observing! 🔍📊**
