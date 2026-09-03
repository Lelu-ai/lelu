package queue_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-ai/lelu/engine/internal/queue"
)

// Tests use NewInMemory (no Redis required) to validate business logic.

func TestEnqueue_NoRedis(t *testing.T) {
	q := queue.NewInMemory()
	id, err := q.Enqueue(context.Background(), "default", "invoice_bot", "approve_refund", nil, 0.75, "low confidence", "user_1", "")
	require.NoError(t, err)
	assert.NotEmpty(t, id, "in-memory queue must return a real ID")
}

func TestListPending_NoRedis(t *testing.T) {
	q := queue.NewInMemory()
	_, err := q.Enqueue(context.Background(), "default", "bot", "action", nil, 0.5, "reason", "user", "")
	require.NoError(t, err)

	items, err := q.ListPending(context.Background(), 10)
	require.NoError(t, err)
	assert.Len(t, items, 1)
	assert.Equal(t, queue.StatusPending, items[0].Status)
}

func TestApprove_NoRedis(t *testing.T) {
	q := queue.NewInMemory()
	id, err := q.Enqueue(context.Background(), "default", "bot", "action", nil, 0.5, "reason", "user", "")
	require.NoError(t, err)

	err = q.Approve(context.Background(), id, "admin", "looks good")
	require.NoError(t, err)

	item, err := q.Get(context.Background(), id)
	require.NoError(t, err)
	assert.Equal(t, queue.StatusApproved, item.Status)
	assert.Equal(t, "admin", item.ResolvedBy)
}

func TestDeny_NoRedis(t *testing.T) {
	q := queue.NewInMemory()
	id, err := q.Enqueue(context.Background(), "default", "bot", "action", nil, 0.5, "reason", "user", "")
	require.NoError(t, err)

	err = q.Deny(context.Background(), id, "admin", "too risky")
	require.NoError(t, err)

	item, err := q.Get(context.Background(), id)
	require.NoError(t, err)
	assert.Equal(t, queue.StatusDenied, item.Status)
}

func TestApprove_NotFound(t *testing.T) {
	q := queue.NewInMemory()
	err := q.Approve(context.Background(), "nonexistent-id", "admin", "")
	assert.Error(t, err, "approving a non-existent item must return an error")
}

func TestDoubleResolve_NoRedis(t *testing.T) {
	q := queue.NewInMemory()
	id, _ := q.Enqueue(context.Background(), "t1", "bot", "act", nil, 0.5, "r", "u", "")
	require.NoError(t, q.Approve(context.Background(), id, "admin", ""))
	err := q.Deny(context.Background(), id, "admin", "")
	assert.Error(t, err, "resolving an already-resolved item must return an error")
}

func TestConstants(t *testing.T) {
	assert.Equal(t, "pending", string(queue.StatusPending))
	assert.Equal(t, "approved", string(queue.StatusApproved))
	assert.Equal(t, "denied", string(queue.StatusDenied))
}

// ─── Redeem ───────────────────────────────────────────────────────────────────
//
// An approval binds to a payload fingerprint at enqueue time and is
// re-checked at execution time. These cover what that binding is actually
// for: every way a redemption can fail must deny, since the whole guarantee
// rests on ambiguity never resolving to allowed.

func TestRedeem_ApprovedAndMatchingPayload(t *testing.T) {
	q := queue.NewInMemory()
	ctx := context.Background()
	id, err := q.Enqueue(ctx, "t1", "invoice_bot", "issue_refund", nil, 0.5, "r", "u", "fingerprint-abc")
	require.NoError(t, err)
	require.NoError(t, q.Approve(ctx, id, "human_reviewer", "checked"))

	res, err := q.Redeem(ctx, id, "fingerprint-abc", 0)
	require.NoError(t, err)
	assert.True(t, res.Allowed, "an approved review redeemed with the payload it approved must be allowed: %s", res.Reason)
}

func TestRedeem_RejectsMutatedPayload(t *testing.T) {
	// The case the whole mechanism exists for: approval granted for one
	// payload, execution attempted with another.
	q := queue.NewInMemory()
	ctx := context.Background()
	id, err := q.Enqueue(ctx, "t1", "invoice_bot", "issue_refund", nil, 0.5, "r", "u", "fingerprint-for-100-dollars")
	require.NoError(t, err)
	require.NoError(t, q.Approve(ctx, id, "human_reviewer", "approved a $100 refund"))

	res, err := q.Redeem(ctx, id, "fingerprint-for-100000-dollars", 0)
	require.NoError(t, err)
	assert.False(t, res.Allowed, "a payload that differs from the approved one must not ride the approval")
	assert.Contains(t, res.Reason, "does not match")
}

func TestRedeem_RejectsPendingAndDenied(t *testing.T) {
	ctx := context.Background()

	t.Run("pending", func(t *testing.T) {
		q := queue.NewInMemory()
		id, err := q.Enqueue(ctx, "t1", "bot", "act", nil, 0.5, "r", "u", "fp")
		require.NoError(t, err)

		res, err := q.Redeem(ctx, id, "fp", 0)
		require.NoError(t, err)
		assert.False(t, res.Allowed, "an unresolved review must not be redeemable")
	})

	t.Run("denied", func(t *testing.T) {
		q := queue.NewInMemory()
		id, err := q.Enqueue(ctx, "t1", "bot", "act", nil, 0.5, "r", "u", "fp")
		require.NoError(t, err)
		require.NoError(t, q.Deny(ctx, id, "human_reviewer", "no"))

		res, err := q.Redeem(ctx, id, "fp", 0)
		require.NoError(t, err)
		assert.False(t, res.Allowed, "a denied review must not be redeemable")
	})
}

func TestRedeem_RejectsExpiredApproval(t *testing.T) {
	q := queue.NewInMemory()
	ctx := context.Background()
	id, err := q.Enqueue(ctx, "t1", "bot", "act", nil, 0.5, "r", "u", "fp")
	require.NoError(t, err)
	require.NoError(t, q.Approve(ctx, id, "human_reviewer", "ok"))

	// A 1ns TTL means the approval resolved above is already stale, without
	// the test having to sleep for a real window.
	res, err := q.Redeem(ctx, id, "fp", time.Nanosecond)
	require.NoError(t, err)
	assert.False(t, res.Allowed, "an approval older than the TTL must not be redeemable")
	assert.Contains(t, res.Reason, "expired")
}

func TestRedeem_RejectsUnboundApproval(t *testing.T) {
	// An item enqueued with no fingerprint (the async confidence-auditor
	// path) is approved-but-not-bound-to-anything. It must not become a
	// blank cheque that any payload can redeem.
	q := queue.NewInMemory()
	ctx := context.Background()
	id, err := q.Enqueue(ctx, "t1", "bot", "act", nil, 0.5, "r", "u", "")
	require.NoError(t, err)
	require.NoError(t, q.Approve(ctx, id, "human_reviewer", "ok"))

	res, err := q.Redeem(ctx, id, "any-payload-at-all", 0)
	require.NoError(t, err)
	assert.False(t, res.Allowed, "an approval with no bound payload must not be redeemable by anything")
}

func TestRedeem_RejectsEmptyPresentedPayload(t *testing.T) {
	q := queue.NewInMemory()
	ctx := context.Background()
	id, err := q.Enqueue(ctx, "t1", "bot", "act", nil, 0.5, "r", "u", "fp")
	require.NoError(t, err)
	require.NoError(t, q.Approve(ctx, id, "human_reviewer", "ok"))

	res, err := q.Redeem(ctx, id, "", 0)
	require.NoError(t, err)
	assert.False(t, res.Allowed, "redeeming without presenting a payload must not be allowed")
}
