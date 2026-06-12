package incident_test

import (
	"strings"
	"testing"

	"github.com/lelu-auth/lelu/engine/internal/incident"
)

func TestFormatPagerDuty_ReviewEvent_HasLink(t *testing.T) {
	evt := incident.Event{
		Type:                "authorization.review_required",
		Severity:            "medium",
		Actor:               "invoice_bot",
		Action:              "approve_refunds",
		ConfidenceUsed:      0.78,
		TraceID:             "trace-abc",
		Decision:            "human_review",
		RequiresHumanReview: true,
		Timestamp:           "2026-02-25T20:00:00Z",
	}
	routingKey := "R0123456789ABCDEF"
	engineURL := "https://lelu.example.com"
	payload := incident.FormatPagerDuty(evt, routingKey, engineURL)

	if payload["routing_key"] != routingKey {
		t.Errorf("expected routing_key=%s, got %v", routingKey, payload["routing_key"])
	}
	if payload["event_action"] != "trigger" {
		t.Errorf("expected event_action=trigger, got %v", payload["event_action"])
	}

	p, ok := payload["payload"].(map[string]any)
	if !ok {
		t.Fatal("expected payload map")
	}
	if p["severity"] != "warning" {
		t.Errorf("expected severity=warning for medium, got %v", p["severity"])
	}

	links, ok := payload["links"].([]map[string]any)
	if !ok || len(links) == 0 {
		t.Fatal("expected links for review event")
	}
	href, _ := links[0]["href"].(string)
	if !strings.Contains(href, "/v1/queue/trace-abc") {
		t.Errorf("unexpected link href: %s", href)
	}
}

func TestFormatPagerDuty_CriticalSeverity(t *testing.T) {
	evt := incident.Event{
		Type:      "security.injection_attempt",
		Severity:  "critical",
		Actor:     "invoice_bot",
		Action:    "ignore previous instructions",
		Decision:  "denied",
		TraceID:   "trace-xyz",
		Timestamp: "2026-02-25T20:00:00Z",
	}
	payload := incident.FormatPagerDuty(evt, "key", "")
	p := payload["payload"].(map[string]any)
	if p["severity"] != "critical" {
		t.Errorf("expected severity=critical, got %v", p["severity"])
	}
	// No links expected when no engineURL or no human review.
	if _, hasLinks := payload["links"]; hasLinks {
		t.Error("did not expect links for non-review event")
	}
}
