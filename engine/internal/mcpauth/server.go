// Package mcpauth implements an MCP-compatible OAuth 2.1 authorization server.
//
// Supported flows:
//   - Authorization Code + PKCE (S256) — for interactive agent platform auth
//   - Client Credentials — for M2M / service-to-service access
//
// Endpoints:
//
//	POST /oauth/clients          — RFC 7591 dynamic client registration
//	GET  /oauth/authorize        — authorization code initiation
//	POST /oauth/token            — token exchange (code, client_credentials, refresh_token)
//
// Metadata (public, no auth):
//
//	GET /.well-known/oauth-authorization-server   — RFC 8414
//	GET /.well-known/oauth-protected-resource     — RFC 9728
//	GET /.well-known/openid-configuration         — OIDC discovery
//	GET /.well-known/jwks.json                    — public key set
package mcpauth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// ── Domain types ──────────────────────────────────────────────────────────────

// OAuthClient represents a dynamically registered OAuth 2.1 client.
type OAuthClient struct {
	ClientID                string
	ClientSecret            string // empty for public clients (PKCE-only)
	ClientName              string
	RedirectURIs            []string
	GrantTypes              []string
	Scopes                  string
	TokenEndpointAuthMethod string
	CreatedAt               time.Time
}

// ── Server ───────────────────────────────────────────────────────────────────

// Server is the MCP OAuth 2.1 authorization server.
type Server struct {
	db         *sql.DB
	signingKey *rsa.PrivateKey
	issuer     string
	keyID      string
	accessTTL  time.Duration
	refreshTTL time.Duration
}

// Config for Server.
type Config struct {
	DB         *sql.DB
	SigningKey *rsa.PrivateKey // same key as identity.Registry for unified JWKS
	Issuer     string
	KeyID      string
	AccessTTL  time.Duration // default 1h
	RefreshTTL time.Duration // default 30 days; 0 = no refresh tokens
}

// New creates an MCP OAuth 2.1 Server.
func New(cfg Config) (*Server, error) {
	if cfg.DB == nil {
		return nil, fmt.Errorf("mcpauth: DB is required")
	}
	if cfg.SigningKey == nil {
		return nil, fmt.Errorf("mcpauth: SigningKey is required")
	}
	if cfg.Issuer == "" {
		cfg.Issuer = "https://lelu-ai.com"
	}
	if cfg.AccessTTL == 0 {
		cfg.AccessTTL = time.Hour
	}
	if cfg.RefreshTTL == 0 {
		cfg.RefreshTTL = 30 * 24 * time.Hour
	}

	if err := initSchema(cfg.DB); err != nil {
		return nil, fmt.Errorf("mcpauth: init schema: %w", err)
	}

	return &Server{
		db:         cfg.DB,
		signingKey: cfg.SigningKey,
		issuer:     cfg.Issuer,
		keyID:      cfg.KeyID,
		accessTTL:  cfg.AccessTTL,
		refreshTTL: cfg.RefreshTTL,
	}, nil
}

// RegisterRoutes attaches all MCP OAuth endpoints to mux.
// The caller must ensure that the /.well-known/* and /oauth/* paths are
// excluded from any API-key middleware before calling this.
func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /oauth/clients", s.handleRegisterClient)
	mux.HandleFunc("GET /oauth/authorize", s.handleAuthorize)
	mux.HandleFunc("POST /oauth/token", s.handleToken)
}

// ── Dynamic Client Registration (RFC 7591) ───────────────────────────────────

func (s *Server) handleRegisterClient(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ClientName              string   `json:"client_name"`
		RedirectURIs            []string `json:"redirect_uris"`
		GrantTypes              []string `json:"grant_types"`
		Scope                   string   `json:"scope"`
		TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "malformed JSON")
		return
	}

	if len(req.GrantTypes) == 0 {
		req.GrantTypes = []string{"authorization_code"}
	}
	if req.TokenEndpointAuthMethod == "" {
		req.TokenEndpointAuthMethod = "client_secret_post"
	}
	if req.ClientName == "" {
		req.ClientName = "unnamed-client"
	}

	clientID := "lelu_client_" + uuid.NewString()
	var clientSecret string
	// public clients (none auth method) don't get a secret — they use PKCE
	if req.TokenEndpointAuthMethod != "none" {
		clientSecret = generateSecret(32)
	}

	redirectsJSON, _ := json.Marshal(req.RedirectURIs)
	grantsJSON, _ := json.Marshal(req.GrantTypes)

	_, err := s.db.ExecContext(r.Context(), `
		INSERT INTO oauth_clients
		  (client_id, client_secret, client_name, redirect_uris, grant_types, scopes,
		   token_endpoint_auth_method, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		clientID, clientSecret, req.ClientName,
		string(redirectsJSON), string(grantsJSON),
		req.Scope, req.TokenEndpointAuthMethod,
		time.Now().UTC().Unix(),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to register client")
		return
	}

	resp := map[string]any{
		"client_id":                  clientID,
		"client_name":                req.ClientName,
		"redirect_uris":              req.RedirectURIs,
		"grant_types":                req.GrantTypes,
		"scope":                      req.Scope,
		"token_endpoint_auth_method": req.TokenEndpointAuthMethod,
		"client_id_issued_at":        time.Now().UTC().Unix(),
	}
	if clientSecret != "" {
		resp["client_secret"] = clientSecret
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

// ── Authorization Endpoint ───────────────────────────────────────────────────

// handleAuthorize handles the authorization code flow.
// For MCP agent platforms this is typically a redirect-based flow where Lelu
// acts as the AS and the MCP client (agent) gets an authorization code to
// exchange for an access token.
//
// Required query params: client_id, redirect_uri, response_type=code,
// code_challenge (S256), code_challenge_method=S256, scope, state.
func (s *Server) handleAuthorize(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	clientID := q.Get("client_id")
	redirectURI := q.Get("redirect_uri")
	responseType := q.Get("response_type")
	codeChallenge := q.Get("code_challenge")
	challengeMethod := q.Get("code_challenge_method")
	scope := q.Get("scope")
	state := q.Get("state")

	if responseType != "code" {
		writeError(w, http.StatusBadRequest, "unsupported_response_type", "only 'code' is supported")
		return
	}
	if clientID == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "client_id is required")
		return
	}
	if codeChallenge == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "code_challenge is required (PKCE S256)")
		return
	}
	if challengeMethod != "S256" {
		writeError(w, http.StatusBadRequest, "invalid_request", "only S256 code_challenge_method is supported")
		return
	}

	// Validate client exists.
	client, err := s.getClient(r.Context(), clientID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_client", "unknown client_id")
		return
	}

	// Validate redirect_uri is registered.
	if redirectURI != "" && !containsString(client.RedirectURIs, redirectURI) {
		writeError(w, http.StatusBadRequest, "invalid_request", "redirect_uri not registered")
		return
	}

	// Issue authorization code (short-lived, single-use).
	code := generateSecret(24)
	expires := time.Now().UTC().Add(5 * time.Minute)
	effectiveRedirect := redirectURI
	if effectiveRedirect == "" && len(client.RedirectURIs) > 0 {
		effectiveRedirect = client.RedirectURIs[0]
	}

	_, err = s.db.ExecContext(r.Context(), `
		INSERT INTO oauth_codes
		  (code, client_id, redirect_uri, scope, code_challenge, expires_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		code, clientID, effectiveRedirect, scope,
		codeChallenge, expires.Unix(), time.Now().UTC().Unix(),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to create authorization code")
		return
	}

	// For non-redirect flows (e.g. MCP CLI), return the code as JSON.
	// For browser flows, redirect with code + state.
	if effectiveRedirect == "" || effectiveRedirect == "urn:ietf:wg:oauth:2.0:oob" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"code":  code,
			"state": state,
		})
		return
	}

	redirectURL := effectiveRedirect
	sep := "?"
	if strings.Contains(redirectURL, "?") {
		sep = "&"
	}
	redirectURL += sep + "code=" + code
	if state != "" {
		redirectURL += "&state=" + state
	}
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// ── Token Endpoint ────────────────────────────────────────────────────────────

func (s *Server) handleToken(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "could not parse request body")
		return
	}

	grantType := r.FormValue("grant_type")
	switch grantType {
	case "authorization_code":
		s.handleAuthCodeExchange(w, r)
	case "client_credentials":
		s.handleClientCredentials(w, r)
	case "refresh_token":
		s.handleRefreshToken(w, r)
	default:
		writeError(w, http.StatusBadRequest, "unsupported_grant_type",
			fmt.Sprintf("grant type %q is not supported", grantType))
	}
}

// handleAuthCodeExchange exchanges an authorization code for an access token.
func (s *Server) handleAuthCodeExchange(w http.ResponseWriter, r *http.Request) {
	code := r.FormValue("code")
	codeVerifier := r.FormValue("code_verifier")
	clientID := r.FormValue("client_id")
	redirectURI := r.FormValue("redirect_uri")

	if code == "" || codeVerifier == "" || clientID == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "code, code_verifier, and client_id are required")
		return
	}

	// Load and validate the authorization code.
	var (
		storedClientID    string
		storedRedirectURI string
		storedScope       string
		storedChallenge   string
		expiresAt         int64
	)
	err := s.db.QueryRowContext(r.Context(), `
		SELECT client_id, redirect_uri, scope, code_challenge, expires_at
		FROM oauth_codes WHERE code = ?`, code).Scan(
		&storedClientID, &storedRedirectURI, &storedScope, &storedChallenge, &expiresAt,
	)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusBadRequest, "invalid_grant", "authorization code not found or already used")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to validate code")
		return
	}

	// Delete immediately (codes are single-use).
	s.db.ExecContext(r.Context(), `DELETE FROM oauth_codes WHERE code = ?`, code)

	if time.Now().UTC().Unix() > expiresAt {
		writeError(w, http.StatusBadRequest, "invalid_grant", "authorization code expired")
		return
	}
	if storedClientID != clientID {
		writeError(w, http.StatusBadRequest, "invalid_grant", "client_id mismatch")
		return
	}
	if redirectURI != "" && storedRedirectURI != redirectURI {
		writeError(w, http.StatusBadRequest, "invalid_grant", "redirect_uri mismatch")
		return
	}

	// Verify PKCE code_verifier against stored S256 challenge.
	if !verifyPKCE(codeVerifier, storedChallenge) {
		writeError(w, http.StatusBadRequest, "invalid_grant", "PKCE verification failed")
		return
	}

	s.issueTokenResponse(r.Context(), w, clientID, storedScope)
}

// handleClientCredentials issues an access token for M2M / service-to-service.
func (s *Server) handleClientCredentials(w http.ResponseWriter, r *http.Request) {
	clientID, clientSecret, ok := r.BasicAuth()
	if !ok {
		// Try form params
		clientID = r.FormValue("client_id")
		clientSecret = r.FormValue("client_secret")
	}

	if clientID == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "client_id is required")
		return
	}

	client, err := s.getClient(r.Context(), clientID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_client", "unknown client")
		return
	}
	if client.ClientSecret == "" {
		writeError(w, http.StatusUnauthorized, "invalid_client", "client does not support client_credentials (no secret)")
		return
	}
	if !secureCompare(client.ClientSecret, clientSecret) {
		writeError(w, http.StatusUnauthorized, "invalid_client", "invalid client_secret")
		return
	}

	scope := r.FormValue("scope")
	if scope == "" {
		scope = client.Scopes
	}

	s.issueTokenResponse(r.Context(), w, clientID, scope)
}

// handleRefreshToken exchanges a refresh token for a new access token.
func (s *Server) handleRefreshToken(w http.ResponseWriter, r *http.Request) {
	refreshToken := r.FormValue("refresh_token")
	clientID := r.FormValue("client_id")

	if refreshToken == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "refresh_token is required")
		return
	}

	var (
		storedClientID string
		storedScope    string
		expiresAt      sql.NullInt64
		tokenID        string
	)
	err := s.db.QueryRowContext(r.Context(), `
		SELECT token_id, client_id, scope, refresh_expires_at
		FROM oauth_tokens WHERE refresh_token = ?`, refreshToken).Scan(
		&tokenID, &storedClientID, &storedScope, &expiresAt,
	)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusBadRequest, "invalid_grant", "refresh token not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to validate refresh token")
		return
	}
	if clientID != "" && storedClientID != clientID {
		writeError(w, http.StatusBadRequest, "invalid_grant", "client_id mismatch")
		return
	}
	if expiresAt.Valid && time.Now().UTC().Unix() > expiresAt.Int64 {
		s.db.ExecContext(r.Context(), `DELETE FROM oauth_tokens WHERE token_id = ?`, tokenID)
		writeError(w, http.StatusBadRequest, "invalid_grant", "refresh token expired")
		return
	}

	// Revoke old token record, issue fresh pair.
	s.db.ExecContext(r.Context(), `DELETE FROM oauth_tokens WHERE token_id = ?`, tokenID)
	s.issueTokenResponse(r.Context(), w, storedClientID, storedScope)
}

// issueTokenResponse mints access + refresh tokens and writes the token response.
func (s *Server) issueTokenResponse(ctx context.Context, w http.ResponseWriter, clientID, scope string) {
	now := time.Now().UTC()
	exp := now.Add(s.accessTTL)

	claims := jwt.MapClaims{
		"iss":       s.issuer,
		"sub":       clientID,
		"aud":       []string{"lelu", "mcp"},
		"iat":       jwt.NewNumericDate(now),
		"exp":       jwt.NewNumericDate(exp),
		"jti":       uuid.NewString(),
		"scope":     scope,
		"client_id": clientID,
	}

	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = s.keyID

	accessToken, err := tok.SignedString(s.signingKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to sign access token")
		return
	}

	tokenID := uuid.NewString()
	refreshToken := generateSecret(32)
	refreshExp := now.Add(s.refreshTTL).Unix()

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO oauth_tokens
		  (token_id, client_id, access_token, refresh_token, scope, expires_at, refresh_expires_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		tokenID, clientID, accessToken, refreshToken,
		scope, exp.Unix(), refreshExp, now.Unix(),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to persist token")
		return
	}

	resp := map[string]any{
		"access_token":  accessToken,
		"token_type":    "Bearer",
		"expires_in":    int(s.accessTTL.Seconds()),
		"refresh_token": refreshToken,
		"scope":         scope,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(resp)
}

// ── Client lookup ─────────────────────────────────────────────────────────────

func (s *Server) getClient(ctx context.Context, clientID string) (*OAuthClient, error) {
	var (
		c             OAuthClient
		redirectsJSON string
		grantsJSON    string
		createdAt     int64
	)
	err := s.db.QueryRowContext(ctx, `
		SELECT client_id, client_secret, client_name, redirect_uris, grant_types, scopes,
		       token_endpoint_auth_method, created_at
		FROM oauth_clients WHERE client_id = ?`, clientID).Scan(
		&c.ClientID, &c.ClientSecret, &c.ClientName,
		&redirectsJSON, &grantsJSON,
		&c.Scopes, &c.TokenEndpointAuthMethod, &createdAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("mcpauth: client not found")
	}
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal([]byte(redirectsJSON), &c.RedirectURIs)
	_ = json.Unmarshal([]byte(grantsJSON), &c.GrantTypes)
	c.CreatedAt = time.Unix(createdAt, 0).UTC()
	return &c, nil
}

// ── Schema ────────────────────────────────────────────────────────────────────

func initSchema(db *sql.DB) error {
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS oauth_clients (
		client_id                  TEXT PRIMARY KEY,
		client_secret              TEXT,
		client_name                TEXT NOT NULL DEFAULT '',
		redirect_uris              TEXT NOT NULL DEFAULT '[]',
		grant_types                TEXT NOT NULL DEFAULT '["authorization_code"]',
		scopes                     TEXT NOT NULL DEFAULT '',
		token_endpoint_auth_method TEXT NOT NULL DEFAULT 'client_secret_post',
		created_at                 INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS oauth_codes (
		code           TEXT PRIMARY KEY,
		client_id      TEXT NOT NULL,
		redirect_uri   TEXT NOT NULL DEFAULT '',
		scope          TEXT NOT NULL DEFAULT '',
		code_challenge TEXT,
		expires_at     INTEGER NOT NULL,
		created_at     INTEGER NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_oauth_codes_client ON oauth_codes(client_id);

	CREATE TABLE IF NOT EXISTS oauth_tokens (
		token_id           TEXT PRIMARY KEY,
		client_id          TEXT NOT NULL,
		access_token       TEXT NOT NULL UNIQUE,
		refresh_token      TEXT UNIQUE,
		scope              TEXT NOT NULL DEFAULT '',
		expires_at         INTEGER,
		refresh_expires_at INTEGER,
		created_at         INTEGER NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_oauth_tokens_client  ON oauth_tokens(client_id);
	CREATE INDEX IF NOT EXISTS idx_oauth_tokens_refresh ON oauth_tokens(refresh_token);
	`)
	return err
}

// ── PKCE ─────────────────────────────────────────────────────────────────────

// verifyPKCE checks that SHA-256(codeVerifier) == base64url(codeChallenge).
func verifyPKCE(verifier, storedChallenge string) bool {
	h := sha256.Sum256([]byte(verifier))
	computed := base64.RawURLEncoding.EncodeToString(h[:])
	return subtle.ConstantTimeCompare([]byte(computed), []byte(storedChallenge)) == 1
}

// ── helpers ───────────────────────────────────────────────────────────────────

func generateSecret(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func secureCompare(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

func containsString(slice []string, s string) bool {
	for _, v := range slice {
		if v == s {
			return true
		}
	}
	return false
}

func writeError(w http.ResponseWriter, status int, errCode, description string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{
		"error":             errCode,
		"error_description": description,
	})
}
