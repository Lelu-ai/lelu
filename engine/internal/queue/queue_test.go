package queue_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu/engine/internal/queue"
)

// Tests use NewInMemory (no Redis required) to validate business logic.

func TestEnqueue_NoRedis(t *testing.T) {
	q := queue.NewInMemory()
	id, err := q.Enqueue(context.Background(), "default", "invoice_bot", "approve_refund", nil, 0.75, "low confidence", "user_1")
	require.NoError(t, err)
	assert.NotEmpty(t, id, "in-memory queue must return a real ID")
}

func TestListPending_NoRedis(t *testing.T) {
	q := queue.NewInMemory()
	_, err := q.Enqueue(context.Background(), "default", "bot", "action", nil, 0.5, "reason", "user")
	require.NoError(t, err)

	items, err := q.ListPending(context.Background(), 10)
	require.NoError(t, err)
	assert.Len(t, items, 1)
	assert.Equal(t, queue.StatusPending, items[0].Status)
}

func TestApprove_NoRedis(t *testing.T) {
	q := queue.NewInMemory()
	id, err := q.Enqueue(context.Background(), "default", "bot", "action", nil, 0.5, "reason", "user")
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
	id, err := q.Enqueue(context.Background(), "default", "bot", "action", nil, 0.5, "reason", "user")
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
	id, _ := q.Enqueue(context.Background(), "t1", "bot", "act", nil, 0.5, "r", "u")
	require.NoError(t, q.Approve(context.Background(), id, "admin", ""))
	err := q.Deny(context.Background(), id, "admin", "")
	assert.Error(t, err, "resolving an already-resolved item must return an error")
}

func TestConstants(t *testing.T) {
	assert.Equal(t, "pending", string(queue.StatusPending))
	assert.Equal(t, "approved", string(queue.StatusApproved))
	assert.Equal(t, "denied", string(queue.StatusDenied))
}
