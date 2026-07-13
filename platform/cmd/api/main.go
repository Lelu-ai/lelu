// Lelu Platform — Cloud Control Plane entrypoint.
//
// Environment variables:
//
//	LISTEN_ADDR        HTTP listen address (default: :9090)
//	DATABASE_URL       Postgres DSN (required)
//	PLATFORM_API_KEY   API key for engine → platform authentication
//	OIDC_ISSUER_URL    OIDC issuer URL for enterprise SSO (optional)
//	OIDC_AUDIENCE      OIDC audience/client ID (optional)
//	SSO_TRUSTED_HEADER Trusted upstream identity header (optional)
//	SSO_TRUSTED_EMAIL_DOMAIN Optional email-domain restriction for trusted header mode
//	EVIDENCE_SIGNING_KEY Optional HMAC key used to sign compliance export evidence payloads
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/lelu/platform/internal/audit"
	"github.com/lelu/platform/internal/db"
	"github.com/lelu/platform/internal/handlers"
	"github.com/lelu/platform/internal/policy"
)

func main() {
	addr := envOr("LISTEN_ADDR", ":9090")
	dsn := envOr("DATABASE_URL", "postgres://lelu:lelu@localhost:5432/lelu?sslmode=disable")
	apiKey := envOr("PLATFORM_API_KEY", "change-me-in-production")
	oidcIssuer := envOr("OIDC_ISSUER_URL", "")
	oidcAudience := envOr("OIDC_AUDIENCE", "")
	trustedSSOHeader := envOr("SSO_TRUSTED_HEADER", "")
	trustedSSODomain := envOr("SSO_TRUSTED_EMAIL_DOMAIN", "")
	evidenceSigningKey := envOr("EVIDENCE_SIGNING_KEY", "")
	if isProductionEnv() && (apiKey == "" || apiKey == "change-me-in-production") {
		log.Fatal("PLATFORM_API_KEY must be explicitly set to a strong secret in production")
	}

	// ── Database ──────────────────────────────────────────────────────────────
	database, err := db.Open(dsn)
	if err != nil {
		log.Fatalf("platform: db connect: %v", err)
	}
	defer database.Close()

	if err := db.Migrate(database); err != nil {
		log.Fatalf("platform: migrate: %v", err)
	}
	log.Println("platform: database migrations applied")

	// ── Stores ────────────────────────────────────────────────────────────────
	policyStore := policy.New(database, apiKey)
	auditStore := audit.New(database)

	// ── HTTP server ───────────────────────────────────────────────────────────
	mux := http.NewServeMux()
	var oidcAuth *handlers.OIDCAuth
	if oidcIssuer != "" && oidcAudience != "" {
		auth, authErr := handlers.NewOIDCAuth(context.Background(), oidcIssuer, oidcAudience)
		if authErr != nil {
			log.Fatalf("platform: oidc init: %v", authErr)
		}
		oidcAuth = auth
		log.Printf("platform: oidc enabled (issuer=%s)", oidcIssuer)
	}
	if trustedSSOHeader != "" {
		if trustedSSODomain != "" {
			log.Printf("platform: trusted SSO header enabled (%s, domain=%s)", trustedSSOHeader, trustedSSODomain)
		} else {
			log.Printf("platform: trusted SSO header enabled (%s)", trustedSSOHeader)
		}
	}
	h := handlers.New(policyStore, auditStore, apiKey, oidcAuth, trustedSSOHeader, trustedSSODomain, evidenceSigningKey)
	h.RegisterRoutes(mux)

	srv := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("platform: listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("platform: server: %v", err)
		}
	}()

	// ── Graceful shutdown ─────────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("platform: shutting down…")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("platform: forced shutdown: %v", err)
	}
	log.Println("platform: bye")
}

func envOr(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}

func isProductionEnv() bool {
	v := envOr("APP_ENV", envOr("ENV", ""))
	switch v {
	case "prod", "production":
		return true
	default:
		return false
	}
}
