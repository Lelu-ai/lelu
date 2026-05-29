package confidence

import (
	"context"
	"fmt"
	"time"
)

// ReviewEnqueuer is the narrow interface Escalator needs to submit items for
// human review. *queue.Queue satisfies this interface.
type ReviewEnqueuer interface {
	Enqueue(ctx context.Context, tenantID, actor, action string,
		resource map[string]string, confidence float64,
		reason, actingFor string) (string, error)
}

// Escalator routes audit findings to the human-review queue based on severity.
// Uses an isotonic regression Calibrator to map raw external scores to true
// threat probabilities, and a feedback loop to tune the decision threshold.
type Escalator struct {
	reviewQueue ReviewEnqueuer
	calibrator  *Calibrator
}

// NewEscalator returns a new Escalator. Pass nil for reviewQueue to disable
// actual enqueueing (useful in tests).
func NewEscalator(reviewQueue ReviewEnqueuer) *Escalator {
	return &Escalator{
		reviewQueue: reviewQueue,
		calibrator:  NewCalibrator(500),
	}
}

// RecordOutcome feeds a human review decision back into the calibrator.
// Call this whenever a reviewer approves or denies a flagged request.
//
//	rawScore  — the ExternalScore from the original AuditResult
//	wasThreat — true if the reviewer confirmed it was a real threat
func (e *Escalator) RecordOutcome(rawScore float64, wasThreat bool) {
	e.calibrator.Record(rawScore, wasThreat)
}

// EscalationAction describes what action should be taken.
type EscalationAction string

const (
	ActionAllow     EscalationAction = "allow"
	ActionDeny      EscalationAction = "deny"
	ActionReview    EscalationAction = "human_review"
	ActionDowngrade EscalationAction = "downgrade_scope"
)

// Escalate decides whether to escalate to human review based on severity.
// When calibration data is available, uses calibrated threat probability and
// a dynamic threshold instead of fixed 3-tier thresholds.
func (e *Escalator) Escalate(result *AuditResult, severity SeverityLevel) EscalationAction {
	if result == nil {
		return ActionAllow
	}

	// Use calibrated probability + dynamic threshold when fitted.
	if e.calibrator.IsFitted() {
		calibrated := e.calibrator.Calibrate(result.ExternalScore)
		threshold := e.calibrator.Threshold()

		// Calibrated threat probability above dynamic threshold → review.
		if calibrated >= threshold {
			return ActionReview
		}
		// Very high calibrated probability → deny immediately.
		if calibrated >= threshold+0.3 {
			return ActionDeny
		}
		return ActionAllow
	}

	// Fallback: original fixed 3-tier logic until calibrated.
	switch severity {
	case SeverityHigh:
		return ActionReview
	case SeverityMedium:
		if result.ExternalScore < 0.5 {
			return ActionDeny
		}
		return ActionReview
	case SeverityLow:
		return ActionAllow
	default:
		return ActionAllow
	}
}

// EnqueueReview submits a confidence-audit finding to the human-review queue
// when the action warrants it. It is a no-op when no queue is configured or
// when the action is not ActionReview.
func (e *Escalator) EnqueueReview(ctx context.Context, auditReq *AuditRequest, result *AuditResult, severity SeverityLevel) (string, error) {
	if e.reviewQueue == nil {
		return "", nil
	}
	action := e.Escalate(result, severity)
	if action != ActionReview {
		return "", nil
	}

	reason := fmt.Sprintf("confidence drift %.3f (actor=%.2f external=%.2f): %s",
		result.Drift, result.ActorScore, result.ExternalScore, result.Reason)

	return e.reviewQueue.Enqueue(
		ctx,
		auditReq.TenantID,
		auditReq.ActingForUserID, // actor
		auditReq.Action,
		map[string]string{"prompt_hash": hashString(auditReq.Prompt)},
		auditReq.ActorConfidence,
		reason,
		auditReq.ActingForUserID,
	)
}

// CreateReviewTask formats an escalation task for external inspection or logging.
func (e *Escalator) CreateReviewTask(result *AuditResult, severity SeverityLevel, auditReq *AuditRequest) map[string]interface{} {
	return map[string]interface{}{
		"type":           "confidence_audit",
		"severity":       severity,
		"actor_score":    result.ActorScore,
		"external_score": result.ExternalScore,
		"drift":          result.Drift,
		"reason":         result.Reason,
		"prompt":         auditReq.Prompt,
		"action":         auditReq.Action,
		"actor_id":       auditReq.ActingForUserID,
		"tenant_id":      auditReq.TenantID,
		"status":         "pending",
		"created_at":     time.Now().UnixMilli(),
	}
}

// hashString returns a short non-cryptographic fingerprint of s so that the
// raw prompt is never stored in the review queue payload.
func hashString(s string) string {
	h := uint32(2166136261)
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 16777619
	}
	return fmt.Sprintf("%08x", h)
}
