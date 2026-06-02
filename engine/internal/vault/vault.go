// Package vault stores OAuth credentials (access tokens, refresh tokens, API
// keys) encrypted at rest on a per-(agent_id, user_id, provider) basis.
//
// Encryption: AES-256-GCM with a key derived from the VAULT_KEY env var
// (falls back to JWT_SIGNING_KEY). Each stored value gets a random 12-byte
// nonce prepended before base64 encoding, so every write is unique.
//
// Auto-refresh: Get() checks whether the stored access token expires within
// 5 minutes and, if a refresh token and ProviderConfig are available,
// transparently exchanges it and writes the fresh credential back.
package vault

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/google/uuid"
)

const refreshBuffer = 5 * time.Minute

// ─── Domain types ─────────────────────────────────────────────────────────────

// CredentialEntry is the decrypted view of a stored credential.
type CredentialEntry struct {
	ID           string
	AgentID      string
	UserID       string
	Provider     string
	AccessToken  string
	RefreshToken string    // empty when not available
	Scopes       []string
	ExpiresAt    time.Time // zero = non-expiring
	CreatedAt    time.Time
	UpdatedAt    time.Time
	Refreshed    bool // true when Get() transparently refreshed the token
}

// StoreRequest is the input to Store().
type StoreRequest struct {
	AgentID      string
	UserID       string
	Provider     string
	AccessToken  string
	RefreshToken string
	Scopes       []string
	ExpiresAt    time.Time // zero = non-expiring
}

// ─── Service ──────────────────────────────────────────────────────────────────

// Service manages encrypted OAuth credentials.
type Service struct {
	db        *sql.DB
	encKey    [32]byte
	providers map[string]*ProviderConfig
}

// Config holds constructor options for Service.
type Config struct {
	DB        *sql.DB
	VaultKey  string            // raw key material — hashed to 32 bytes internally
	Providers []*ProviderConfig // optional, enables auto-refresh per provider
}

// New creates a Service and ensures the DB schema exists.
func New(cfg Config) (*Service, error) {
	key := sha256.Sum256([]byte(cfg.VaultKey))
	svc := &Service{
		db:        cfg.DB,
		encKey:    key,
		providers: make(map[string]*ProviderConfig, len(cfg.Providers)),
	}
	for _, p := range cfg.Providers {
		svc.providers[p.Name] = p
	}
	if err := svc.initSchema(context.Background()); err != nil {
		return nil, fmt.Errorf("vault: init schema: %w", err)
	}
	return svc, nil
}

// initSchema creates the credential_vault table if it doesn't exist.
func (s *Service) initSchema(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS credential_vault (
			id          TEXT PRIMARY KEY,
			agent_id    TEXT NOT NULL,
			user_id     TEXT NOT NULL,
			provider    TEXT NOT NULL,
			access_enc  TEXT NOT NULL,
			refresh_enc TEXT,
			scopes      TEXT NOT NULL DEFAULT '',
			expires_at  INTEGER,
			created_at  INTEGER NOT NULL,
			updated_at  INTEGER NOT NULL,
			UNIQUE(agent_id, user_id, provider)
		)
	`)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `CREATE INDEX IF NOT EXISTS idx_vault_agent ON credential_vault(agent_id)`)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `CREATE INDEX IF NOT EXISTS idx_vault_agent_user ON credential_vault(agent_id, user_id)`)
	return err
}

// ─── Store ────────────────────────────────────────────────────────────────────

// Store writes (or replaces) a credential. The access and refresh tokens are
// encrypted before writing.
func (s *Service) Store(ctx context.Context, req StoreRequest) (*CredentialEntry, error) {
	if req.AgentID == "" || req.UserID == "" || req.Provider == "" {
		return nil, fmt.Errorf("vault: agent_id, user_id, and provider are required")
	}
	if req.AccessToken == "" {
		return nil, fmt.Errorf("vault: access_token is required")
	}

	accessEnc, err := s.encrypt(req.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("vault: encrypt access token: %w", err)
	}

	var refreshEnc string
	if req.RefreshToken != "" {
		refreshEnc, err = s.encrypt(req.RefreshToken)
		if err != nil {
			return nil, fmt.Errorf("vault: encrypt refresh token: %w", err)
		}
	}

	id := uuid.NewString()
	now := time.Now().UTC()
	scopes := strings.Join(req.Scopes, " ")

	var expiresAt *int64
	if !req.ExpiresAt.IsZero() {
		v := req.ExpiresAt.Unix()
		expiresAt = &v
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO credential_vault (id, agent_id, user_id, provider, access_enc, refresh_enc, scopes, expires_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(agent_id, user_id, provider) DO UPDATE SET
			access_enc  = excluded.access_enc,
			refresh_enc = excluded.refresh_enc,
			scopes      = excluded.scopes,
			expires_at  = excluded.expires_at,
			updated_at  = excluded.updated_at
	`, id, req.AgentID, req.UserID, req.Provider, accessEnc, nullableString(refreshEnc), scopes,
		expiresAt, now.Unix(), now.Unix())
	if err != nil {
		return nil, fmt.Errorf("vault: store: %w", err)
	}

	return &CredentialEntry{
		ID:           id,
		AgentID:      req.AgentID,
		UserID:       req.UserID,
		Provider:     req.Provider,
		AccessToken:  req.AccessToken,
		RefreshToken: req.RefreshToken,
		Scopes:       req.Scopes,
		ExpiresAt:    req.ExpiresAt,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

// ─── Get ──────────────────────────────────────────────────────────────────────

// Get retrieves the decrypted credential for (agentID, userID, provider).
// If the access token expires within 5 minutes and a refresh token + provider
// config are available, it transparently exchanges it and returns the fresh token.
func (s *Service) Get(ctx context.Context, agentID, userID, provider string) (*CredentialEntry, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, access_enc, refresh_enc, scopes, expires_at, created_at, updated_at
		FROM credential_vault
		WHERE agent_id = ? AND user_id = ? AND provider = ?
	`, agentID, userID, provider)

	var (
		id, accessEnc string
		refreshEnc    sql.NullString
		scopesStr     string
		expiresAtUnix sql.NullInt64
		createdAtUnix, updatedAtUnix int64
	)
	if err := row.Scan(&id, &accessEnc, &refreshEnc, &scopesStr, &expiresAtUnix, &createdAtUnix, &updatedAtUnix); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("vault: no credential found for agent=%s user=%s provider=%s", agentID, userID, provider)
		}
		return nil, fmt.Errorf("vault: get: %w", err)
	}

	accessToken, err := s.decrypt(accessEnc)
	if err != nil {
		return nil, fmt.Errorf("vault: decrypt access token: %w", err)
	}

	var refreshToken string
	if refreshEnc.Valid && refreshEnc.String != "" {
		refreshToken, err = s.decrypt(refreshEnc.String)
		if err != nil {
			return nil, fmt.Errorf("vault: decrypt refresh token: %w", err)
		}
	}

	var expiresAt time.Time
	if expiresAtUnix.Valid {
		expiresAt = time.Unix(expiresAtUnix.Int64, 0).UTC()
	}

	scopes := parseScopes(scopesStr)
	entry := &CredentialEntry{
		ID:           id,
		AgentID:      agentID,
		UserID:       userID,
		Provider:     provider,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		Scopes:       scopes,
		ExpiresAt:    expiresAt,
		CreatedAt:    time.Unix(createdAtUnix, 0).UTC(),
		UpdatedAt:    time.Unix(updatedAtUnix, 0).UTC(),
	}

	// Auto-refresh if token expires soon and we have the capability.
	if s.shouldRefresh(expiresAt) && refreshToken != "" {
		if p, ok := s.providers[provider]; ok {
			fresh, err := p.ExchangeRefreshToken(ctx, refreshToken)
			if err == nil {
				refreshScopes := scopes
				if fresh.Scopes != "" {
					refreshScopes = parseScopes(fresh.Scopes)
				}
				updated, storeErr := s.Store(ctx, StoreRequest{
					AgentID:      agentID,
					UserID:       userID,
					Provider:     provider,
					AccessToken:  fresh.AccessToken,
					RefreshToken: refreshToken, // keep same refresh token
					Scopes:       refreshScopes,
					ExpiresAt:    fresh.ExpiresAt,
				})
				if storeErr == nil {
					updated.Refreshed = true
					return updated, nil
				}
			}
			// If refresh fails, return the existing token and let the caller deal with it.
		}
	}

	return entry, nil
}

// ─── Revoke ───────────────────────────────────────────────────────────────────

// Revoke deletes the stored credential for (agentID, userID, provider).
func (s *Service) Revoke(ctx context.Context, agentID, userID, provider string) error {
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM credential_vault WHERE agent_id = ? AND user_id = ? AND provider = ?`,
		agentID, userID, provider)
	if err != nil {
		return fmt.Errorf("vault: revoke: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("vault: no credential found for agent=%s user=%s provider=%s", agentID, userID, provider)
	}
	return nil
}

// ─── ListByAgent ──────────────────────────────────────────────────────────────

// ListByAgent returns metadata (no decrypted tokens) for all credentials stored
// for the given agent. Access tokens are redacted.
func (s *Service) ListByAgent(ctx context.Context, agentID string) ([]*CredentialSummary, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, agent_id, user_id, provider, scopes, expires_at, created_at, updated_at
		FROM credential_vault WHERE agent_id = ? ORDER BY provider, user_id
	`, agentID)
	if err != nil {
		return nil, fmt.Errorf("vault: list: %w", err)
	}
	defer rows.Close()

	var out []*CredentialSummary
	for rows.Next() {
		var (
			id, aid, uid, prov, scopesStr string
			expiresAtUnix                 sql.NullInt64
			createdAtUnix, updatedAtUnix  int64
		)
		if err := rows.Scan(&id, &aid, &uid, &prov, &scopesStr, &expiresAtUnix, &createdAtUnix, &updatedAtUnix); err != nil {
			continue
		}
		cs := &CredentialSummary{
			ID:        id,
			AgentID:   aid,
			UserID:    uid,
			Provider:  prov,
			Scopes:    parseScopes(scopesStr),
			CreatedAt: time.Unix(createdAtUnix, 0).UTC(),
			UpdatedAt: time.Unix(updatedAtUnix, 0).UTC(),
		}
		if expiresAtUnix.Valid {
			t := time.Unix(expiresAtUnix.Int64, 0).UTC()
			cs.ExpiresAt = &t
			cs.Expired = t.Before(time.Now().UTC())
		}
		out = append(out, cs)
	}
	return out, rows.Err()
}

// CredentialSummary is a redacted view of a stored credential (no tokens exposed).
type CredentialSummary struct {
	ID        string
	AgentID   string
	UserID    string
	Provider  string
	Scopes    []string
	ExpiresAt *time.Time
	Expired   bool
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Providers returns the names of all configured OAuth providers.
func (s *Service) Providers() []string {
	names := make([]string, 0, len(s.providers))
	for name := range s.providers {
		names = append(names, name)
	}
	return names
}

// ─── Encryption helpers ───────────────────────────────────────────────────────

func (s *Service) encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(s.encKey[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

func (s *Service) decrypt(encoded string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("base64 decode: %w", err)
	}
	block, err := aes.NewCipher(s.encKey[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	ns := gcm.NonceSize()
	if len(data) < ns {
		return "", fmt.Errorf("ciphertext too short")
	}
	plaintext, err := gcm.Open(nil, data[:ns], data[ns:], nil)
	if err != nil {
		return "", fmt.Errorf("decrypt: %w", err)
	}
	return string(plaintext), nil
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func (s *Service) shouldRefresh(expiresAt time.Time) bool {
	if expiresAt.IsZero() {
		return false
	}
	return time.Until(expiresAt) < refreshBuffer
}

func parseScopes(s string) []string {
	if s == "" {
		return nil
	}
	return strings.Fields(s)
}

func nullableString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
