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
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// ─── Stream / key names ───────────────────────────────────────────────────────

const (
	StreamKey  = "lelu:review:stream"   // Redis Stream for incoming requests
	PendingKey = "lelu:review:pending:" // JSON per item: lelu:review:pending:<id>
	GroupName  = "lelu-reviewers"       // Consumer group name

	// PendingIndexKey is a sorted set of the IDs that are actually still
	// pending, scored by enqueue time. The reviewer-facing list is built from
	// this, not from the stream.
	//
	// The stream holds the payload as it was serialised at enqueue time and
	// is never rewritten when an item resolves, so reading pending items from
	// it returns every review ever created, permanently, with their original
	// status. That is not a stale cache — it is a different question being
	// answered: "what was ever submitted" rather than "what still needs a
	// human". With a fixed page size it also means a genuinely pending item
	// can be pushed out of view by newer resolved ones, which an agent whose
	// action was flagged can do on purpose.
	PendingIndexKey = "lelu:review:pending-index"

	// ResolveLockKey guards the pending → resolved transition. See resolve().
	ResolveLockKey = "lelu:review:resolve-lock:"

	// RedeemLockKey marks an approval as spent. See Redeem().
	RedeemLockKey = "lelu:review:redeemed:"

	// StreamMaxLen caps the fan-out stream. It is a notification channel for
	// consumers, not the system of record, so it does not need to grow
	// without bound — nothing ever trimmed it before, and its length was
	// what made the listing degrade over time.
	StreamMaxLen = 10000
)

// PendingMaxAge is how long an unresolved item stays listed before it is
// treated as expired. Items are not silently deleted at this point: they are
// reported with StatusExpired and removed from the reviewer list, so an item
// nobody acted on leaves a visible outcome rather than vanishing.
const PendingMaxAge = 7 * 24 * time.Hour

// ResolvedRetention is how long a resolved item remains fetchable for audit.
const ResolvedRetention = 30 * 24 * time.Hour

// ─── Domain types ─────────────────────────────────────────────────────────────

// Status describes the lifecycle of a ReviewRequest.
type Status string

const (
	StatusPending  Status = "pending"
	StatusApproved Status = "approved"
	StatusDenied   Status = "denied"
	// StatusExpired marks an item that aged past PendingMaxAge with no human
	// decision. Distinct from denied: nobody decided anything. Redeem treats
	// it as not-approved, which is the fail-closed answer.
	StatusExpired Status = "expired"
)

// ErrAlreadyResolved is returned when a resolution loses the race to another
// resolution, or arrives after one. Callers must surface it rather than
// reporting success: a reviewer who denies an action and is told it worked,
// while the stored state says approved, is the worst possible outcome of this
// endpoint.
var ErrAlreadyResolved = errors.New("queue: item is already resolved")

// ErrAlreadyRedeemed is returned when an approval has already been spent.
var ErrAlreadyRedeemed = errors.New("queue: approval has already been redeemed")

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

	// RedeemedAt records when this approval was spent. An approval is a
	// judgement about one intended effect, so it buys one execution:
	// redemption that is a pure read lets a single human "yes" to a $10
	// refund authorise unlimited $10 refunds for as long as the approval
	// stays fresh, which is not what the reviewer agreed to.
	RedeemedAt *time.Time `json:"redeemed_at,omitempty"`
}

// expiredIfStale reports the item's effective status, treating a pending item
// older than PendingMaxAge as expired. Kept as a read-time computation rather
// than a background sweep so the answer is the same whether or not a sweeper
// has run recently.
func (r *ReviewRequest) expiredIfStale() Status {
	if r.Status == StatusPending && time.Since(r.EnqueuedAt) > PendingMaxAge {
		return StatusExpired
	}
	return r.Status
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
	if !ok {
		return nil, false
	}
	// Copy: callers adjust Status for ageing and must not be able to write
	// through into the store.
	cp := *r
	return &cp, true
}

// listPending returns pending items newest-first. Ordering matters: an
// unordered map walk means the page an operator sees changes between calls
// for no reason, and "the 50 you happen to get" is not a work queue.
func (s *inMemoryStore) listPending(limit int64, offset int64) []ReviewRequest {
	s.mu.Lock()
	defer s.mu.Unlock()
	all := make([]ReviewRequest, 0, len(s.items))
	for _, r := range s.items {
		if r.expiredIfStale() == StatusPending {
			all = append(all, *r)
		}
	}
	sort.Slice(all, func(i, j int) bool { return all[i].EnqueuedAt.After(all[j].EnqueuedAt) })
	if offset >= int64(len(all)) {
		return []ReviewRequest{}
	}
	all = all[offset:]
	if int64(len(all)) > limit {
		all = all[:limit]
	}
	return all
}

func (s *inMemoryStore) countPending() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	n := 0
	for _, r := range s.items {
		if r.expiredIfStale() == StatusPending {
			n++
		}
	}
	return n
}

// resolveIfPending performs the whole check-and-set under one lock. Splitting
// it into a get, a status check and a set in the caller is what allowed two
// concurrent resolutions to both observe "pending" and both succeed.
func (s *inMemoryStore) resolveIfPending(id string, status Status, resolvedBy, note string) (*ReviewRequest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.items[id]
	if !ok {
		return nil, fmt.Errorf("queue: item %q not found", id)
	}
	if eff := r.expiredIfStale(); eff != StatusPending {
		if eff == StatusExpired {
			return nil, fmt.Errorf("queue: item %q expired without a decision", id)
		}
		return nil, fmt.Errorf("%w: %q is %s", ErrAlreadyResolved, id, r.Status)
	}
	now := time.Now().UTC()
	r.Status = status
	r.ResolvedAt = &now
	r.ResolvedBy = resolvedBy
	r.ResolutionNote = note
	return r, nil
}

// markRedeemed claims the single redemption for this approval.
func (s *inMemoryStore) markRedeemed(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.items[id]
	if !ok {
		return fmt.Errorf("queue: item %q not found", id)
	}
	if r.RedeemedAt != nil {
		return ErrAlreadyRedeemed
	}
	now := time.Now().UTC()
	r.RedeemedAt = &now
	return nil
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

	// Write the full payload first: it is the system of record, and a stream
	// entry pointing at an item that does not exist is worse than a missing
	// notification.
	//
	// No TTL. The item key previously expired after 24h while its stream
	// entry never did, so an unresolved review outlived its own payload: it
	// stayed on the reviewer list forever while GET returned 404 and resolve
	// returned 400 — permanently listed, unfetchable, unresolvable, and
	// holding a slot. Ageing is now an explicit status (StatusExpired via
	// PendingMaxAge), not a key disappearing underneath the index.
	if err := q.rdb.Set(ctx, PendingKey+id, payload, 0).Err(); err != nil {
		return "", fmt.Errorf("queue: set: %w", err)
	}

	// Index it as pending, scored by enqueue time. This — not the stream — is
	// what ListPending reads.
	if err := q.rdb.ZAdd(ctx, PendingIndexKey, redis.Z{
		Score:  float64(req.EnqueuedAt.UnixNano()),
		Member: id,
	}).Err(); err != nil {
		return "", fmt.Errorf("queue: index: %w", err)
	}

	// Notify fan-out consumers. Capped: this is a notification channel, not
	// the system of record, and an untrimmed stream was itself a defect.
	if err := q.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: StreamKey,
		MaxLen: StreamMaxLen,
		Approx: true,
		Values: map[string]any{"id": id, "payload": string(payload)},
	}).Err(); err != nil {
		return "", fmt.Errorf("queue: xadd: %w", err)
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
		req.Status = req.expiredIfStale()
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
	// Report ageing as the status, so a caller cannot read "pending" for an
	// item that no longer accepts a decision.
	req.Status = req.expiredIfStale()
	return &req, nil
}

// ListPending returns up to `limit` items that are still awaiting a human,
// newest first. See ListPendingPage for the paginated form and for why this
// reads an index rather than the stream.
func (q *Queue) ListPending(ctx context.Context, limit int64) ([]ReviewRequest, error) {
	page, err := q.ListPendingPage(ctx, limit, 0)
	return page.Items, err
}

// PendingPage is one page of the reviewer work queue, plus the total so a
// caller can tell "there are 50" from "there are 50 shown of 4,000".
type PendingPage struct {
	Items  []ReviewRequest `json:"items"`
	Total  int64           `json:"total"`
	Offset int64           `json:"offset"`
	Limit  int64           `json:"limit"`
}

// ListPendingPage returns pending items from the pending index.
//
// Reading the index rather than the stream is the substance here. The stream
// stores each item as it looked at enqueue time and is never rewritten, so a
// resolved item still reads as pending from it — forever. Combined with a
// fixed page size that meant the endpoint answered "the newest N reviews ever
// created", so an item genuinely awaiting a human could be pushed out of
// every reviewer's view by newer, already-resolved ones. An agent whose
// action was flagged could do that deliberately, at the cost of N ordinary
// authorize calls.
//
// The index is also self-healing: an indexed ID whose payload is gone is
// removed rather than returned as an unfetchable entry.
func (q *Queue) ListPendingPage(ctx context.Context, limit, offset int64) (PendingPage, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	if q.rdb == nil {
		items := q.inmem.listPending(limit, offset)
		return PendingPage{Items: items, Total: int64(q.inmem.countPending()), Offset: offset, Limit: limit}, nil
	}

	total, err := q.rdb.ZCard(ctx, PendingIndexKey).Result()
	if err != nil {
		return PendingPage{}, fmt.Errorf("queue: index size: %w", err)
	}

	ids, err := q.rdb.ZRevRange(ctx, PendingIndexKey, offset, offset+limit-1).Result()
	if err != nil {
		return PendingPage{}, fmt.Errorf("queue: index range: %w", err)
	}
	if len(ids) == 0 {
		return PendingPage{Items: []ReviewRequest{}, Total: total, Offset: offset, Limit: limit}, nil
	}

	keys := make([]string, len(ids))
	for i, id := range ids {
		keys[i] = PendingKey + id
	}
	raws, err := q.rdb.MGet(ctx, keys...).Result()
	if err != nil {
		return PendingPage{}, fmt.Errorf("queue: mget: %w", err)
	}

	out := make([]ReviewRequest, 0, len(raws))
	var stale []string
	for i, raw := range raws {
		str, ok := raw.(string)
		if !ok {
			// Indexed but the payload is gone. Drop the index entry instead
			// of reporting an item nobody can fetch or resolve.
			stale = append(stale, ids[i])
			continue
		}
		var req ReviewRequest
		if err := json.Unmarshal([]byte(str), &req); err != nil {
			stale = append(stale, ids[i])
			continue
		}
		switch req.expiredIfStale() {
		case StatusPending:
			out = append(out, req)
		case StatusExpired:
			// Aged out with no decision: stop showing it, but the item
			// itself stays fetchable so the outcome is auditable.
			stale = append(stale, ids[i])
		default:
			// Resolved but still indexed (a resolve that failed partway).
			stale = append(stale, ids[i])
		}
	}
	if len(stale) > 0 {
		members := make([]any, len(stale))
		for i, id := range stale {
			members[i] = id
		}
		// Best effort: a failure here costs one stale listing entry, not
		// correctness of the items actually returned.
		_ = q.rdb.ZRem(ctx, PendingIndexKey, members...).Err()
		total -= int64(len(stale))
		if total < 0 {
			total = 0
		}
	}
	return PendingPage{Items: out, Total: total, Offset: offset, Limit: limit}, nil
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

// resolve performs the pending → resolved transition exactly once.
//
// The previous implementation was a plain read-modify-write: Get, check
// status, Set. Two concurrent resolutions both read "pending", both wrote,
// and both returned success — so eight concurrent approvals could all
// succeed, and, worse, a deny racing an approve could return success to the
// human who denied while the stored state ended up approved. Last write wins
// is not an acceptable resolution rule for the one control that is supposed
// to put a human in charge.
//
// Redis has no compare-and-swap over a JSON value, so the transition is
// serialised on a lock key claimed with SET NX. The winner is the single
// resolver; everyone else gets ErrAlreadyResolved. The lock is released only
// if the update fails, so a successful resolution is permanent — it is a
// resolution marker, not a mutex with a timeout.
func (q *Queue) resolve(ctx context.Context, id string, status Status, resolvedBy, note string) error {
	if q.rdb == nil {
		_, err := q.inmem.resolveIfPending(id, status, resolvedBy, note)
		return err
	}

	// Confirm the item exists and is pending before claiming the lock, so a
	// request for an unknown ID reports "not found" rather than leaving a
	// lock behind for an item that never existed.
	req, err := q.Get(ctx, id)
	if err != nil {
		return err
	}
	switch req.expiredIfStale() {
	case StatusPending:
	case StatusExpired:
		return fmt.Errorf("queue: item %q expired without a decision", id)
	default:
		return fmt.Errorf("%w: %q is %s", ErrAlreadyResolved, id, req.Status)
	}

	won, err := q.rdb.SetNX(ctx, ResolveLockKey+id, string(status), ResolvedRetention).Result()
	if err != nil {
		return fmt.Errorf("queue: resolve lock: %w", err)
	}
	if !won {
		return fmt.Errorf("%w: %q", ErrAlreadyResolved, id)
	}

	now := time.Now().UTC()
	req.Status = status
	req.ResolvedAt = &now
	req.ResolvedBy = resolvedBy
	req.ResolutionNote = note

	payload, err := json.Marshal(req)
	if err != nil {
		_ = q.rdb.Del(ctx, ResolveLockKey+id).Err()
		return fmt.Errorf("queue: marshal: %w", err)
	}
	if err := q.rdb.Set(ctx, PendingKey+id, payload, ResolvedRetention).Err(); err != nil {
		// Release the claim: nothing was stored, so this resolution did not
		// happen and a retry must be allowed to.
		_ = q.rdb.Del(ctx, ResolveLockKey+id).Err()
		return fmt.Errorf("queue: update: %w", err)
	}

	// Off the reviewer list. Best effort — ListPendingPage removes resolved
	// entries it encounters anyway, so a failure here is cosmetic.
	_ = q.rdb.ZRem(ctx, PendingIndexKey, id).Err()
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

	switch req.expiredIfStale() {
	case StatusApproved:
		// fall through to the payload and freshness checks below
	case StatusPending:
		return RedeemResult{Reason: "review is still pending human decision"}, nil
	case StatusExpired:
		return RedeemResult{Reason: "review expired without a human decision"}, nil
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

	// Every other check has passed, so this redemption is the one that spends
	// the approval. Claiming it last means a redemption refused for a
	// mismatched payload does not burn the approval the reviewer granted.
	//
	// Redemption used to be a pure read, which made an approval a standing
	// permission for the length of its TTL: one human "yes" to a $10 refund
	// authorised unlimited $10 refunds for the next fifteen minutes. The
	// package's own framing — an approval is a judgement about a moment —
	// only holds if spending it consumes it.
	if err := q.claimRedemption(ctx, id); err != nil {
		if errors.Is(err, ErrAlreadyRedeemed) {
			return RedeemResult{Reason: "approval has already been redeemed"}, nil
		}
		return RedeemResult{Reason: "could not record redemption"}, err
	}

	return RedeemResult{Allowed: true, Reason: "payload matches the approved request"}, nil
}

// claimRedemption marks the approval spent, exactly once.
func (q *Queue) claimRedemption(ctx context.Context, id string) error {
	if q.rdb == nil {
		return q.inmem.markRedeemed(id)
	}
	won, err := q.rdb.SetNX(ctx, RedeemLockKey+id, time.Now().UTC().Format(time.RFC3339Nano), ResolvedRetention).Result()
	if err != nil {
		return fmt.Errorf("queue: redeem lock: %w", err)
	}
	if !won {
		return ErrAlreadyRedeemed
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
