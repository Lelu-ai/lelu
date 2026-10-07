package lelu

import "testing"

func sampleEvidence() VerifiedEvidenceSignal {
	return VerifiedEvidenceSignal{
		Provider:         "example-provider",
		ObservedAt:       "2026-10-07T08:00:00Z",
		DeclarationState: "license_required",
		EvidenceRef:      "urn:evidence:sha256:example",
		ReceiptDigest:    "sha256:example",
	}
}

func TestWithVerifiedEvidence(t *testing.T) {
	original := map[string]interface{}{"url": "https://example.com/article"}
	args, err := WithVerifiedEvidence(original, sampleEvidence())
	if err != nil {
		t.Fatalf("WithVerifiedEvidence: %v", err)
	}
	if _, mutated := original[ExternalEvidenceArg]; mutated {
		t.Fatal("input args must not be mutated")
	}
	got, ok := args[ExternalEvidenceArg].(VerifiedEvidenceSignal)
	if !ok {
		t.Fatalf("unexpected evidence type: %T", args[ExternalEvidenceArg])
	}
	if got.DeclarationState != "license_required" {
		t.Fatalf("unexpected declaration state: %q", got.DeclarationState)
	}
}

func TestVerifiedEvidenceSignalValidation(t *testing.T) {
	tests := []struct {
		name string
		edit func(*VerifiedEvidenceSignal)
	}{
		{"provider", func(s *VerifiedEvidenceSignal) { s.Provider = "" }},
		{"observed_at", func(s *VerifiedEvidenceSignal) { s.ObservedAt = "" }},
		{"observed_at_format", func(s *VerifiedEvidenceSignal) { s.ObservedAt = "yesterday" }},
		{"declaration_state", func(s *VerifiedEvidenceSignal) { s.DeclarationState = "" }},
		{"evidence_ref", func(s *VerifiedEvidenceSignal) { s.EvidenceRef = "" }},
		{"receipt_digest", func(s *VerifiedEvidenceSignal) { s.ReceiptDigest = "" }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := sampleEvidence()
			tc.edit(&s)
			if err := s.Validate(); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}
