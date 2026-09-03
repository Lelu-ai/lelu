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

	// PayloadFingerprint is a hash of the effect-determining fields of the
	// request that triggered this review — action, resource, args,
	// acting_for, scope. An approval is an approval of *this* payload, not
	// of the review ID: without binding the two, an agent can get one
	// payload approved and execute a different one under the same ID,
	// because nothing downstream ever re-checks what was actually approved.
	// Redeem() is what closes that gap. Empty when the enqueuing path had no
	// payload to bind (see the confidence-auditor path in
	// confidence.Escalator) — an empty fingerprint can never be redeemed,
	// rather than silently matching anything.
	PayloadFingerprint string `json:"payload_fingerprint,omitempty"`
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
func (q *Queue) Enqueue(ctx context.Context, tenantID, actor, action string, resource map[string]string, confidence float64, reason, actingFor, payloadFingerprint string) (string, error) {
	id := uuid.NewString()
	req := ReviewRequest{
		ID:                 id,
		TenantID:           tenantID,
		Actor:              actor,
		Action:             action,
		Resource:           resource,
		ConfidenceScore:    confidence,
		Reason:             reason,
		ActingFor:          actingFor,
		EnqueuedAt:         time.Now().UTC(),
		Status:             StatusPending,
		PayloadFingerprint: payloadFingerprint,
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

// ─── Redeem ───────────────────────────────────────────────────────────────────

// DefaultApprovalTTL is how long an approval stays redeemable after a human
// resolves it. An approval is a judgement about a moment — the reviewer saw
// a specific payload, in a specific context, and said yes then. Leaving that
// yes redeemable indefinitely means an agent can bank approvals and spend
// them much later against circumstances the reviewer never saw.
const DefaultApprovalTTL = 15 * time.Minute

// RedeemResult explains a redemption outcome. Reason is safe to hand back to
// the caller: it says which check failed, never what the approved payload
// was, so a mismatched fingerprint can't be used as an oracle to discover it.
type RedeemResult struct {
	Allowed bool
	Reason  string
}

// Redeem checks whether an approved review may actually be executed *with
// this specific payload, right now*. This is the step that makes a human
// approval mean something: approval binds to a payload fingerprint at
// enqueue time, and redemption re-checks it at execution time, so a payload
// mutated between the two fails closed instead of riding a valid approval.
//
// Every failure path returns Allowed=false. There is no path where an
// unreadable item, an empty fingerprint, or an unexpected status falls
// through to allowed — the whole point is that ambiguity denies.
func (q *Queue) Redeem(ctx context.Context, id, payloadFingerprint string, ttl time.Duration) (RedeemResult, error) {
	if ttl <= 0 {
		ttl = DefaultApprovalTTL
	}
	req, err := q.Get(ctx, id)
	if err != nil {
		return RedeemResult{Reason: "review not found"}, err
	}

	switch req.Status {
	case StatusApproved:
		// fall through to the payload and freshness checks below
	case StatusPending:
		return RedeemResult{Reason: "review is still pending human decision"}, nil
	default:
		return RedeemResult{Reason: fmt.Sprintf("review was %s", req.Status)}, nil
	}

	// An item enqueued without a fingerprint has nothing to bind against, so
	// it can never be redeemed — denying is the only honest answer, since
	// "approved, but we don't know what for" is not an approval of anything
	// in particular.
	if req.PayloadFingerprint == "" {
		return RedeemResult{Reason: "approval is not bound to a payload and cannot be redeemed"}, nil
	}
	if payloadFingerprint == "" {
		return RedeemResult{Reason: "no payload supplied to check against the approval"}, nil
	}
	if req.PayloadFingerprint != payloadFingerprint {
		return RedeemResult{Reason: "payload does not match what was approved"}, nil
	}

	if req.ResolvedAt == nil {
		return RedeemResult{Reason: "approval has no resolution time and cannot be aged"}, nil
	}
	if time.Since(*req.ResolvedAt) > ttl {
		return RedeemResult{Reason: fmt.Sprintf("approval expired (older than %s)", ttl)}, nil
	}

	return RedeemResult{Allowed: true, Reason: "payload matches the approved request"}, nil
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
