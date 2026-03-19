# Phase 3: Real-time Intelligence - Deployment Checklist

## Pre-Deployment Checklist

### 1. Database Preparation

- [ ] **Backup existing database**
  ```bash
  # SQLite
  cp lelu.db lelu.db.backup
  
  # PostgreSQL
  pg_dump lelu > lelu_backup.sql
  ```

- [ ] **Run Phase 3 migration**
  ```bash
  # SQLite
  sqlite3 lelu.db < platform/internal/db/migrations/005_phase3_observability.sql
  
  # PostgreSQL
  psql -d lelu -f platform/internal/db/migrations/005_phase3_observability.sql
  ```

- [ ] **Verify migration success**
  ```bash
  # Check new tables exist
  sqlite3 lelu.db ".tables" | grep -E "(alerts|predictions|policy_optimization)"
  ```

- [ ] **Create indexes for performance**
  ```sql
  -- Already included in migration, but verify
  SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%';
  ```

### 2. Configuration

- [ ] **Review predictive analytics config**
  ```go
  config := observability.PredictiveConfig{
      ConfidenceModelWindow: 30 * 24 * time.Hour,
      ReviewModelWindow:     14 * 24 * time.Hour,
      MinSamplesForModel:    100,
      ModelUpdateInterval:   6 * time.Hour,
  }
  ```

- [ ] **Review alert config**
  ```go
  config := observability.AlertConfig{
      ReputationThreshold: 0.3,
      AnomalyThreshold:    0.7,
      DriftThreshold:      0.5,
      AlertCooldown:       15 * time.Minute,
  }
  ```

- [ ] **Configure alert channels**
  - [ ] Slack webhook URL
  - [ ] Email SMTP settings
  - [ ] PagerDuty API key (if using)
  - [ ] Custom webhook endpoints

- [ ] **Set environment variables**
  ```bash
  export LELU_ALERT_SLACK_WEBHOOK="https://hooks.slack.com/..."
  export LELU_ALERT_EMAIL_SMTP="smtp.gmail.com:587"
  export LELU_ALERT_EMAIL_FROM="alerts@lelu.dev"
  export LELU_PAGERDUTY_API_KEY="your-key-here"
  ```

### 3. Testing

- [ ] **Run Python SDK tests**
  ```bash
  cd sdk/python
  python test_observability.py
  # Expected: 15 tests pass
  ```

- [ ] **Run Go engine tests**
  ```bash
  cd engine/internal/observability
  go test -v ./...
  # Expected: All tests pass
  ```

- [ ] **Test database connectivity**
  ```bash
  # Verify connection
  sqlite3 lelu.db "SELECT COUNT(*) FROM alerts;"
  ```

- [ ] **Test Prometheus metrics**
  ```bash
  curl http://localhost:9090/metrics | grep ai_agent_prediction
  # Should see prediction metrics
  ```

### 4. Monitoring Setup

- [ ] **Configure Prometheus**
  ```yaml
  # prometheus.yml
  scrape_configs:
    - job_name: 'lelu-engine'
      scrape_interval: 15s
      static_configs:
        - targets: ['localhost:9090']
  ```

- [ ] **Import Grafana dashboards**
  - [ ] Observability Overview dashboard
  - [ ] Predictive Analytics dashboard
  - [ ] Alert Management dashboard
  - [ ] Agent Performance dashboard

- [ ] **Set up Jaeger/Zipkin (optional)**
  ```bash
  # Start Jaeger
  docker run -d --name jaeger \
    -p 16686:16686 \
    -p 14268:14268 \
    jaegertracing/all-in-one:latest
  ```

- [ ] **Configure OpenTelemetry exporter**
  ```go
  exporter, _ := jaeger.New(jaeger.WithCollectorEndpoint(
      jaeger.WithEndpoint("http://localhost:14268/api/traces"),
  ))
  ```

### 5. Security

- [ ] **Review database permissions**
  ```sql
  -- Ensure proper access controls
  GRANT SELECT, INSERT, UPDATE ON alerts TO lelu_app;
  GRANT SELECT, INSERT ON confidence_predictions TO lelu_app;
  ```

- [ ] **Secure alert channel credentials**
  - [ ] Use environment variables (not hardcoded)
  - [ ] Encrypt sensitive credentials
  - [ ] Rotate API keys regularly

- [ ] **Enable audit logging**
  ```go
  // Ensure audit trail is enabled
  auditLogger := audit.NewLogger(db)
  ```

- [ ] **Review data retention policies**
  ```sql
  -- Set up automatic cleanup
  DELETE FROM confidence_predictions 
  WHERE timestamp < datetime('now', '-90 days');
  ```

## Deployment Steps

### Step 1: Staging Deployment

- [ ] **Deploy to staging environment**
  ```bash
  # Build and deploy
  make build
  make deploy-staging
  ```

- [ ] **Verify services are running**
  ```bash
  # Check engine status
  curl http://staging.lelu.dev/health
  
  # Check metrics endpoint
  curl http://staging.lelu.dev/metrics
  ```

- [ ] **Run smoke tests**
  ```bash
  # Test prediction endpoint
  curl -X POST http://staging.lelu.dev/api/predict/confidence \
    -H "Content-Type: application/json" \
    -d '{"agent_id":"test_agent","action":"read:data"}'
  ```

- [ ] **Monitor for 24 hours**
  - [ ] Check error rates
  - [ ] Monitor prediction latency
  - [ ] Verify alerts are triggered
  - [ ] Review metrics in Grafana

### Step 2: Production Deployment

- [ ] **Schedule maintenance window**
  - [ ] Notify users
  - [ ] Plan rollback strategy
  - [ ] Prepare incident response team

- [ ] **Deploy to production**
  ```bash
  # Build production image
  make build-production
  
  # Deploy with zero downtime
  make deploy-production
  ```

- [ ] **Verify deployment**
  ```bash
  # Check all services
  kubectl get pods -n lelu
  
  # Verify database migration
  kubectl exec -it lelu-engine-0 -- \
    sqlite3 /data/lelu.db ".tables"
  ```

- [ ] **Enable monitoring**
  - [ ] Verify Prometheus scraping
  - [ ] Check Grafana dashboards
  - [ ] Test alert notifications

### Step 3: Post-Deployment Validation

- [ ] **Run integration tests**
  ```bash
  # Full integration test suite
  make test-integration
  ```

- [ ] **Verify predictive analytics**
  ```bash
  # Test confidence prediction
  curl -X POST http://api.lelu.dev/predict/confidence \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"agent_id":"agent_001","action":"write:database"}'
  ```

- [ ] **Verify alerting**
  ```bash
  # Trigger test alert
  curl -X POST http://api.lelu.dev/test/alert \
    -H "Authorization: Bearer $TOKEN"
  
  # Check Slack/Email for alert
  ```

- [ ] **Verify correlation tracking**
  ```bash
  # Check trace in Jaeger
  open http://jaeger.lelu.dev/search
  ```

- [ ] **Monitor key metrics**
  - [ ] Prediction accuracy: > 80%
  - [ ] Prediction latency: < 10ms
  - [ ] Alert latency: < 50ms
  - [ ] Error rate: < 1%

## Post-Deployment Monitoring

### Week 1: Intensive Monitoring

- [ ] **Daily checks**
  - [ ] Review error logs
  - [ ] Check prediction accuracy
  - [ ] Monitor alert volume
  - [ ] Verify model training

- [ ] **Performance metrics**
  - [ ] Prediction throughput: > 100/sec
  - [ ] Alert throughput: > 50/sec
  - [ ] Database query time: < 100ms
  - [ ] Memory usage: < 2GB

- [ ] **Alert analysis**
  - [ ] Review triggered alerts
  - [ ] Identify false positives
  - [ ] Adjust thresholds if needed

### Week 2-4: Optimization

- [ ] **Model performance**
  - [ ] Review prediction accuracy
  - [ ] Retrain models if needed
  - [ ] Adjust feature weights

- [ ] **Alert tuning**
  - [ ] Reduce false positives
  - [ ] Adjust cooldown periods
  - [ ] Optimize alert grouping

- [ ] **Policy optimization**
  - [ ] Review suggestions
  - [ ] Implement high-priority changes
  - [ ] Measure impact

### Month 2+: Steady State

- [ ] **Weekly reviews**
  - [ ] System health dashboard
  - [ ] Prediction accuracy trends
  - [ ] Alert effectiveness
  - [ ] Policy performance

- [ ] **Monthly optimization**
  - [ ] Model retraining
  - [ ] Configuration tuning
  - [ ] Performance optimization

## Rollback Plan

### If Issues Occur

1. **Immediate Rollback**
   ```bash
   # Rollback to previous version
   kubectl rollout undo deployment/lelu-engine
   
   # Restore database backup
   cp lelu.db.backup lelu.db
   ```

2. **Partial Rollback**
   ```bash
   # Disable predictive analytics only
   kubectl set env deployment/lelu-engine \
     LELU_PREDICTIVE_ENABLED=false
   
   # Disable alerting only
   kubectl set env deployment/lelu-engine \
     LELU_ALERTING_ENABLED=false
   ```

3. **Database Rollback**
   ```sql
   -- Drop Phase 3 tables if needed
   DROP TABLE IF EXISTS alerts;
   DROP TABLE IF EXISTS confidence_predictions;
   DROP TABLE IF EXISTS human_review_predictions;
   -- etc.
   ```

## Success Criteria

### Technical Metrics

- [ ] **Availability**: > 99.9% uptime
- [ ] **Latency**: 
  - [ ] Predictions: < 10ms p99
  - [ ] Alerts: < 50ms p99
  - [ ] Correlation: < 5ms p99

- [ ] **Accuracy**:
  - [ ] Confidence predictions: > 80%
  - [ ] Review predictions: > 75%
  - [ ] Anomaly detection: < 5% false positives

- [ ] **Throughput**:
  - [ ] Predictions: > 100/sec
  - [ ] Alerts: > 50/sec
  - [ ] Correlations: > 200/sec

### Business Metrics

- [ ] **Operational Efficiency**:
  - [ ] 70% faster MTTR
  - [ ] 30% reduction in human review costs
  - [ ] 50% fewer false positive alerts

- [ ] **User Satisfaction**:
  - [ ] Positive feedback from ops team
  - [ ] Reduced alert fatigue
  - [ ] Improved incident response

## Troubleshooting Guide

### Common Issues

#### Issue 1: High Prediction Latency

**Symptoms:**
- Predictions taking > 100ms
- Timeout errors

**Solutions:**
```go
// Enable caching
config.PredictionCacheTime = 15 * time.Minute

// Reduce feature extraction
config.EnableHistoricalFeatures = false
```

#### Issue 2: Too Many Alerts

**Symptoms:**
- Alert fatigue
- Slack channel flooded

**Solutions:**
```go
// Increase cooldown
config.AlertCooldown = 30 * time.Minute

// Raise thresholds
config.AnomalyThreshold = 0.8
```

#### Issue 3: Low Prediction Accuracy

**Symptoms:**
- Accuracy < 70%
- Poor recommendations

**Solutions:**
```bash
# Retrain models with more data
curl -X POST http://api.lelu.dev/admin/retrain-models

# Increase training window
config.ConfidenceModelWindow = 60 * 24 * time.Hour
```

#### Issue 4: Database Performance

**Symptoms:**
- Slow queries
- High CPU usage

**Solutions:**
```sql
-- Add missing indexes
CREATE INDEX idx_predictions_timestamp 
ON confidence_predictions(timestamp);

-- Vacuum database
VACUUM;

-- Analyze tables
ANALYZE;
```

## Support Contacts

- **On-Call Engineer**: oncall@lelu.dev
- **DevOps Team**: devops@lelu.dev
- **Security Team**: security@lelu.dev
- **Product Team**: product@lelu.dev

## Documentation Links

- **Full Documentation**: `README_PHASE3.md`
- **Quick Start Guide**: `PHASE3_QUICKSTART.md`
- **Implementation Summary**: `PHASE3_IMPLEMENTATION_SUMMARY.md`
- **API Documentation**: https://lelu.dev/docs/api
- **Runbook**: https://lelu.dev/docs/runbook

---

**Deployment Date**: _________________

**Deployed By**: _________________

**Sign-off**:
- [ ] Engineering Lead
- [ ] DevOps Lead
- [ ] Security Lead
- [ ] Product Manager

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Completed | ⬜ Rolled Back
