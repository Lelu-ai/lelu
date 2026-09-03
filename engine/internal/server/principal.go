package server

import (
	"context"

	"github.com/lelu-ai/lelu/engine/internal/mcpauth"
)

// Principal is the identity authMiddleware actually resolved for this
// request, set once a credential has verified — so handlers derive
// tenant/user scope from something the request can't just claim in its own
// body. Before this existed, authMiddleware verified a key was valid and
// then discarded who it belonged to; every handler downstream read
// tenant_id/user_id/actor straight from the body instead, so a valid key
// from any account could act as any tenant. See Nate Howard's review.
type Principal struct {
	// UserID is the account that owns the verified lelu_sk_ key. Empty when
	// IsStaticAdminKey is true — there's no per-account identity to resolve
	// for the single shared operator key.
	UserID string
	// IsStaticAdminKey is true when the request authenticated via the
	// operator-configured static API_KEY (self-hosted, single-tenant mode)
	// or the LELU_DEV_INSECURE bypass, rather than an account-bound
	// lelu_sk_ key. That credential is intentionally the engine's one admin
	// credential in that mode — see handlePolicyPut.
	IsStaticAdminKey bool
}

type principalContextKey struct{}

func withPrincipal(ctx context.Context, p Principal) context.Context {
	ctx = context.WithValue(ctx, principalContextKey{}, p)
	// The MCP OAuth server registers and revokes clients on behalf of
	// whoever is calling, and cannot import this package to ask. Hand it the
	// two facts it needs: an owner to attribute the client to, and whether
	// this caller is the operator.
	owner := p.UserID
	if owner == "" && p.IsStaticAdminKey {
		owner = "static-admin"
	}
	ctx = mcpauth.WithOwner(ctx, owner)
	return mcpauth.WithAdmin(ctx, p.IsStaticAdminKey)
}

// principalFromContext returns the request's resolved Principal. ok is
// false only when authMiddleware didn't run in front of this request (e.g.
// a handler invoked directly in a test, or a path exempted from auth
// entirely) — callers on an authenticated path can treat ok==false as "not
// authorized," not as "assume static-admin."
func principalFromContext(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(principalContextKey{}).(Principal)
	return p, ok
}

// principalMayActAs reports whether p is authorized to access or mutate
// resources scoped to userID — either because p IS that user (an
// account-bound key acting for itself), or because p holds the static
// admin credential (self-hosted, single operator, trusted for everything).
// Pulled out as its own function, independent of any handler, specifically
// so this decision has test coverage that doesn't require standing up a
// real vault/DB — see principal_test.go.
func principalMayActAs(p Principal, userID string) bool {
	return p.IsStaticAdminKey || p.UserID == userID
}

// rateLimitKey returns what a rate limiter should key this request on: the
// verified principal's UserID when one exists, since that's something the
// caller can't change from one request to the next — falling back to the
// caller-declared tenantID only when there's no verified per-account
// identity to prefer (the static admin credential, or a path auth hasn't
// been wired to). Keying on tenantID alone lets a caller reset their own
// limit just by relabeling which tenant they claim to be. See Nate Howard's
// review.
func rateLimitKey(ctx context.Context, tenantID string) string {
	if p, ok := principalFromContext(ctx); ok && !p.IsStaticAdminKey && p.UserID != "" {
		return p.UserID
	}
	return tenantID
}
