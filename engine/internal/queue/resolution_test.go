package queue_test

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-ai/lelu/engine/internal/queue"
)

// Regressions for the human-review findings in Nate Howard's dynamic review
// (B2, B4). These exercise the in-memory store, which shares the resolution
// and redemption semantics with the Redis path.

// TestResolve_IsAtomic covers B2: concurrent resolutions must not all
// succeed. The old implementation was a read-modify-write with no lock, so
// eight concurrent approvals could all observe "pending" and all report
// success.
func TestResolve_IsAtomic(t *testing.T) {
	ctx := context.Background()
	for trial := 0; trial < 20; trial++ {
		q := queue.NewInMemory()
		id, err := q.Enqueue(ctx, "t1", "invoice_bot", "approve_refunds", nil, 0.4, "low confidence", "", "fp")
		require.NoError(t, err)

		const racers = 8
		var (
			wg        sync.WaitGroup
			mu        sync.Mutex
			successes int
		)
		start := make(chan struct{})
		for i := 0; i < racers; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				<-start
				if err := q.Approve(ctx, id, "reviewer", ""); err == nil {
					mu.Lock()
					successes++
					mu.Unlock()
				}
			}()
		}
		close(start)
		wg.Wait()

		require.Equal(t, 1, successes, "trial %d: exactly one resolution may succeed", trial)
	}
}

// TestResolve_DenyLosingToApproveIsReported is the damaging variant of B2: a
// human denies, an agent spams approvals, and both used to return success
// while the stored state was last-write-wins. Whichever one loses must be
// told it lost.
func TestResolve_DenyLosingToApproveIsReported(t *testing.T) {
	ctx := context.Background()
	q := queue.NewInMemory()
	id, err := q.Enqueue(ctx, "t1", "invoice_bot", "approve_refunds", nil, 0.4, "reason", "", "fp")
	require.NoError(t, err)

	require.NoError(t, q.Deny(ctx, id, "human", "too risky"))

	err = q.Approve(ctx, id, "attacker", "")
	require.Error(t, err, "a resolution after a decision must fail, not silently overwrite it")
	assert.ErrorIs(t, err, queue.ErrAlreadyResolved)

	item, err := q.Get(ctx, id)
	require.NoError(t, err)
	assert.Equal(t, queue.StatusDenied, item.Status, "the human's denial must stand")
	assert.Equal(t, "human", item.ResolvedBy)
}

// TestRedeem_IsSingleUse covers B4: redemption was a pure read, so one
// approval authorised unlimited executions of the approved payload for the
// whole TTL.
func TestRedeem_IsSingleUse(t *testing.T) {
	ctx := context.Background()
	q := queue.NewInMemory()
	id, err := q.Enqueue(ctx, "t1", "invoice_bot", "approve_refunds", nil, 0.4, "reason", "", "fp-abc")
	require.NoError(t, err)
	require.NoError(t, q.Approve(ctx, id, "human", "ok"))

	first, err := q.Redeem(ctx, id, "fp-abc", 0)
	require.NoError(t, err)
	assert.True(t, first.Allowed, "the first redemption spends the approval")

	second, err := q.Redeem(ctx, id, "fp-abc", 0)
	require.NoError(t, err)
	assert.False(t, second.Allowed, "an approval may only be spent once")
	assert.Contains(t, second.Reason, "already been redeemed")
}

// TestRedeem_MismatchDoesNotBurnTheApproval: a refused redemption must not
// consume the human's decision, or an attacker could cancel an approval by
// presenting a wrong payload first.
func TestRedeem_MismatchDoesNotBurnTheApproval(t *testing.T) {
	ctx := context.Background()
	q := queue.NewInMemory()
	id, err := q.Enqueue(ctx, "t1", "invoice_bot", "approve_refunds", nil, 0.4, "reason", "", "fp-real")
	require.NoError(t, err)
	require.NoError(t, q.Approve(ctx, id, "human", "ok"))

	mismatch, err := q.Redeem(ctx, id, "fp-wrong", 0)
	require.NoError(t, err)
	assert.False(t, mismatch.Allowed)

	good, err := q.Redeem(ctx, id, "fp-real", 0)
	require.NoError(t, err)
	assert.True(t, good.Allowed, "a refused redemption must not spend the approval")
}

// TestListPending_ExcludesResolved covers B3: the reviewer list must reflect
// current state. Reading the enqueue-time stream meant resolved items were
// listed as pending forever and could bury a real one.
func TestListPending_ExcludesResolved(t *testing.T) {
	ctx := context.Background()
	q := queue.NewInMemory()

	victim, err := q.Enqueue(ctx, "t1", "bot", "action", nil, 0.5, "reason", "", "fp")
	require.NoError(t, err)

	for i := 0; i < 60; i++ {
		id, err := q.Enqueue(ctx, "t1", "bot", "noise", nil, 0.5, "reason", "", "fp")
		require.NoError(t, err)
		require.NoError(t, q.Approve(ctx, id, "human", ""))
	}

	page, err := q.ListPendingPage(ctx, 50, 0)
	require.NoError(t, err)
	assert.Equal(t, int64(1), page.Total, "only the unresolved item is pending")
	require.Len(t, page.Items, 1)
	assert.Equal(t, victim, page.Items[0].ID, "a genuinely pending item must not be buried by resolved ones")
}
