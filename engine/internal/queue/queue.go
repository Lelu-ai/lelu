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
	"sync"
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

// inMemoryStore is a thread-safe map-backed store used when Redis is not
// available. It preserves full ReviewRequest lifecycle (pending → approved/denied).
type inMemoryStore struct {
	mu    sync.Mutex
	items map[string]*ReviewRequest
}

func newInMemoryStore() *inMemoryStore {
	return &inMemoryStore{items: make(map[string]*ReviewRequest)}
}

func (s *inMemoryStore) set(req *ReviewRequest) {
	s.mu.Lock()
	s.items[req.ID] = req
	s.mu.Unlock()
}

func (s *inMemoryStore) get(id string) (*ReviewRequest, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.items[id]
	return r, ok
}

func (s *inMemoryStore) listPending(limit int64) []ReviewRequest {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]ReviewRequest, 0)
	for _, r := range s.items {
		if r.Status == StatusPending {
			out = append(out, *r)
			if int64(len(out)) >= limit {
				break
			}
		}
	}
	return out
}

// Queue manages the human-review lifecycle via Redis Streams + Hashes.
// When rdb is nil it falls back to an in-memory store so no items are lost.
type Queue struct {
	rdb   *redis.Client
	inmem *inMemoryStore
}

// New creates a Queue backed by Redis and ensures the consumer group exists.
func New(rdb *redis.Client) (*Queue, error) {
	q := &Queue{rdb: rdb, inmem: newInMemoryStore()}
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

// NewInMemory returns a Queue backed by an in-memory store (no Redis required).
// All operations work correctly; data is lost on restart.
func NewInMemory() *Queue {
	return &Queue{inmem: newInMemoryStore()}
}

// ─── Enqueue ──────────────────────────────────────────────────────────────────

// Enqueue adds a new ReviewRequest to the stream and writes the full payload.
// Returns the assigned review ID. Falls back to the in-memory store when Redis
// is not configured so no review requests are silently dropped.
func (q *Queue) Enqueue(ctx context.Context, tenantID, actor, action string, resource map[string]string, confidence float64, reason, actingFor string) (string, error) {
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

	if q.rdb == nil {
		q.inmem.set(&req)
		return id, nil
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

	// Write full payload for fast O(1) GET by ID.
	if err := q.rdb.Set(ctx, PendingKey+id, payload, 24*time.Hour).Err(); err != nil {
		return "", fmt.Errorf("queue: set: %w", err)
	}

	return id, nil
}

// ─── Read ─────────────────────────────────────────────────────────────────────

// Get returns a single ReviewRequest by ID.
func (q *Queue) Get(ctx context.Context, id string) (*ReviewRequest, error) {
	if q.rdb == nil {
		req, ok := q.inmem.get(id)
		if !ok {
			return nil, fmt.Errorf("queue: item %q not found", id)
		}
		return req, nil
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
func (q *Queue) ListPending(ctx context.Context, limit int64) ([]ReviewRequest, error) {
	if q.rdb == nil {
		return q.inmem.listPending(limit), nil
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

	if q.rdb == nil {
		q.inmem.set(req)
		return nil
	}

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
