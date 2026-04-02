// Package queue implements the human-approval queue backed by a Redis Stream.
//
// When the Confidence Gate downgrades a request to "requires_human_review", the
// evaluator enqueues a ReviewRequest here.  A human operator (or a webhook
// consumer) calls Approve / Deny to resolve it.
package queue

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// ─── Stream / key names ───────────────────────────────────────────────────────

const (
	StreamKey  = "lelu:review:stream"   // Redis Stream for incoming requests
	PendingKey = "lelu:review:pending:" // HASH per item: lelu:review:pending:<id>
	GroupName  = "lelu-reviewers"       // Consumer group name
)

// ─── Domain types ─────────────────────────────────────────────────────────────

// Status describes the lifecycle of a ReviewRequest.
type Status string

const (
	StatusPending  Status = "pending"
	StatusApproved Status = "approved"
	StatusDenied   Status = "denied"
)

// ReviewRequest is an item enqueued for human approval.
type ReviewRequest struct {
	ID              string            `json:"id"`
	TenantID        string            `json:"tenant_id,omitempty"`
	Actor           string            `json:"actor"`
	Action          string            `json:"action"`
	Resource        map[string]string `json:"resource,omitempty"`
	ConfidenceScore float64           `json:"confidence_score"`
	Reason          string            `json:"reason"`
	ActingFor       string            `json:"acting_for,omitempty"`
	EnqueuedAt      time.Time         `json:"enqueued_at"`
	Status          Status            `json:"status"`
	ResolvedAt      *time.Time        `json:"resolved_at,omitempty"`
	ResolvedBy      string            `json:"resolved_by,omitempty"`
	ResolutionNote  string            `json:"resolution_note,omitempty"`
}

// ─── Queue ────────────────────────────────────────────────────────────────────

// Queue manages the human-review lifecycle via Redis Streams + Hashes.
type Queue struct {
	rdb *redis.Client
}

// New creates a Queue and ensures the consumer group exists.
func New(rdb *redis.Client) (*Queue, error) {
	q := &Queue{rdb: rdb}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	// Create group; ignore BUSYGROUP error (already exists).
	if err := rdb.XGroupCreateMkStream(ctx, StreamKey, GroupName, "0").Err(); err != nil {
		if err.Error() != "BUSYGROUP Consumer Group name already exists" {
			return nil, fmt.Errorf("queue: create group: %w", err)
		}
	}
	return q, nil
}

// NewInMemory returns a Queue without Redis (no-op approvals) for testing.
func NewInMemory() *Queue {
	return &Queue{}
}

// ─── Enqueue ──────────────────────────────────────────────────────────────────

// Enqueue adds a new ReviewRequest to the stream and writes the full payload.
// Returns the assigned review ID.
func (q *Queue) Enqueue(ctx context.Context, tenantID, actor, action string, resource map[string]string, confidence float64, reason, actingFor string) (string, error) {
	if q.rdb == nil {
		return "", nil // no-op without Redis
	}

	id := uuid.NewString()
	req := ReviewRequest{
		ID:              id,
		TenantID:        tenantID,
		Actor:           actor,
		Action:          action,
		Resource:        resource,
		ConfidenceScore: confidence,
		Reason:          reason,
		ActingFor:       actingFor,
		EnqueuedAt:      time.Now().UTC(),
		Status:          StatusPending,
	}

	payload, err := json.Marshal(req)
	if err != nil {
		return "", fmt.Errorf("queue: marshal: %w", err)
	}

	// Write to stream for fan-out consumers.
	if err := q.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: StreamKey,
		Values: map[string]any{"id": id, "payload": string(payload)},
	}).Err(); err != nil {
		return "", fmt.Errorf("queue: xadd: %w", err)
	}

	// Write full payload to a hash for fast O(1) GET by ID.
	if err := q.rdb.Set(ctx, PendingKey+id, payload, 24*time.Hour).Err(); err != nil {
		return "", fmt.Errorf("queue: set: %w", err)
	}

	return id, nil
}

// ─── Read ─────────────────────────────────────────────────────────────────────

// Get returns a single ReviewRequest by ID.
func (q *Queue) Get(ctx context.Context, id string) (*ReviewRequest, error) {
	if q.rdb == nil {
		return nil, errors.New("queue: no Redis configured")
	}
	raw, err := q.rdb.Get(ctx, PendingKey+id).Result()
	if errors.Is(err, redis.Nil) {
		return nil, fmt.Errorf("queue: item %q not found", id)
	}
	if err != nil {
		return nil, fmt.Errorf("queue: get: %w", err)
	}
	var req ReviewRequest
	if err := json.Unmarshal([]byte(raw), &req); err != nil {
		return nil, fmt.Errorf("queue: unmarshal: %w", err)
	}
	return &req, nil
}

// ListPending returns up to `limit` items that are still in StatusPending.
// It reads recent stream entries and filters by status.
func (q *Queue) ListPending(ctx context.Context, limit int64) ([]ReviewRequest, error) {
	if q.rdb == nil {
		return nil, nil
	}
	msgs, err := q.rdb.XRevRangeN(ctx, StreamKey, "+", "-", limit).Result()
	if err != nil {
		return nil, fmt.Errorf("queue: xrevrange: %w", err)
	}

	out := make([]ReviewRequest, 0, len(msgs))
	for _, msg := range msgs {
		payload, ok := msg.Values["payload"].(string)
		if !ok {
			continue
		}
		var req ReviewRequest
		if err := json.Unmarshal([]byte(payload), &req); err != nil {
			continue
		}
		if req.Status == StatusPending {
			out = append(out, req)
		}
	}
	return out, nil
}

// ─── Resolve ──────────────────────────────────────────────────────────────────

// Approve marks the item as approved.
func (q *Queue) Approve(ctx context.Context, id, resolvedBy, note string) error {
	return q.resolve(ctx, id, StatusApproved, resolvedBy, note)
}

// Deny marks the item as denied.
func (q *Queue) Deny(ctx context.Context, id, resolvedBy, note string) error {
	return q.resolve(ctx, id, StatusDenied, resolvedBy, note)
}

func (q *Queue) resolve(ctx context.Context, id string, status Status, resolvedBy, note string) error {
	if q.rdb == nil {
		return nil
	}
	req, err := q.Get(ctx, id)
	if err != nil {
		return err
	}
	if req.Status != StatusPending {
		return fmt.Errorf("queue: item %q is already %s", id, req.Status)
	}

	now := time.Now().UTC()
	req.Status = status
	req.ResolvedAt = &now
	req.ResolvedBy = resolvedBy
	req.ResolutionNote = note

	payload, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("queue: marshal: %w", err)
	}
	// Keep resolved items for 7 days for audit purposes.
	if err := q.rdb.Set(ctx, PendingKey+id, payload, 7*24*time.Hour).Err(); err != nil {
		return fmt.Errorf("queue: update: %w", err)
	}
	return nil
}

// HealthCheck validates Redis connectivity for the review queue.
func (q *Queue) HealthCheck(ctx context.Context) error {
	if q.rdb == nil {
		return nil
	}
	if err := q.rdb.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("queue: redis ping: %w", err)
	}
	if err := q.rdb.Set(ctx, PendingKey+"health", "ok", 5*time.Second).Err(); err != nil {
		return fmt.Errorf("queue: redis write: %w", err)
	}
	if err := q.rdb.Del(ctx, PendingKey+"health").Err(); err != nil {
		return fmt.Errorf("queue: redis cleanup: %w", err)
	}
	return nil
}
