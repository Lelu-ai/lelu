package tokens_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-auth/lelu/engine/internal/tokens"
)

func TestMintAndValidate(t *testing.T) {
	svc := tokens.New(tokens.Config{SigningKey: "test-secret-key"})
	ctx := context.Background()

	res, err := svc.MintAgentToken(ctx, "invoice_bot", "user_123", 30*time.Second)
	require.NoError(t, err)
	assert.NotEmpty(t, res.Token)
	assert.NotEmpty(t, res.TokenID)
	assert.True(t, res.ExpiresAt.After(time.Now()))

	claims, err := svc.ValidateToken(ctx, res.Token)
	require.NoError(t, err)
	assert.Equal(t, "invoice_bot", claims.Scope)
	assert.Equal(t, "user_123", claims.ActingFor)
}

func TestDefaultTTL(t *testing.T) {
	svc := tokens.New(tokens.Config{SigningKey: "test-secret-key"})
	ctx := context.Background()

	res, err := svc.MintAgentToken(ctx, "bot", "user", 0) // 0 → use default
	require.NoError(t, err)
	// Default is 60 s; expiry should be ~60 s from now
	delta := time.Until(res.ExpiresAt)
	assert.True(t, delta > 55*time.Second && delta <= 60*time.Second)
}

func TestInvalidToken(t *testing.T) {
	svc := tokens.New(tokens.Config{SigningKey: "test-secret-key"})
	ctx := context.Background()

	_, err := svc.ValidateToken(ctx, "not.a.valid.jwt")
	assert.Error(t, err)
}

func TestWrongSigningKey(t *testing.T) {
	svcA := tokens.New(tokens.Config{SigningKey: "key-a"})
	svcB := tokens.New(tokens.Config{SigningKey: "key-b"})
	ctx := context.Background()

	res, err := svcA.MintAgentToken(ctx, "bot", "user", 30*time.Second)
	require.NoError(t, err)

	_, err = svcB.ValidateToken(ctx, res.Token)
	assert.Error(t, err)
}
