package incident_test

import (
	"testing"

	"github.com/lelu-auth/lelu/engine/internal/incident"
)

func TestFormatTeams_ReviewEvent_HasActions(t *testing.T) {
	evt := incident.Event{
		Type:                "authorization.review_required",
		Severity:            "medium",
		Actor:               "invoice_bot",
		Action:              "approve_refunds",
		ConfidenceUsed:      0.78,
		ActingFor:           "user_123",
		Reason:              "confidence below threshold",
		TraceID:             "trace-abc",
		Decision:            "human_review",
		RequiresHumanReview: true,
		Timestamp:           "2026-02-25T20:00:00Z",
	}
	engineURL := "https://lelu.example.com"
	payload := incident.FormatTeams(evt, engineURL)

	attachments, ok := payload["attachments"].([]map[string]any)
	if !ok || len(attachments) == 0 {
		t.Fatal("expected non-empty attachments")
	}
	card, ok := attachments[0]["content"].(map[string]any)
	if !ok {
		t.Fatal("expected adaptive card content")
	}
	actions, ok := card["actions"].([]map[string]any)
	if !ok || len(actions) != 2 {
		t.Fatalf("expected 2 actions, got %d", len(actions))
	}
	if actions[0]["title"] != "Approve" {
		t.Errorf("expected first action title=Approve, got %v", actions[0]["title"])
	}
	if actions[1]["title"] != "Deny" {
		t.Errorf("expected second action title=Deny, got %v", actions[1]["title"])
	}
}

func TestFormatTeams_DeniedNoActions(t *testing.T) {
	evt := incident.Event{
		Type:                "authorization.denied",
		Severity:            "high",
		Actor:               "rogue_bot",
		Action:              "delete_database",
		Decision:            "denied",
		RequiresHumanReview: false,
		Timestamp:           "2026-02-25T20:00:00Z",
	}
	payload := incident.FormatTeams(evt, "https://lelu.example.com")
	attachments := payload["attachments"].([]map[string]any)
	card := attachments[0]["content"].(map[string]any)
	if _, hasActions := card["actions"]; hasActions {
		t.Error("did not expect actions for a non-review denial")
	}
}
