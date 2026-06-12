package incident_test

import (
	"strings"
	"testing"

	"github.com/lelu-auth/lelu/engine/internal/incident"
)

func TestFormatSlack_RequiresHumanReview(t *testing.T) {
	evt := incident.Event{
		Type:                "authorization.review_required",
		Severity:            "medium",
		Actor:               "invoice_bot",
		Action:              "approve_refunds",
		ConfidenceUsed:      0.78,
		ActingFor:           "user_123",
		Reason:              "confidence below human-review threshold",
		TraceID:             "trace-abc",
		Decision:            "human_review",
		RequiresHumanReview: true,
		Timestamp:           "2026-02-25T20:00:00Z",
	}
	engineURL := "https://lelu.example.com"

	payload := incident.FormatSlack(evt, engineURL)

	blocks, ok := payload["blocks"].([]map[string]any)
	if !ok || len(blocks) == 0 {
		t.Fatal("expected non-empty blocks slice")
	}

	// Verify header block contains expected text.
	header := blocks[0]
	if header["type"] != "header" {
		t.Errorf("expected first block type=header, got %v", header["type"])
	}

	// Verify actions block exists and contains approve/deny buttons.
	found := false
	for _, b := range blocks {
		if b["type"] == "actions" {
			elements, _ := b["elements"].([]map[string]any)
			if len(elements) != 2 {
				t.Errorf("expected 2 action buttons, got %d", len(elements))
			}
			approveURL, _ := elements[0]["url"].(string)
			if !strings.HasSuffix(approveURL, "/v1/queue/trace-abc/approve") {
				t.Errorf("unexpected approve URL: %s", approveURL)
			}
			denyURL, _ := elements[1]["url"].(string)
			if !strings.HasSuffix(denyURL, "/v1/queue/trace-abc/deny") {
				t.Errorf("unexpected deny URL: %s", denyURL)
			}
			found = true
		}
	}
	if !found {
		t.Error("expected an actions block with Approve / Deny buttons for human_review event")
	}
}

func TestFormatSlack_DeniedNoButtons(t *testing.T) {
	evt := incident.Event{
		Type:                "authorization.denied",
		Severity:            "high",
		Actor:               "rogue_bot",
		Action:              "delete_database",
		Reason:              "hard deny — confidence below threshold",
		TraceID:             "trace-xyz",
		Decision:            "denied",
		RequiresHumanReview: false,
		Timestamp:           "2026-02-25T20:00:00Z",
	}

	payload := incident.FormatSlack(evt, "https://lelu.example.com")
	blocks, _ := payload["blocks"].([]map[string]any)

	for _, b := range blocks {
		if b["type"] == "actions" {
			t.Error("did not expect actions block for a non-review denial")
		}
	}
}

func TestFormatSlack_InjectionEvent(t *testing.T) {
	evt := incident.Event{
		Type:      "security.injection_attempt",
		Severity:  "critical",
		Actor:     "invoice_bot",
		Action:    "ignore previous instructions",
		Decision:  "denied",
		Timestamp: "2026-02-25T20:00:00Z",
	}
	payload := incident.FormatSlack(evt, "")
	blocks, _ := payload["blocks"].([]map[string]any)
	if len(blocks) == 0 {
		t.Fatal("expected non-empty blocks")
	}
	// Header should contain the injection emoji / text.
	headerText := ""
	if h, ok := blocks[0]["text"].(map[string]any); ok {
		headerText, _ = h["text"].(string)
	}
	if !strings.Contains(headerText, "Injection") && !strings.Contains(headerText, "injection") {
		t.Errorf("expected injection mention in header, got %q", headerText)
	}
}
