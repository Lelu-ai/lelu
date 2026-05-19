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
type Escalator struct {
	reviewQueue ReviewEnqueuer
}

// NewEscalator returns a new Escalator. Pass nil for reviewQueue to disable
// actual enqueueing (useful in tests).
func NewEscalator(reviewQueue ReviewEnqueuer) *Escalator {
	return &Escalator{reviewQueue: reviewQueue}
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
func (e *Escalator) Escalate(result *AuditResult, severity SeverityLevel) EscalationAction {
	if result == nil {
		return ActionAllow
	}
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
