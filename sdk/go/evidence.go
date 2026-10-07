package lelu

import (
	"errors"
	"strings"
	"time"
)

const ExternalEvidenceArg = "external_evidence"

// VerifiedEvidenceSignal is a provider-neutral authorization input produced by
// a trusted adapter after it verifies an external evidence record. Lelu does
// not fetch or verify the provider response itself.
type VerifiedEvidenceSignal struct {
	Provider         string `json:"provider"`
	ObservedAt       string `json:"observed_at"`
	DeclarationState string `json:"declaration_state"`
	EvidenceRef      string `json:"evidence_ref"`
	ReceiptDigest    string `json:"receipt_digest"`
}

// Validate checks the transport-neutral fields needed for a useful policy and
// audit reference. DeclarationState remains open-ended so Lelu does not impose
// one provider's vocabulary.
func (s VerifiedEvidenceSignal) Validate() error {
	if strings.TrimSpace(s.Provider) == "" {
		return errors.New("evidence provider is required")
	}
	if strings.TrimSpace(s.ObservedAt) == "" {
		return errors.New("evidence observed_at is required")
	}
	if _, err := time.Parse(time.RFC3339, s.ObservedAt); err != nil {
		return errors.New("evidence observed_at must be RFC3339")
	}
	if strings.TrimSpace(s.DeclarationState) == "" {
		return errors.New("evidence declaration_state is required")
	}
	if strings.TrimSpace(s.EvidenceRef) == "" {
		return errors.New("evidence evidence_ref is required")
	}
	if strings.TrimSpace(s.ReceiptDigest) == "" {
		return errors.New("evidence receipt_digest is required")
	}
	return nil
}

// WithVerifiedEvidence returns a copy of args with one provider-neutral
// external_evidence object. It never mutates the caller's map.
func WithVerifiedEvidence(args map[string]interface{}, signal VerifiedEvidenceSignal) (map[string]interface{}, error) {
	if err := signal.Validate(); err != nil {
		return nil, err
	}
	out := make(map[string]interface{}, len(args)+1)
	for k, v := range args {
		out[k] = v
	}
	out[ExternalEvidenceArg] = signal
	return out, nil
}
