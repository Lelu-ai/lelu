# Phase 3: Real-time Intelligence - Implementation Guide

## Overview

Phase 3 implements real-time intelligence capabilities for AI agent observability, including:

- **Predictive Analytics**: AI-powered predictions for confidence scores and human review needs
- **Real-time Alerting**: Automated alerting for anomalies, reputation issues, and drift
- **Policy Optimization**: Automated suggestions for improving policy effectiveness
- **Live Monitoring**: Real-time dashboards and metrics aggregation

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Phase 3 Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Predictive  │  │   Alerting   │  │ Correlation  │      │
│  │  Analytics   │  │   Manager    │  │   Manager    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│  ┌─────────────────────────┴──────────────────────────┐     │
│  │           Observability Foundation                  │     │
│  │  (Tracer, Metrics, Anomaly, Baseline, Reputation)  │     │
│  └─────────────────────────────────────────────────────┘     │
│                            │                                 │
│  ┌─────────────────────────┴──────────────────────────┐     │
│  │              Database & Storage                     │     │
│  └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

#### Go Engine
- `predictive.go` - Predictive analytics engine
- `alerting.go` - Real-time alerting system
- `correlation.go` - Multi-agent trace correlation
- `anomaly.go` - Behavioral anomaly detection (Phase 2)
- `baseline.go` - Baseline management (Phase 2)
- `reputation.go` - Agent reputation scoring (Phase 2)
- `tracer.go` - AI agent tracing (Phase 1)
- `metrics.go` - Enhanced metrics (Phase 1)

#### Python SDK
- `auth_pe/observability.py` - Python observability client
- `test_observability.py` - Comprehensive test suite
- `requirements-test.txt` - Testing dependencies

#### Database
- `migrations/005_phase3_observability.sql` - Phase 3 schema

## Features

### 1. Predictive Analytics

#### Confidence Prediction
Predicts confidence scores for new requests based on historical patterns.

```go
pa := observability.NewPredictiveAnalytics(db, config)

prediction, err := pa.PredictConfidence(ctx, agentID, action)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Predicted confidence: %.2f\n", prediction.PredictedConfidence)
fmt.Printf("Features: %+v\n", prediction.Features)
```

**Features Used:**
- Historical confidence average
- Action frequency
- Recent error rate
- Time of day
- Day of week

#### Human Review Prediction
Predicts which actions will need human review.

```go
prediction, err := pa.PredictHumanReview(ctx, agentID, action, confidence)
if err != nil {
    log.Fatal(err)
}

if prediction.NeedsReview {
    fmt.Printf("Review needed (%.0f%% probability)\n", prediction.ReviewProbability*100)
    fmt.Printf("Risk factors: %v\n", prediction.RiskFactors)
}
```

**Risk Factors Identified:**
- Low confidence scores
- High-risk action types
- Elevated error rates
- Historical review patterns
- Unusual timing

#### Policy Optimization
Suggests improvements to underperforming policies.

```go
suggestions, err := pa.SuggestPolicyOptimizations(ctx)
if err != nil {
    log.Fatal(err)
}

for _, suggestion := range suggestions {
    fmt.Printf("Policy: %s (score: %.2f)\n", suggestion.PolicyName, suggestion.CurrentScore)
    fmt.Printf("Suggestion: %s\n", suggestion.Suggestion)
    fmt.Printf("Expected impact: %.0f%%\n", suggestion.ExpectedImpact*100)
}
```

### 2. Real-time Alerting

#### Alert Types
- **Reputation Alerts**: Low agent reputation scores
- **Anomaly Alerts**: Behavioral anomalies detected
- **Drift Alerts**: Baseline drift detected
- **Custom Alerts**: User-defined alert rules

#### Alert Manager

```go
am := observability.NewAlertManager(db, config)

// Check for reputation issues
err := am.CheckReputationAlert(ctx, agentID, reputation)

// Check for anomalies
err = am.CheckAnomalyAlert(ctx, anomalyResult)

// Check for drift
err = am.CheckDriftAlert(ctx, driftAnalysis)

// Get active alerts
alerts, err := am.GetActiveAlerts(ctx, agentID)
```

#### Alert Channels
- Slack notifications
- Email notifications
- Webhook integrations
- PagerDuty integration

### 3. Multi-Agent Correlation

Track delegation chains and swarm operations across multiple agents.

```go
cm := observability.NewCorrelationManager()

// Start delegation chain
chainID := cm.StartDelegationChain(ctx, delegator, delegatee)

// Extend chain
cm.ExtendDelegationChain(ctx, chainID, newAgent)

// Start swarm operation
cm.StartSwarmOperation(ctx, swarmID, orchestrator, agents)

// Inject correlation headers
headers := make(map[string]string)
cm.InjectCorrelationHeaders(ctx, headers)
```

## Configuration

### Predictive Analytics Config

```go
config := observability.PredictiveConfig{
    // Model parameters
    ConfidenceModelWindow: 30 * 24 * time.Hour, // 30 days
    ReviewModelWindow:     14 * 24 * time.Hour, // 14 days
    MinSamplesForModel:    100,                 // Minimum samples

    // Thresholds
    ConfidencePredictionThreshold: 0.7, // 70%
    ReviewPredictionThreshold:     0.6, // 60%
    PolicyOptimizationThreshold:   0.5, // 50%

    // Update frequency
    ModelUpdateInterval: 6 * time.Hour,    // Retrain every 6 hours
    PredictionCacheTime: 15 * time.Minute, // Cache for 15 minutes

    // Features
    EnableTemporalFeatures:   true,
    EnableContextFeatures:    true,
    EnableHistoricalFeatures: true,
}
```

### Alert Manager Config

```go
config := observability.AlertConfig{
    // Thresholds
    ReputationThreshold: 0.3, // Alert if < 30%
    AnomalyThreshold:    0.7, // Alert if > 70%
    DriftThreshold:      0.5, // Alert if > 50%

    // Timing
    AlertCooldown:   15 * time.Minute, // 15 min cooldown
    AlertEscalation: 1 * time.Hour,    // Escalate after 1 hour
    AlertResolution: 24 * time.Hour,   // Auto-resolve after 24 hours

    // Grouping
    GroupingWindow: 5 * time.Minute, // Group within 5 minutes
    MaxGroupSize:   10,              // Max 10 alerts per group

    // Channels
    EnableSlack:     true,
    EnableEmail:     true,
    EnableWebhook:   false,
    EnablePagerDuty: false,
}
```

## Database Schema

### Key Tables

#### alerts
Stores triggered alerts with status tracking.

```sql
CREATE TABLE alerts (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL,
    priority INTEGER NOT NULL,
    status TEXT NOT NULL,
    ...
);
```

#### confidence_predictions
Tracks confidence predictions and accuracy.

```sql
CREATE TABLE confidence_predictions (
    id INTEGER PRIMARY KEY,
    agent_id TEXT NOT NULL,
    action TEXT NOT NULL,
    predicted_confidence REAL NOT NULL,
    actual_confidence REAL,
    prediction_error REAL,
    features TEXT NOT NULL,
    ...
);
```

#### human_review_predictions
Tracks human review predictions.

```sql
CREATE TABLE human_review_predictions (
    id INTEGER PRIMARY KEY,
    agent_id TEXT NOT NULL,
    needs_review BOOLEAN NOT NULL,
    review_probability REAL NOT NULL,
    risk_factors TEXT NOT NULL,
    actual_needs_review BOOLEAN,
    prediction_correct BOOLEAN,
    ...
);
```

#### policy_optimization_suggestions
Stores policy improvement suggestions.

```sql
CREATE TABLE policy_optimization_suggestions (
    id INTEGER PRIMARY KEY,
    policy_name TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    expected_impact REAL NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    ...
);
```

## Metrics

### Prometheus Metrics

#### Prediction Metrics
- `ai_agent_prediction_accuracy` - Model accuracy (0-1)
- `ai_agent_prediction_latency_seconds` - Prediction latency
- `ai_agent_predictions_total` - Total predictions by type

#### Alert Metrics
- `ai_agent_alerts_triggered_total` - Alerts triggered
- `ai_agent_alerts_resolved_total` - Alerts resolved
- `ai_agent_alert_latency_seconds` - Alert notification latency
- `ai_agent_active_alerts` - Currently active alerts

#### Correlation Metrics
- `ai_swarm_operations_total` - Swarm operations
- `ai_swarm_agent_count` - Agents in swarm
- `ai_agent_delegation_total` - Delegation operations

## Testing

### Run Python Tests

```bash
cd sdk/python

# Build test container
docker build -f Dockerfile.test -t lelu-observability-test .

# Run tests
docker run --rm lelu-observability-test
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

## Performance

### Benchmarks

#### Prediction Latency
- Confidence prediction: < 10ms per prediction
- Human review prediction: < 10ms per prediction
- Policy optimization: < 100ms per analysis

#### Throughput
- Predictions: > 100 predictions/second
- Alerts: > 50 alerts/second
- Correlation tracking: > 200 operations/second

### Optimization Tips

1. **Enable Caching**: Use `PredictionCacheTime` to cache predictions
2. **Batch Processing**: Process multiple predictions in parallel
3. **Model Updates**: Adjust `ModelUpdateInterval` based on data volume
4. **Alert Cooldown**: Use appropriate cooldown periods to reduce noise

## Integration

### With Existing Observability

Phase 3 builds on Phase 1 and Phase 2:

```go
// Phase 1: Tracing
tracer := observability.NewAgentTracer("lelu-engine")
ctx, span := tracer.StartAuthorizationSpan(ctx, agentID, action, confidence)
defer span.End()

// Phase 2: Anomaly Detection
anomalyDetector := observability.NewAnomalyDetector(db, config)
anomalyResult, _ := anomalyDetector.DetectAnomaly(ctx, agentID, agentType, action, confidence, latency, outcome)

// Phase 3: Predictive Analytics
predictive := observability.NewPredictiveAnalytics(db, config)
prediction, _ := predictive.PredictConfidence(ctx, agentID, action)

// Phase 3: Alerting
alertManager := observability.NewAlertManager(db, config)
if anomalyResult.IsAnomaly {
    alertManager.CheckAnomalyAlert(ctx, anomalyResult)
}
```

### With Monitoring Tools

#### Prometheus
Metrics are automatically exported via Prometheus client.

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'lelu-engine'
    static_configs:
      - targets: ['localhost:9090']
```

#### Grafana
Import dashboards from `platform/ui/app/observability/`.

#### Jaeger/Zipkin
Configure OpenTelemetry exporter:

```go
import (
    "go.opentelemetry.io/otel/exporters/jaeger"
)

exporter, _ := jaeger.New(jaeger.WithCollectorEndpoint(
    jaeger.WithEndpoint("http://localhost:14268/api/traces"),
))
```

## Roadmap

### Completed (Phase 3)
- ✅ Predictive analytics engine
- ✅ Real-time alerting system
- ✅ Multi-agent correlation
- ✅ Policy optimization suggestions
- ✅ Database schema and migrations
- ✅ Comprehensive test suite

### Future Enhancements
- [ ] Live observability dashboard UI
- [ ] Advanced ML models (LSTM, Random Forest)
- [ ] Automated policy tuning
- [ ] Integration with DataDog, New Relic
- [ ] Custom alert rule builder UI
- [ ] Real-time streaming analytics
- [ ] Anomaly explanation with SHAP values
- [ ] Multi-tenant observability

## Troubleshooting

### Common Issues

#### Insufficient Training Data
```
Error: insufficient training data: 50 samples (need 100)
```
**Solution**: Collect more historical data or reduce `MinSamplesForModel`.

#### High Prediction Latency
**Solution**: 
- Enable prediction caching
- Reduce feature extraction complexity
- Optimize database queries

#### Too Many Alerts
**Solution**:
- Increase `AlertCooldown` period
- Adjust alert thresholds
- Enable alert grouping

#### Model Accuracy Low
**Solution**:
- Increase training data window
- Enable more feature types
- Retrain models more frequently

## Support

For issues or questions:
- GitHub Issues: https://github.com/lelu-auth/lelu/issues
- Documentation: https://lelu.dev/docs/observability
- Email: support@lelu.dev

## License

MIT License - See LICENSE file for details.
