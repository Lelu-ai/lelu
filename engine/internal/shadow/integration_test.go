package shadow

import (
    "testing"

    "github.com/lelu-auth/lelu/engine/internal/confidence"
)

// TestShadowDetectionIntegration is an e2e test covering shadow detection + confidence auditing.
func TestShadowDetectionIntegration(t *testing.T) {
    // 1. Create a shadow detector with a known registry
    knownAgents := map[string]bool{
        "abc123": true, // registered agent fingerprint
    }
    reporter := NewReporter(nil)
    detector := New(knownAgents, reporter)

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

    // 4. If shadow detected, run confidence auditor.
    // Auditor now fails closed — when the endpoint is unreachable it returns an
    // error instead of a neutral 0.5 score. The pipeline must escalate on error.
    auditor := confidence.NewExternalAuditor("http://localhost:8000", "dummy-key")
    auditReq := &confidence.AuditRequest{
        Prompt:          "approve transfer of $10000",
        Action:          "transfer_funds",
        ActorConfidence: 0.95,
        TenantID:        "tenant_demo",
    }

    auditResult, err := auditor.Audit(auditReq)

    escalator := confidence.NewEscalator(nil)
    var action confidence.EscalationAction

    if err != nil {
        // Auditor unavailable: escalate to review (fail-closed).
        t.Logf("Auditor unavailable (expected in unit test): %v — escalating to review", err)
        action = escalator.Escalate(nil, confidence.SeverityHigh)
    } else {
        t.Logf("Audit: actor=%.2f, external=%.2f, drift=%.2f",
            auditResult.ActorScore, auditResult.ExternalScore, auditResult.Drift)
        scorer := confidence.NewScorer(0.3)
        severity := scorer.AssessSeverity(auditResult)
        t.Logf("Severity: %s", severity)
        action = escalator.Escalate(auditResult, severity)
    }
    t.Logf("Escalation action: %s", action)

    // 7. Verify the shadow + confidence error combo triggers review/deny.
    if action != confidence.ActionReview && action != confidence.ActionDeny {
        t.Fatalf("shadow agent + auditor error should escalate to review or deny, got: %s", action)
    }
    t.Log("✓ Shadow agent + confidence check → escalated to review/deny")
}

// TestShadowPlusConfidencePipeline tests the integrated flow end-to-end.
func TestShadowPlusConfidencePipeline(t *testing.T) {
    // Setup
    registry := map[string]bool{} // empty = all agents are shadows in this test
    detector := New(registry, NewReporter(nil))
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

    auditRes, auditErr := auditor.Audit(&confidence.AuditRequest{
        Prompt:          "secret action",
        Action:          "admin_override",
        ActorConfidence: 0.88,
        TenantID:        "test_tenant",
    })

    var severity confidence.SeverityLevel
    var action confidence.EscalationAction
    if auditErr != nil {
        // Fail-closed: auditor unavailable → escalate.
        severity = confidence.SeverityHigh
        action = escalator.Escalate(nil, severity)
    } else {
        severity = scorer.AssessSeverity(auditRes)
        action = escalator.Escalate(auditRes, severity)
    }

    // The important bit: shadow + external audit = decision
    t.Logf("Pipeline result: shadow=%v, severity=%s, action=%s",
        shadowRes.IsShadow, severity, action)

    // Basic check: we made a decision
    if action == "" {
        t.Fatal("escalator should return an action")
    }
}
