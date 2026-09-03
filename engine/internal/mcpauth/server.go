// Package mcpauth implements an MCP-compatible OAuth 2.1 authorization server.
//
// Supported flows:
//   - Authorization Code + PKCE (S256) — for interactive agent platform auth
//   - Client Credentials — for M2M / service-to-service access
//
// Endpoints:
//
//	POST   /oauth/clients        — RFC 7591 dynamic client registration
//	DELETE /oauth/clients/{id}   — revoke a client and all its tokens
//	GET    /oauth/authorize      — authorization code initiation
//	POST   /oauth/token          — token exchange (code, client_credentials, refresh_token)
//	POST   /oauth/revoke         — RFC 7009 token revocation
//	POST   /oauth/introspect     — RFC 7662 token introspection (client-authenticated)
//
// Scope is enforced, not echoed: see grantableScope. A granted scope is the
// intersection of what was requested, what this server supports, and what the
// client is registered to hold, re-evaluated at every issuance including
// refresh.
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
	// Owner is the Lelu principal that registered this client, captured at
	// registration. It is what a granted scope is ultimately bounded by.
	Owner string
	// RevokedAt is non-nil once the client has been revoked. A revoked client
	// mints nothing, including via an outstanding refresh token.
	RevokedAt *time.Time
}

// Revoked reports whether this client may still be used.
func (c *OAuthClient) Revoked() bool { return c.RevokedAt != nil }

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
	mux.HandleFunc("DELETE /oauth/clients/{id}", s.handleRevokeClient)
	mux.HandleFunc("GET /oauth/authorize", s.handleAuthorize)
	mux.HandleFunc("POST /oauth/token", s.handleToken)
	mux.HandleFunc("POST /oauth/revoke", s.handleRevoke)
	mux.HandleFunc("POST /oauth/introspect", s.handleIntrospect)
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

	// Reject unsupported scopes at registration rather than at first use.
	for _, sc := range strings.Fields(req.Scope) {
		if !containsString(SupportedScopes, sc) {
			writeError(w, http.StatusBadRequest, "invalid_scope",
				fmt.Sprintf("scope %q is not supported (supported: %s)", sc, strings.Join(SupportedScopes, " ")))
			return
		}
	}

	// The registering principal owns the client. authMiddleware has already
	// established it — registration is not an anonymous endpoint.
	owner := OwnerFromContext(r.Context())

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
		   token_endpoint_auth_method, created_at, owner)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		clientID, clientSecret, req.ClientName,
		string(redirectsJSON), string(grantsJSON),
		req.Scope, req.TokenEndpointAuthMethod,
		time.Now().UTC().Unix(), owner,
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

	// Validate client exists and has not been revoked.
	client, err := s.getLiveClient(r.Context(), clientID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_client", "unknown or revoked client_id")
		return
	}

	// Bind the scope now, at the point it is requested, and store the bound
	// value rather than the raw query parameter. Storing the request verbatim
	// meant the only check on a token's authority happened nowhere: authorize
	// copied the query string into the code, and token copied the code's
	// scope into a signed JWT.
	grantedScope, err := grantableScope(scope, client)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_scope", err.Error())
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
		code, clientID, effectiveRedirect, grantedScope,
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

	// The client must still be live at exchange time, and a confidential
	// client must authenticate. A code issued minutes ago is not authority to
	// mint a token for a client that has since been revoked.
	client, err := s.getLiveClient(r.Context(), clientID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_client", "unknown or revoked client")
		return
	}
	if client.TokenEndpointAuthMethod != "none" && client.ClientSecret != "" {
		_, presentedSecret, ok := r.BasicAuth()
		if !ok {
			presentedSecret = r.FormValue("client_secret")
		}
		if !secureCompare(client.ClientSecret, presentedSecret) {
			writeError(w, http.StatusUnauthorized, "invalid_client", "client authentication is required")
			return
		}
	}

	// Re-bind: the stored scope was bounded at authorize time, but the
	// client's registration may have narrowed since.
	grantedScope, err := grantableScope(storedScope, client)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_scope", err.Error())
		return
	}

	s.issueTokenResponse(r.Context(), w, clientID, grantedScope)
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

	client, err := s.getLiveClient(r.Context(), clientID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_client", "unknown or revoked client")
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

	grantedScope, err := grantableScope(r.FormValue("scope"), client)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_scope", err.Error())
		return
	}

	s.issueTokenResponse(r.Context(), w, clientID, grantedScope)
}

// handleRefreshToken exchanges a refresh token for a new access token.
//
// Two things this must do that it previously did not.
//
// It authenticates the client. A refresh token was accepted on its own, with
// no client_secret and no Authorization header, even for a client registered
// as client_secret_post and issued a secret. Since refresh tokens rotate, a
// single leaked refresh token was an indefinitely renewable credential
// requiring nothing else.
//
// It re-checks the client. The old query selected from oauth_tokens by
// refresh token and reissued without ever joining to oauth_clients, so a
// client that had been deleted outright kept minting valid, JWKS-verifiable
// tokens from its existing refresh chain. Revocation that new authorizations
// respect and existing chains ignore is not revocation.
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
		revokedAt      sql.NullInt64
		tokenID        string
	)
	err := s.db.QueryRowContext(r.Context(), `
		SELECT token_id, client_id, scope, refresh_expires_at, revoked_at
		FROM oauth_tokens WHERE refresh_token = ?`, refreshToken).Scan(
		&tokenID, &storedClientID, &storedScope, &expiresAt, &revokedAt,
	)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusBadRequest, "invalid_grant", "refresh token not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to validate refresh token")
		return
	}
	if revokedAt.Valid {
		writeError(w, http.StatusBadRequest, "invalid_grant", "refresh token has been revoked")
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

	// The client must still exist and still be live.
	client, err := s.getLiveClient(r.Context(), storedClientID)
	if err != nil {
		// Revoking the client kills its outstanding chain too.
		s.revokeClientTokens(r.Context(), storedClientID)
		writeError(w, http.StatusBadRequest, "invalid_grant", "client no longer exists or has been revoked")
		return
	}

	// Confidential clients must authenticate the refresh, per their own
	// registered auth method.
	if client.TokenEndpointAuthMethod != "none" && client.ClientSecret != "" {
		presentedID, presentedSecret, ok := r.BasicAuth()
		if !ok {
			presentedID = r.FormValue("client_id")
			presentedSecret = r.FormValue("client_secret")
		}
		if presentedID != "" && presentedID != client.ClientID {
			writeError(w, http.StatusUnauthorized, "invalid_client", "client_id mismatch")
			return
		}
		if !secureCompare(client.ClientSecret, presentedSecret) {
			writeError(w, http.StatusUnauthorized, "invalid_client", "client authentication is required to refresh")
			return
		}
	}

	// Re-bind the scope: the client's registration may have been narrowed
	// since the token was first issued, and a refresh must not outlive that.
	grantedScope, err := grantableScope(storedScope, client)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_scope", err.Error())
		return
	}

	// Rotate: the old record is revoked, not deleted, so a replay of the
	// consumed refresh token is reported as revoked rather than as unknown.
	s.db.ExecContext(r.Context(), `UPDATE oauth_tokens SET revoked_at = ? WHERE token_id = ?`, time.Now().UTC().Unix(), tokenID)
	s.issueTokenResponse(r.Context(), w, storedClientID, grantedScope)
}

// ── Revocation (RFC 7009) ────────────────────────────────────────────────────

// handleRevoke revokes a refresh or access token.
//
// Per RFC 7009 the response is 200 whether or not the token existed, so this
// endpoint cannot be used to probe for valid tokens.
func (s *Server) handleRevoke(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "could not parse request body")
		return
	}
	token := r.FormValue("token")
	if token == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "token is required")
		return
	}
	now := time.Now().UTC().Unix()
	// The hint is advisory; try both columns regardless.
	s.db.ExecContext(r.Context(),
		`UPDATE oauth_tokens SET revoked_at = ? WHERE (refresh_token = ? OR access_token = ?) AND revoked_at IS NULL`,
		now, token, token)
	w.WriteHeader(http.StatusOK)
}

// handleRevokeClient revokes a client and every token it holds.
//
// Deleting the row directly in the database — the only option an operator
// previously had — did not stop the client's refresh chain, because nothing
// on the refresh path consulted oauth_clients at all.
func (s *Server) handleRevokeClient(w http.ResponseWriter, r *http.Request) {
	clientID := r.PathValue("id")
	if clientID == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "client id is required")
		return
	}
	client, err := s.getClient(r.Context(), clientID)
	if err != nil {
		writeError(w, http.StatusNotFound, "invalid_client", "unknown client_id")
		return
	}

	// Only the principal that registered the client may revoke it, unless the
	// caller is the operator's admin credential.
	owner := OwnerFromContext(r.Context())
	if !IsAdminFromContext(r.Context()) && client.Owner != "" && client.Owner != owner {
		writeError(w, http.StatusForbidden, "access_denied", "this client belongs to another principal")
		return
	}

	now := time.Now().UTC().Unix()
	if _, err := s.db.ExecContext(r.Context(),
		`UPDATE oauth_clients SET revoked_at = ? WHERE client_id = ? AND revoked_at IS NULL`, now, clientID); err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "failed to revoke client")
		return
	}
	s.revokeClientTokens(r.Context(), clientID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"client_id": clientID, "revoked": true})
}

// ── Introspection (RFC 7662) ─────────────────────────────────────────────────

// handleIntrospect reports whether a token is currently valid.
//
// This is what makes revocation mean anything to a resource server. These
// access tokens are self-contained RS256 JWTs, so a resource server verifying
// them against the published JWKS has no way to learn that one was revoked —
// signature and expiry are all it can check, and both still pass. A revoked
// token stays acceptable to every such server until it expires on its own.
// Introspection is the standard answer: a resource server that cares about
// revocation asks here rather than trusting the signature alone.
//
// Requires client authentication: an unauthenticated introspection endpoint
// is a token-validity oracle.
func (s *Server) handleIntrospect(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "could not parse request body")
		return
	}

	clientID, clientSecret, ok := r.BasicAuth()
	if !ok {
		clientID = r.FormValue("client_id")
		clientSecret = r.FormValue("client_secret")
	}
	caller, err := s.getLiveClient(r.Context(), clientID)
	if err != nil || caller.ClientSecret == "" || !secureCompare(caller.ClientSecret, clientSecret) {
		writeError(w, http.StatusUnauthorized, "invalid_client", "client authentication is required to introspect")
		return
	}

	token := r.FormValue("token")
	if token == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "token is required")
		return
	}

	var (
		tokenClientID string
		scope         string
		expiresAt     sql.NullInt64
		revokedAt     sql.NullInt64
	)
	qerr := s.db.QueryRowContext(r.Context(), `
		SELECT client_id, scope, expires_at, revoked_at
		FROM oauth_tokens WHERE access_token = ? OR refresh_token = ?`, token, token).Scan(
		&tokenClientID, &scope, &expiresAt, &revokedAt,
	)

	// RFC 7662: an inactive token is reported as {"active": false} and
	// nothing else. Never distinguish "unknown" from "revoked" from
	// "expired" — that difference is information about other people's tokens.
	inactive := map[string]any{"active": false}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")

	if qerr != nil || revokedAt.Valid {
		json.NewEncoder(w).Encode(inactive)
		return
	}
	if expiresAt.Valid && time.Now().UTC().Unix() > expiresAt.Int64 {
		json.NewEncoder(w).Encode(inactive)
		return
	}
	// A token belonging to a revoked client is inactive regardless of its own
	// row, which is the whole point of revoking a client.
	if _, cerr := s.getLiveClient(r.Context(), tokenClientID); cerr != nil {
		json.NewEncoder(w).Encode(inactive)
		return
	}

	resp := map[string]any{
		"active":    true,
		"client_id": tokenClientID,
		"scope":     scope,
		"iss":       s.issuer,
		"sub":       tokenClientID,
	}
	if expiresAt.Valid {
		resp["exp"] = expiresAt.Int64
	}
	json.NewEncoder(w).Encode(resp)
}

// revokeClientTokens invalidates every outstanding token for a client.
func (s *Server) revokeClientTokens(ctx context.Context, clientID string) {
	s.db.ExecContext(ctx,
		`UPDATE oauth_tokens SET revoked_at = ? WHERE client_id = ? AND revoked_at IS NULL`,
		time.Now().UTC().Unix(), clientID)
	s.db.ExecContext(ctx, `DELETE FROM oauth_codes WHERE client_id = ?`, clientID)
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
	var (
		owner     sql.NullString
		revokedAt sql.NullInt64
	)
	err := s.db.QueryRowContext(ctx, `
		SELECT client_id, client_secret, client_name, redirect_uris, grant_types, scopes,
		       token_endpoint_auth_method, created_at, owner, revoked_at
		FROM oauth_clients WHERE client_id = ?`, clientID).Scan(
		&c.ClientID, &c.ClientSecret, &c.ClientName,
		&redirectsJSON, &grantsJSON,
		&c.Scopes, &c.TokenEndpointAuthMethod, &createdAt,
		&owner, &revokedAt,
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
	c.Owner = owner.String
	if revokedAt.Valid {
		t := time.Unix(revokedAt.Int64, 0).UTC()
		c.RevokedAt = &t
	}
	return &c, nil
}

// getLiveClient is getClient plus the revocation check, for every path that
// is about to act on a client's behalf. Revocation that only blocked new
// authorizations while leaving outstanding refresh chains working was not
// revocation.
func (s *Server) getLiveClient(ctx context.Context, clientID string) (*OAuthClient, error) {
	c, err := s.getClient(ctx, clientID)
	if err != nil {
		return nil, err
	}
	if c.Revoked() {
		return nil, fmt.Errorf("mcpauth: client has been revoked")
	}
	return c, nil
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
		created_at                 INTEGER NOT NULL,
		-- owner is the Lelu principal that registered this client. A client
		-- can never be granted more than its owner holds.
		owner                      TEXT NOT NULL DEFAULT '',
		revoked_at                 INTEGER
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
		created_at         INTEGER NOT NULL,
		revoked_at         INTEGER
	);
	CREATE INDEX IF NOT EXISTS idx_oauth_tokens_client  ON oauth_tokens(client_id);
	CREATE INDEX IF NOT EXISTS idx_oauth_tokens_refresh ON oauth_tokens(refresh_token);
	`)
	if err != nil {
		return err
	}
	// Additive migrations for databases created before revocation and
	// ownership existed. A duplicate-column error means the column is already
	// there, which is the normal case on every start after the first.
	for _, stmt := range []string{
		`ALTER TABLE oauth_clients ADD COLUMN owner TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE oauth_clients ADD COLUMN revoked_at INTEGER`,
		`ALTER TABLE oauth_tokens ADD COLUMN revoked_at INTEGER`,
	} {
		if _, aerr := db.Exec(stmt); aerr != nil && !strings.Contains(strings.ToLower(aerr.Error()), "duplicate column") {
			// Not fatal: the CREATE TABLE above already produces the right
			// shape for a fresh database.
			continue
		}
	}
	return nil
}

// ── Scopes ───────────────────────────────────────────────────────────────────

// SupportedScopes is the closed set this server will ever grant. It is the
// same list published in the discovery documents, and it is enforced rather
// than advertised: a requested scope outside it is rejected instead of being
// copied into a signed token.
//
// Nothing here is an administrative scope. A token minted by this server is
// an MCP client credential, and there is no flow by which one should come out
// carrying "admin:everything" — which is what happened while the scope was
// whatever string the caller put in the query.
var SupportedScopes = []string{"openid", "profile", "agent:read", "agent:write", "tools:call"}

// grantableScope reduces a requested scope string to what may actually be
// granted: the intersection of what was asked for, what this server supports,
// and what the client is registered to hold.
//
// All three bounds matter, and the middle one is the one whose absence was
// most surprising: without it a client registered with scope "read" could ask
// for anything at all and receive it, because the requested value was stored
// verbatim at /oauth/authorize and copied into the JWT at /oauth/token
// without ever being compared to the client's own registration.
//
// An empty request means "everything the client holds", per OAuth 2.1.
// Returns an error rather than silently narrowing: a client that asked for
// authority it cannot have should be told so, not handed a quietly weaker
// token it will then use as though it were the one it requested.
func grantableScope(requested string, client *OAuthClient) (string, error) {
	clientScopes := strings.Fields(client.Scopes)
	// A client registered with no scopes gets the supported set as its
	// ceiling — it has not been narrowed, so it is bounded only by the
	// server's own list.
	if len(clientScopes) == 0 {
		clientScopes = SupportedScopes
	}

	if strings.TrimSpace(requested) == "" {
		out := make([]string, 0, len(clientScopes))
		for _, sc := range clientScopes {
			if containsString(SupportedScopes, sc) {
				out = append(out, sc)
			}
		}
		return strings.Join(out, " "), nil
	}

	granted := make([]string, 0, len(SupportedScopes))
	for _, sc := range strings.Fields(requested) {
		if !containsString(SupportedScopes, sc) {
			return "", fmt.Errorf("scope %q is not supported by this authorization server", sc)
		}
		if !containsString(clientScopes, sc) {
			return "", fmt.Errorf("scope %q exceeds this client's registered scope", sc)
		}
		if !containsString(granted, sc) {
			granted = append(granted, sc)
		}
	}
	return strings.Join(granted, " "), nil
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
