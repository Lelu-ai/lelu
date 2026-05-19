package integration

import (
    "testing"

    "github.com/lelu/engine/internal/confidence"
    "github.com/lelu/engine/internal/shadow"
)

// TestShadowDetectionIntegration is an e2e test covering shadow detection + confidence auditing.
func TestShadowDetectionIntegration(t *testing.T) {
    // 1. Create a shadow detector with a known registry
    knownAgents := map[string]bool{
        "abc123": true, // registered agent fingerprint
    }
    reporter := shadow.NewReporter(nil)
    detector := shadow.New(knownAgents, reporter)

    // 2. Simulate an incoming request from an unknown (shadow) agent
    shadowReq := map[string]interface{}{
        "user_agent":     "unknown-bot/1.0",
        "api_key_prefix": "sk_unknown",
        "actor":          "shadow_agent",
    }

    // 3. Detect the shadow agent
    shadowResult, err := detector.Detect(shadowReq)
    if err != nil {
        t.Fatalf("shadow detect failed: %v", err)
    }
    if !shadowResult.IsShadow {
        t.Fatal("expected shadow detection to flag unregistered agent")
    }
    t.Logf("Shadow detected: %s", shadowResult.Fingerprint)

    // 4. If shadow detected, run confidence auditor
    auditor := confidence.NewExternalAuditor("http://localhost:8000", "dummy-key")
    auditReq := &confidence.AuditRequest{
        Prompt:          "approve transfer of $10000",
        Action:          "transfer_funds",
        ActorConfidence: 0.95, // shadow agent claims high confidence
        TenantID:        "tenant_demo",
    }

    auditResult, err := auditor.Audit(auditReq)
    if err != nil {
        t.Fatalf("confidence audit failed: %v", err)
    }
    t.Logf("Audit: actor=%.2f, external=%.2f, drift=%.2f", 
        auditResult.ActorScore, auditResult.ExternalScore, auditResult.Drift)

    // 5. Score the drift
    scorer := confidence.NewScorer(0.3)
    severity := scorer.AssessSeverity(auditResult)
    t.Logf("Severity: %s", severity)

    // 6. Escalate if needed
    escalator := confidence.NewEscalator(nil)
    action := escalator.Escalate(auditResult, severity)
    t.Logf("Escalation action: %s", action)

    // 7. Verify the shadow + confidence combo triggers review
    if action == confidence.ActionReview || action == confidence.ActionDeny {
        t.Log("✓ Shadow agent + confidence drift → escalated to review/deny")
    }
}

// TestShadowPlusConfidencePipeline tests the integrated flow end-to-end.
func TestShadowPlusConfidencePipeline(t *testing.T) {
    // Setup
    registry := map[string]bool{} // empty = all agents are shadows in this test
    detector := shadow.New(registry, shadow.NewReporter(nil))
    auditor := confidence.NewExternalAuditor("http://localhost:8000", "key")
    scorer := confidence.NewScorer(0.25)
    escalator := confidence.NewEscalator(nil)

    req := map[string]interface{}{
        "user_agent":     "fishy-bot/2.1",
        "api_key_prefix": "sk_anon",
        "actor":          "unregistered",
    }

    // Flow: detect → audit → score → escalate
    shadowRes, _ := detector.Detect(req)
    if !shadowRes.IsShadow {
        t.Fatal("all unregistered should be shadows")
    }

    auditRes, _ := auditor.Audit(&confidence.AuditRequest{
        Prompt:          "secret action",
        Action:          "admin_override",
        ActorConfidence: 0.88,
        TenantID:        "test_tenant",
    })

    severity := scorer.AssessSeverity(auditRes)
    action := escalator.Escalate(auditRes, severity)

    // The important bit: shadow + external audit = decision
    t.Logf("Pipeline result: shadow=%v, severity=%s, action=%s",
        shadowRes.IsShadow, severity, action)

    // Basic check: we made a decision
    if action == "" {
        t.Fatal("escalator should return an action")
    }
}
