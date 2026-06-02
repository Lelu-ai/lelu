package vault

import (
	"context"
	"database/sql"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	return db
}

func TestVaultStoreAndGet(t *testing.T) {
	svc, err := New(Config{DB: setupTestDB(t), VaultKey: "test-key-material"})
	require.NoError(t, err)

	ctx := context.Background()

	entry, err := svc.Store(ctx, StoreRequest{
		AgentID:      "agent-1",
		UserID:       "user-abc",
		Provider:     "github",
		AccessToken:  "ghs_super_secret_token",
		RefreshToken: "ghr_refresh_token",
		Scopes:       []string{"repo", "read:org"},
		ExpiresAt:    time.Now().Add(time.Hour),
	})
	require.NoError(t, err)
	assert.NotEmpty(t, entry.ID)
	assert.Equal(t, "agent-1", entry.AgentID)
	assert.Equal(t, "github", entry.Provider)

	// Get should return decrypted token
	got, err := svc.Get(ctx, "agent-1", "user-abc", "github")
	require.NoError(t, err)
	assert.Equal(t, "ghs_super_secret_token", got.AccessToken)
	assert.Equal(t, "ghr_refresh_token", got.RefreshToken)
	assert.Equal(t, []string{"repo", "read:org"}, got.Scopes)
	assert.False(t, got.Refreshed)
}

func TestVaultUpsert(t *testing.T) {
	svc, err := New(Config{DB: setupTestDB(t), VaultKey: "test-key"})
	require.NoError(t, err)
	ctx := context.Background()

	_, err = svc.Store(ctx, StoreRequest{AgentID: "a", UserID: "u", Provider: "slack", AccessToken: "tok1"})
	require.NoError(t, err)

	// Overwrite with new token
	_, err = svc.Store(ctx, StoreRequest{AgentID: "a", UserID: "u", Provider: "slack", AccessToken: "tok2"})
	require.NoError(t, err)

	got, err := svc.Get(ctx, "a", "u", "slack")
	require.NoError(t, err)
	assert.Equal(t, "tok2", got.AccessToken)
}

func TestVaultRevoke(t *testing.T) {
	svc, err := New(Config{DB: setupTestDB(t), VaultKey: "test-key"})
	require.NoError(t, err)
	ctx := context.Background()

	_, err = svc.Store(ctx, StoreRequest{AgentID: "a", UserID: "u", Provider: "google", AccessToken: "tok"})
	require.NoError(t, err)

	require.NoError(t, svc.Revoke(ctx, "a", "u", "google"))

	_, err = svc.Get(ctx, "a", "u", "google")
	assert.Error(t, err, "should error after revoke")
}

func TestVaultListByAgent(t *testing.T) {
	svc, err := New(Config{DB: setupTestDB(t), VaultKey: "test-key"})
	require.NoError(t, err)
	ctx := context.Background()

	providers := []string{"github", "slack", "google"}
	for _, p := range providers {
		_, err = svc.Store(ctx, StoreRequest{AgentID: "bot", UserID: "user1", Provider: p, AccessToken: "tok"})
		require.NoError(t, err)
	}

	summaries, err := svc.ListByAgent(ctx, "bot")
	require.NoError(t, err)
	assert.Len(t, summaries, 3)
	for _, s := range summaries {
		assert.Equal(t, "bot", s.AgentID)
		// Access tokens must NOT be in summaries
	}
}

func TestVaultEncryptionIsolation(t *testing.T) {
	db := setupTestDB(t)
	svc1, err := New(Config{DB: db, VaultKey: "key-A"})
	require.NoError(t, err)

	svc2, err := New(Config{DB: db, VaultKey: "key-B"})
	require.NoError(t, err)

	ctx := context.Background()
	_, err = svc1.Store(ctx, StoreRequest{AgentID: "a", UserID: "u", Provider: "p", AccessToken: "secret"})
	require.NoError(t, err)

	// svc2 uses a different key — decryption should fail
	_, err = svc2.Get(ctx, "a", "u", "p")
	assert.Error(t, err, "different vault key must not decrypt stored credential")
}

func TestVaultMissingCredential(t *testing.T) {
	svc, err := New(Config{DB: setupTestDB(t), VaultKey: "test-key"})
	require.NoError(t, err)

	_, err = svc.Get(context.Background(), "nobody", "nobody", "nowhere")
	assert.Error(t, err)
}
