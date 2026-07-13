package confidence

import "testing"

// Test auditor fail-closed behaviour: when the LLM endpoint is unreachable,
// Audit() must return an error (not silently return a neutral 0.5 score).
func TestAuditorAuditRequest(t *testing.T) {
	auditor := NewExternalAuditor("http://localhost:8000/vertex", "dummy-key")
	req := &AuditRequest{
		Prompt:          "What is 2+2?",
		Action:          "calculate",
		ActorConfidence: 0.9,
		ActingForUserID: "user_123",
		TenantID:        "tenant_456",
	}

	result, err := auditor.Audit(req)
	// Fail-closed: unreachable endpoint must produce an error, not a neutral pass.
	if err == nil {
		t.Fatalf("expected error when auditor endpoint is unreachable, got result: %+v", result)
	}
	if result != nil {
		t.Fatalf("expected nil result on error, got: %+v", result)
	}
	t.Logf("auditor correctly returned error: %v", err)
}

// Test scorer drift detection
func TestScorerDriftDetection(t *testing.T) {
	scorer := NewScorer(0.3)

	tests := []struct {
		name     string
		drift    float64
		expected bool
	}{
		{"no drift", 0.05, true},
		{"acceptable drift", 0.25, true},
		{"threshold drift", 0.3, true},
		{"unacceptable drift", 0.35, false},
		{"high drift", 0.6, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := &AuditResult{
				Drift:         tt.drift,
				ActorScore:    0.9,
				ExternalScore: 0.9 - tt.drift,
			}
			ok := scorer.ScoreDrift(result)
			if ok != tt.expected {
				t.Fatalf("drift check failed: got %v, want %v", ok, tt.expected)
			}
		})
	}
}

// Test severity assessment
func TestScorerSeverityAssessment(t *testing.T) {
	scorer := NewScorer(0.3)

	tests := []struct {
		drift    float64
		expected SeverityLevel
	}{
		{0.05, SeverityNone},
		{0.15, SeverityLow},
		{0.35, SeverityMedium},
		{0.55, SeverityHigh},
	}

	for _, tt := range tests {
		result := &AuditResult{Drift: tt.drift}
		severity := scorer.AssessSeverity(result)
		if severity != tt.expected {
			t.Fatalf("severity for drift %.2f: got %s, want %s", tt.drift, severity, tt.expected)
		}
	}
}

// Test escalation logic
func TestEscalatorEscalationActions(t *testing.T) {
	escalator := NewEscalator(nil)

	tests := []struct {
		name     string
		severity SeverityLevel
		extScore float64
		expected EscalationAction
	}{
		{"high severity → review", SeverityHigh, 0.7, ActionReview},
		{"medium severity low score → deny", SeverityMedium, 0.4, ActionDeny},
		{"medium severity high score → review", SeverityMedium, 0.6, ActionReview},
		{"low severity → allow", SeverityLow, 0.5, ActionAllow},
		{"none severity → allow", SeverityNone, 0.8, ActionAllow},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := &AuditResult{
				ExternalScore: tt.extScore,
				ActorScore:    0.9,
				Drift:         0.2,
			}
			action := escalator.Escalate(result, tt.severity)
			if action != tt.expected {
				t.Fatalf("escalation: got %s, want %s", action, tt.expected)
			}
		})
	}
}

// Test review task creation
func TestEscalatorCreateReviewTask(t *testing.T) {
	escalator := NewEscalator(nil)
	result := &AuditResult{
		ActorScore:    0.9,
		ExternalScore: 0.6,
		Drift:         0.3,
		Reason:        "significant drift",
	}
	auditReq := &AuditRequest{
		Prompt:   "approve payment",
		Action:   "approve",
		TenantID: "tenant_456",
	}

	task := escalator.CreateReviewTask(result, SeverityMedium, auditReq)
	if task == nil {
		t.Fatal("review task is nil")
	}
	if task["type"] != "confidence_audit" {
		t.Fatalf("task type: got %v", task["type"])
	}
	if task["severity"] != SeverityMedium {
		t.Fatalf("task severity wrong: %v", task["severity"])
	}
}
