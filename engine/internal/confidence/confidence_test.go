package confidence_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-auth/lelu/engine/internal/confidence"
)

func TestGate_FullPermission(t *testing.T) {
	g := confidence.New()
	dec, err := g.Evaluate(context.Background(), 0.95, nil)
	require.NoError(t, err)
	assert.Equal(t, confidence.LevelFullPermission, dec.Level)
	assert.True(t, dec.Allowed)
	assert.False(t, dec.RequiresHumanReview)
	assert.Empty(t, dec.DowngradedScope)
}

func TestGate_RequiresHumanReview(t *testing.T) {
	g := confidence.New()
	dec, err := g.Evaluate(context.Background(), 0.80, nil)
	require.NoError(t, err)
	assert.Equal(t, confidence.LevelRequiresHuman, dec.Level)
	assert.False(t, dec.Allowed)
	assert.True(t, dec.RequiresHumanReview)
}

func TestGate_ReadOnly(t *testing.T) {
	g := confidence.New()
	dec, err := g.Evaluate(context.Background(), 0.60, nil)
	require.NoError(t, err)
	assert.Equal(t, confidence.LevelReadOnly, dec.Level)
	assert.False(t, dec.Allowed)
	assert.Equal(t, "read_only", dec.DowngradedScope)
}

func TestGate_HardDeny(t *testing.T) {
	g := confidence.New()
	dec, err := g.Evaluate(context.Background(), 0.30, nil)
	require.NoError(t, err)
	assert.Equal(t, confidence.LevelHardDeny, dec.Level)
	assert.False(t, dec.Allowed)
}

func TestGate_ExactThresholds(t *testing.T) {
	g := confidence.New()

	dec, _ := g.Evaluate(context.Background(), confidence.ThresholdFull, nil)
	assert.Equal(t, confidence.LevelFullPermission, dec.Level)

	dec, _ = g.Evaluate(context.Background(), confidence.ThresholdHuman, nil)
	assert.Equal(t, confidence.LevelRequiresHuman, dec.Level)

	dec, _ = g.Evaluate(context.Background(), confidence.ThresholdHardDeny, nil)
	assert.Equal(t, confidence.LevelReadOnly, dec.Level)
}

func TestGate_CustomPolicy(t *testing.T) {
	g := confidence.New()
	policy := &confidence.Policy{
		FullPermissionAbove: 0.95,
		HumanReviewAbove:    0.80,
		HardDenyBelow:       0.60,
	}

	// 0.91 would pass default but should need human review with custom policy
	dec, err := g.Evaluate(context.Background(), 0.91, policy)
	require.NoError(t, err)
	assert.Equal(t, confidence.LevelRequiresHuman, dec.Level)
}

func TestGate_InvalidScore(t *testing.T) {
	g := confidence.New()
	_, err := g.Evaluate(context.Background(), 1.5, nil)
	assert.Error(t, err)

	_, err = g.Evaluate(context.Background(), -0.1, nil)
	assert.Error(t, err)
}

func TestLevel_String(t *testing.T) {
	assert.Equal(t, "full_permission", confidence.LevelFullPermission.String())
	assert.Equal(t, "requires_human_review", confidence.LevelRequiresHuman.String())
	assert.Equal(t, "read_only", confidence.LevelReadOnly.String())
	assert.Equal(t, "hard_deny", confidence.LevelHardDeny.String())
}
