// Package identity implements durable agent identity registration and
// OIDC-compatible JWT issuance for the Lelu authorization engine.
//
// Every registered agent gets a stable UUID that persists across deployments
// and API key rotations. Lelu issues RS256-signed JWTs (OIDC-compatible) for
// registered agents — third-party services can verify them via the JWKS
// endpoint without calling Lelu at runtime.
package identity

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"database/sql"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// AgentType classifies the operational model of an agent.
type AgentType string

const (
	AgentTypeAutonomous AgentType = "autonomous"
	AgentTypeAssistant  AgentType = "assistant"
	AgentTypeWorkflow   AgentType = "workflow"
)

// AgentStatus reflects the lifecycle state of a registered agent.
type AgentStatus string

const (
	AgentStatusActive    AgentStatus = "active"
	AgentStatusSuspended AgentStatus = "suspended"
	AgentStatusRevoked   AgentStatus = "revoked"
)

// RegisteredAgent is the domain object for a persistent agent identity.
type RegisteredAgent struct {
	ID          string
	TenantID    string
	Name        string
	Description string
	AgentType   AgentType
	OwnerEmail  string
	Status      AgentStatus
	Scopes      []string
	Metadata    map[string]any
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// RegisterRequest is the input to Register().
type RegisterRequest struct {
	TenantID    string
	Name        string
	Description string
	AgentType   AgentType
	OwnerEmail  string
	Scopes      []string
	Metadata    map[string]any
}

// WorkloadToken is the output of IssueToken().
type WorkloadToken struct {
	Token     string    `json:"token"`
	AgentID   string    `json:"agent_id"`
	Scopes    []string  `json:"scopes"`
	ExpiresAt time.Time `json:"expires_at"`
	IssuedAt  time.Time `json:"issued_at"`
}

// Registry stores and manages registered agent identities.
type Registry struct {
	db         *sql.DB
	signingKey *rsa.PrivateKey
	issuer     string
	tokenTTL   time.Duration
	keyID      string
}

// Config for Registry.
type Config struct {
	DB *sql.DB
	// SigningKey is used for RS256 token issuance. Generated (2048-bit) if nil.
	SigningKey *rsa.PrivateKey
	// Issuer is the OIDC issuer URL (e.g. "https://lelu-ai.com").
	Issuer string
	// TokenTTL is the lifetime of issued workload tokens. Default 1 hour.
	TokenTTL time.Duration
}

// New creates a Registry. A fresh RSA-2048 key is generated if cfg.SigningKey
// is nil — note that this means tokens issued before and after a restart will
// not share the same key unless the key is persisted externally.
func New(cfg Config) (*Registry, error) {
	if cfg.DB == nil {
		return nil, fmt.Errorf("identity: DB is required")
	}
	if cfg.Issuer == "" {
		cfg.Issuer = "https://lelu-ai.com"
	}
	if cfg.TokenTTL == 0 {
		cfg.TokenTTL = time.Hour
	}

	key := cfg.SigningKey
	if key == nil {
		var err error
		key, err = rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			return nil, fmt.Errorf("identity: generate RSA-2048 key: %w", err)
		}
	}

	// Derive key ID from the DER-encoded public key fingerprint.
	der, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		return nil, fmt.Errorf("identity: marshal public key: %w", err)
	}
	sum := sha256.Sum256(der)
	kid := base64.RawURLEncoding.EncodeToString(sum[:8])

	if err := initSchema(cfg.DB); err != nil {
		return nil, fmt.Errorf("identity: init schema: %w", err)
	}

	return &Registry{
		db:         cfg.DB,
		signingKey: key,
		issuer:     cfg.Issuer,
		tokenTTL:   cfg.TokenTTL,
		keyID:      kid,
	}, nil
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

// Register creates and persists a new agent identity.
func (r *Registry) Register(ctx context.Context, req RegisterRequest) (*RegisteredAgent, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("identity: name is required")
	}
	if req.AgentType == "" {
		req.AgentType = AgentTypeAutonomous
	}
	if req.TenantID == "" {
		req.TenantID = "default"
	}
	if req.Scopes == nil {
		req.Scopes = []string{}
	}
	if req.Metadata == nil {
		req.Metadata = map[string]any{}
	}

	id := uuid.NewString()
	now := time.Now().UTC()

	scopesJSON, _ := json.Marshal(req.Scopes)
	metaJSON, _ := json.Marshal(req.Metadata)

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO registered_agents
		  (id, tenant_id, name, description, agent_type, owner_email, status, scopes, metadata, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
		id, req.TenantID, req.Name, req.Description,
		string(req.AgentType), req.OwnerEmail,
		string(scopesJSON), string(metaJSON),
		now.Unix(), now.Unix(),
	)
	if err != nil {
		return nil, fmt.Errorf("identity: register agent: %w", err)
	}

	return &RegisteredAgent{
		ID:          id,
		TenantID:    req.TenantID,
		Name:        req.Name,
		Description: req.Description,
		AgentType:   req.AgentType,
		OwnerEmail:  req.OwnerEmail,
		Status:      AgentStatusActive,
		Scopes:      req.Scopes,
		Metadata:    req.Metadata,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

// Get returns a registered agent by its stable ID.
func (r *Registry) Get(ctx context.Context, agentID string) (*RegisteredAgent, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, name, description, agent_type, owner_email, status, scopes, metadata, created_at, updated_at
		FROM registered_agents WHERE id = ?`, agentID)
	return scanAgent(row)
}

// List returns all agents for a tenant. Pass "" to list across all tenants.
func (r *Registry) List(ctx context.Context, tenantID string) ([]*RegisteredAgent, error) {
	var (
		rows *sql.Rows
		err  error
	)
	if tenantID == "" {
		rows, err = r.db.QueryContext(ctx, `
			SELECT id, tenant_id, name, description, agent_type, owner_email, status, scopes, metadata, created_at, updated_at
			FROM registered_agents ORDER BY created_at DESC`)
	} else {
		rows, err = r.db.QueryContext(ctx, `
			SELECT id, tenant_id, name, description, agent_type, owner_email, status, scopes, metadata, created_at, updated_at
			FROM registered_agents WHERE tenant_id = ? ORDER BY created_at DESC`, tenantID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var agents []*RegisteredAgent
	for rows.Next() {
		a, err := scanAgent(rows)
		if err != nil {
			return nil, err
		}
		agents = append(agents, a)
	}
	return agents, rows.Err()
}

// SetStatus changes an agent's lifecycle state.
func (r *Registry) SetStatus(ctx context.Context, agentID string, status AgentStatus) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE registered_agents SET status = ?, updated_at = ? WHERE id = ?`,
		string(status), time.Now().UTC().Unix(), agentID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("identity: agent %q not found", agentID)
	}
	return nil
}

// ── Token issuance ────────────────────────────────────────────────────────────

// IssueToken mints a short-lived OIDC-compatible RS256 JWT for a registered agent.
// The token carries lelu_agent_id, lelu_tenant_id, and the agent's scopes,
// and can be verified offline by any party with access to the JWKS endpoint.
func (r *Registry) IssueToken(ctx context.Context, agentID string) (*WorkloadToken, error) {
	agent, err := r.Get(ctx, agentID)
	if err != nil {
		return nil, err
	}
	if agent.Status != AgentStatusActive {
		return nil, fmt.Errorf("identity: agent %q is %s — cannot issue token", agentID, agent.Status)
	}

	now := time.Now().UTC()
	exp := now.Add(r.tokenTTL)

	claims := jwt.MapClaims{
		"iss":             r.issuer,
		"sub":             "agent:" + agentID,
		"aud":             []string{"lelu", "mcp"},
		"iat":             jwt.NewNumericDate(now),
		"exp":             jwt.NewNumericDate(exp),
		"jti":             uuid.NewString(),
		"scope":           strings.Join(agent.Scopes, " "),
		"lelu_agent_id":   agentID,
		"lelu_tenant_id":  agent.TenantID,
		"lelu_agent_name": agent.Name,
		"lelu_agent_type": string(agent.AgentType),
	}

	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = r.keyID

	signed, err := tok.SignedString(r.signingKey)
	if err != nil {
		return nil, fmt.Errorf("identity: sign token: %w", err)
	}

	return &WorkloadToken{
		Token:     signed,
		AgentID:   agentID,
		Scopes:    agent.Scopes,
		ExpiresAt: exp,
		IssuedAt:  now,
	}, nil
}

// VerifiedAgent is the output of VerifyToken() — the caller-independent facts
// about who made the request, derived entirely from a signature this package
// controls rather than from anything the caller merely claimed.
type VerifiedAgent struct {
	AgentID  string
	TenantID string
	Scopes   []string
}

// VerifyToken checks a WorkloadToken's signature, expiry, and issuer/audience
// against this registry's own key, then confirms the agent it names is still
// active. The active-status check is what makes SetStatus(..., Revoked)
// actually revoke access before expiry — signature and exp alone can't do
// that, since a revoked agent's already-issued JWT still verifies fine right
// up to the moment it expires.
func (r *Registry) VerifyToken(ctx context.Context, raw string) (*VerifiedAgent, error) {
	var claims jwt.MapClaims
	_, err := jwt.ParseWithClaims(raw, &claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return &r.signingKey.PublicKey, nil
	}, jwt.WithIssuer(r.issuer), jwt.WithAudience("lelu"))
	if err != nil {
		return nil, fmt.Errorf("identity: verify token: %w", err)
	}

	agentID, _ := claims["lelu_agent_id"].(string)
	if agentID == "" {
		return nil, fmt.Errorf("identity: token missing lelu_agent_id claim")
	}

	agent, err := r.Get(ctx, agentID)
	if err != nil {
		return nil, fmt.Errorf("identity: verify token: %w", err)
	}
	if agent.Status != AgentStatusActive {
		return nil, fmt.Errorf("identity: agent %q is %s", agentID, agent.Status)
	}

	var scopes []string
	if s, _ := claims["scope"].(string); s != "" {
		scopes = strings.Split(s, " ")
	}

	return &VerifiedAgent{AgentID: agentID, TenantID: agent.TenantID, Scopes: scopes}, nil
}

// ── OIDC / JWKS ───────────────────────────────────────────────────────────────

// JWKSResponse returns the JSON Web Key Set (RFC 7517) for this registry's
// signing key. Expose at /.well-known/jwks.json.
func (r *Registry) JWKSResponse() map[string]any {
	pub := &r.signingKey.PublicKey
	return map[string]any{
		"keys": []map[string]any{
			{
				"kty": "RSA",
				"use": "sig",
				"alg": "RS256",
				"kid": r.keyID,
				"n":   base64.RawURLEncoding.EncodeToString(pub.N.Bytes()),
				"e":   base64.RawURLEncoding.EncodeToString(encodeExponent(pub.E)),
			},
		},
	}
}

// OIDCDiscovery returns the OpenID Connect Provider Metadata (RFC 8414 + OIDC Core).
// Expose at /.well-known/openid-configuration.
func (r *Registry) OIDCDiscovery() map[string]any {
	return map[string]any{
		"issuer":                                r.issuer,
		"jwks_uri":                              r.issuer + "/.well-known/jwks.json",
		"token_endpoint":                        r.issuer + "/oauth/token",
		"authorization_endpoint":                r.issuer + "/oauth/authorize",
		"registration_endpoint":                 r.issuer + "/oauth/clients",
		"response_types_supported":              []string{"code"},
		"grant_types_supported":                 []string{"authorization_code", "client_credentials", "refresh_token"},
		"subject_types_supported":               []string{"public"},
		"id_token_signing_alg_values_supported": []string{"RS256"},
		"token_endpoint_auth_methods_supported": []string{"client_secret_basic", "client_secret_post", "none"},
		"code_challenge_methods_supported":      []string{"S256"},
		"scopes_supported":                      []string{"openid", "profile", "agent:read", "agent:write", "tools:call"},
	}
}

// MCPAuthServerMetadata returns OAuth 2.0 Authorization Server Metadata (RFC 8414).
// Expose at /.well-known/oauth-authorization-server.
func (r *Registry) MCPAuthServerMetadata() map[string]any {
	return map[string]any{
		"issuer":                                r.issuer,
		"authorization_endpoint":                r.issuer + "/oauth/authorize",
		"token_endpoint":                        r.issuer + "/oauth/token",
		"registration_endpoint":                 r.issuer + "/oauth/clients",
		"jwks_uri":                              r.issuer + "/.well-known/jwks.json",
		"scopes_supported":                      []string{"openid", "profile", "agent:read", "agent:write", "tools:call"},
		"response_types_supported":              []string{"code"},
		"grant_types_supported":                 []string{"authorization_code", "client_credentials", "refresh_token"},
		"token_endpoint_auth_methods_supported": []string{"client_secret_basic", "client_secret_post", "none"},
		"code_challenge_methods_supported":      []string{"S256"},
		"service_documentation":                 "https://lelu-ai.com/docs",
	}
}

// MCPProtectedResourceMetadata returns OAuth 2.0 Protected Resource Metadata (RFC 9728).
// Expose at /.well-known/oauth-protected-resource.
func (r *Registry) MCPProtectedResourceMetadata() map[string]any {
	return map[string]any{
		"resource":                 r.issuer,
		"authorization_servers":    []string{r.issuer},
		"jwks_uri":                 r.issuer + "/.well-known/jwks.json",
		"scopes_supported":         []string{"openid", "profile", "agent:read", "agent:write", "tools:call"},
		"bearer_methods_supported": []string{"header"},
	}
}

// Issuer returns the configured OIDC issuer URL.
func (r *Registry) Issuer() string { return r.issuer }

// SigningKey returns the RSA private key (for use by the MCP OAuth server).
func (r *Registry) SigningKey() *rsa.PrivateKey { return r.signingKey }

// KeyID returns the key ID used in JWT headers and JWKS.
func (r *Registry) KeyID() string { return r.keyID }

// TokenTTL returns the configured workload token TTL.
func (r *Registry) TokenTTL() time.Duration { return r.tokenTTL }

// ── helpers ───────────────────────────────────────────────────────────────────

type scanner interface {
	Scan(dest ...any) error
}

func scanAgent(s scanner) (*RegisteredAgent, error) {
	var (
		a         RegisteredAgent
		scopesRaw string
		metaRaw   string
		createdAt int64
		updatedAt int64
		agentType string
		status    string
	)
	if err := s.Scan(
		&a.ID, &a.TenantID, &a.Name, &a.Description,
		&agentType, &a.OwnerEmail, &status,
		&scopesRaw, &metaRaw, &createdAt, &updatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("identity: agent not found")
		}
		return nil, err
	}
	a.AgentType = AgentType(agentType)
	a.Status = AgentStatus(status)
	a.CreatedAt = time.Unix(createdAt, 0).UTC()
	a.UpdatedAt = time.Unix(updatedAt, 0).UTC()
	_ = json.Unmarshal([]byte(scopesRaw), &a.Scopes)
	_ = json.Unmarshal([]byte(metaRaw), &a.Metadata)
	if a.Scopes == nil {
		a.Scopes = []string{}
	}
	if a.Metadata == nil {
		a.Metadata = map[string]any{}
	}
	return &a, nil
}

func initSchema(db *sql.DB) error {
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS registered_agents (
		id          TEXT PRIMARY KEY,
		tenant_id   TEXT NOT NULL DEFAULT 'default',
		name        TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		agent_type  TEXT NOT NULL DEFAULT 'autonomous',
		owner_email TEXT NOT NULL DEFAULT '',
		status      TEXT NOT NULL DEFAULT 'active',
		scopes      TEXT NOT NULL DEFAULT '[]',
		metadata    TEXT NOT NULL DEFAULT '{}',
		created_at  INTEGER NOT NULL,
		updated_at  INTEGER NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_reg_agents_tenant ON registered_agents(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_reg_agents_status ON registered_agents(status);
	`)
	return err
}

// encodeExponent converts an RSA public key exponent (int) to a big-endian
// byte slice with no leading zeros, as required by the JWKS "e" field.
func encodeExponent(e int) []byte {
	b := make([]byte, 4)
	binary.BigEndian.PutUint32(b, uint32(e))
	for len(b) > 1 && b[0] == 0 {
		b = b[1:]
	}
	return b
}
