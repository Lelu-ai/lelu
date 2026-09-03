package mcpauth

import "context"

// The OAuth endpoints run behind the engine's ordinary authentication
// middleware, which resolves a principal. This package cannot import the
// server package (server imports this one), so the middleware deposits the
// two facts these handlers need — who the caller is, and whether they hold
// the operator's admin credential — through this small context contract
// instead.
//
// This is what makes a registered client attributable. Without an owner, a
// client is an orphan: any credential holder can revoke any other's, and
// there is nothing to bound a granted scope against beyond the server's own
// supported list.

type ownerContextKey struct{}
type adminContextKey struct{}

// WithOwner records the principal registering or managing a client.
func WithOwner(ctx context.Context, owner string) context.Context {
	return context.WithValue(ctx, ownerContextKey{}, owner)
}

// WithAdmin records that the caller holds the operator's admin credential.
func WithAdmin(ctx context.Context, admin bool) context.Context {
	return context.WithValue(ctx, adminContextKey{}, admin)
}

// OwnerFromContext returns the principal, or "" when none was recorded.
func OwnerFromContext(ctx context.Context) string {
	owner, _ := ctx.Value(ownerContextKey{}).(string)
	return owner
}

// IsAdminFromContext reports whether the caller holds the admin credential.
func IsAdminFromContext(ctx context.Context) bool {
	admin, _ := ctx.Value(adminContextKey{}).(bool)
	return admin
}
