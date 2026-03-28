// Package middleware provides HTTP middleware for the Lelu engine
package middleware

import (
	"context"
	"log"
	"net/http"
	"strings"

	"github.com/lelu/engine/internal/apikeys"
)

type contextKey string

const (
	// ContextKeyTenantID is the context key for tenant ID
	ContextKeyTenantID contextKey = "tenant_id"
	// ContextKeyAPIKey is the context key for the API key
	ContextKeyAPIKey contextKey = "api_key"
)

// AuthMiddleware validates API keys and injects tenant_id into request context
type AuthMiddleware struct {
	apiKeySvc   *apikeys.Service
	requireAuth bool
	publicPaths map[string]bool
}

// AuthConfig configures the authentication middleware
type AuthConfig struct {
	APIKeyService *apikeys.Service
	RequireAuth   bool     // If true, all requests must have valid API key
	PublicPaths   []string // Paths that don't require authentication
}

// NewAuthMiddleware creates a new authentication middleware
func NewAuthMiddleware(cfg AuthConfig) *AuthMiddleware {
	publicPaths := make(map[string]bool)
	for _, path := range cfg.PublicPaths {
		publicPaths[path] = true
	}

	// Always allow health check and metrics
	publicPaths["/healthz"] = true
	publicPaths["/metrics"] = true

	return &AuthMiddleware{
		apiKeySvc:   cfg.APIKeyService,
		requireAuth: cfg.RequireAuth,
		publicPaths: publicPaths,
	}
}

// Middleware returns an HTTP middleware function
func (m *AuthMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if path is public
		if m.publicPaths[r.URL.Path] {
			next.ServeHTTP(w, r)
			return
		}

		// Extract API key from Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			if m.requireAuth {
				writeJSONError(w, http.StatusUnauthorized, "missing authorization header")
				return
			}
			// No auth required, continue without tenant_id
			next.ServeHTTP(w, r)
			return
		}

		// Parse Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			writeJSONError(w, http.StatusUnauthorized, "invalid authorization header format")
			return
		}

		apiKey := parts[1]

		// Validate API key format
		if !apikeys.IsValidKeyFormat(apiKey) {
			writeJSONError(w, http.StatusUnauthorized, "invalid API key format")
			return
		}

		// Get client IP for anonymous key binding
		clientIP := getClientIP(r)

		// For anonymous keys, bind to IP on first use
		if apikeys.IsAnonymousKey(apiKey) {
			if err := m.apiKeySvc.BindIPToKey(r.Context(), apiKey, clientIP); err != nil {
				log.Printf("IP binding failed for anonymous key: %v", err)
				writeJSONError(w, http.StatusForbidden, "key is bound to a different IP address")
				return
			}
		}

		// Validate API key and get tenant_id
		tenantID, err := m.apiKeySvc.ValidateKey(r.Context(), apiKey)
		if err != nil {
			switch err {
			case apikeys.ErrKeyNotFound:
				writeJSONError(w, http.StatusUnauthorized, "invalid API key")
			case apikeys.ErrKeyRevoked:
				writeJSONError(w, http.StatusUnauthorized, "API key has been revoked")
			case apikeys.ErrKeyExpired:
				writeJSONError(w, http.StatusUnauthorized, "API key has expired")
			default:
				log.Printf("API key validation error: %v", err)
				writeJSONError(w, http.StatusInternalServerError, "authentication failed")
			}
			return
		}

		// Inject tenant_id, api_key, and client_ip into context
		ctx := context.WithValue(r.Context(), ContextKeyTenantID, tenantID)
		ctx = context.WithValue(ctx, ContextKeyAPIKey, apiKey)
		ctx = context.WithValue(ctx, ContextKeyClientIP, clientIP)

		// Continue with enriched context
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetTenantID extracts the tenant ID from the request context
func GetTenantID(ctx context.Context) string {
	if tenantID, ok := ctx.Value(ContextKeyTenantID).(string); ok {
		return tenantID
	}
	return ""
}

// GetAPIKey extracts the API key from the request context
func GetAPIKey(ctx context.Context) string {
	if apiKey, ok := ctx.Value(ContextKeyAPIKey).(string); ok {
		return apiKey
	}
	return ""
}

// writeJSONError writes a JSON error response
func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"error":"` + message + `"}`))
}

const (
	// ContextKeyClientIP is the context key for client IP
	ContextKeyClientIP contextKey = "client_ip"
)

// GetClientIP extracts the client IP from the request context
func GetClientIP(ctx context.Context) string {
	if clientIP, ok := ctx.Value(ContextKeyClientIP).(string); ok {
		return clientIP
	}
	return ""
}

// getClientIP extracts the real client IP from request headers
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (most common)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP in the list
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Check CF-Connecting-IP (Cloudflare)
	if cfip := r.Header.Get("CF-Connecting-IP"); cfip != "" {
		return cfip
	}

	// Fallback to RemoteAddr
	ip := r.RemoteAddr
	// Remove port if present
	if idx := strings.LastIndex(ip, ":"); idx != -1 {
		ip = ip[:idx]
	}

	return ip
}
