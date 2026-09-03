package main

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"database/sql"
	"encoding/pem"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	_ "github.com/mattn/go-sqlite3" // SQLite driver
	"github.com/redis/go-redis/v9"

	"github.com/lelu-ai/lelu/engine/internal/audit"
	"github.com/lelu-ai/lelu/engine/internal/confidence"
	"github.com/lelu-ai/lelu/engine/internal/evaluator"
	"github.com/lelu-ai/lelu/engine/internal/fallback"
	"github.com/lelu-ai/lelu/engine/internal/identity"
	"github.com/lelu-ai/lelu/engine/internal/incident"
	"github.com/lelu-ai/lelu/engine/internal/mcpauth"
	"github.com/lelu-ai/lelu/engine/internal/nhi"
	"github.com/lelu-ai/lelu/engine/internal/queue"
	"github.com/lelu-ai/lelu/engine/internal/ratelimit"
	"github.com/lelu-ai/lelu/engine/internal/server"
	syncer "github.com/lelu-ai/lelu/engine/internal/sync"
	"github.com/lelu-ai/lelu/engine/internal/telemetry"
	"github.com/lelu-ai/lelu/engine/internal/tokens"
	"github.com/lelu-ai/lelu/engine/internal/vault"
)

func main() {
	// ── Config from environment ──────────────────────────────────────────────
	addr := envOr("LISTEN_ADDR", ":8080")
	policyPath := envOr("POLICY_PATH", "/etc/lelu/auth.yaml")
	redisAddr := envOr("REDIS_ADDR", "")
	signingKey := envOr("JWT_SIGNING_KEY", "change-me-in-production")
	cpURL := envOr("CONTROL_PLANE_URL", "")
	cpHMACSecret := envOr("CP_HMAC_SECRET", "")
	regoPolicyPath := envOr("REGO_POLICY_PATH", "")
	regoPolicyQuery := envOr("REGO_POLICY_QUERY", "data.lelu.authz")
	apiKey := envOr("API_KEY", "")
	tenantID := envOr("TENANT_ID", "default")
	allowUnverifiedConfidence := envOr("CONFIDENCE_ALLOW_UNVERIFIED", "false") == "true"
	missingConfidenceMode := server.ParseMissingConfidenceMode(envOr("CONFIDENCE_MISSING_MODE", "deny"))
	enforcementMode := server.ParseEnforcementMode(envOr("LELU_MODE", "enforce"))
	incidentWebhookURL := envOr("INCIDENT_WEBHOOK_URL", "")
	incidentTimeoutMS := parseIntOr(envOr("INCIDENT_WEBHOOK_TIMEOUT_MS", "2000"), 2000)
	otelEnabled := envOr("OTEL_ENABLED", "false") == "true"
	otelEndpoint := envOr("OTEL_EXPORTER_OTLP_ENDPOINT", "localhost:4317")
	otelSampleRate := parseFloatOr(envOr("OTEL_SAMPLE_RATE", "1.0"), 1.0)

	// Feature 2: Durable Agent Identity + MCP OAuth 2.1
	//
	// The issuer is published verbatim in /.well-known/* as the
	// authorization_endpoint, registration_endpoint and jwks_uri. Defaulting
	// it to the hosted domain means every self-hosted instance hands RFC 8414
	// clients a document directing them to register clients and fetch signing
	// keys from lelu-ai.com instead of from the engine they discovered. The
	// default is now the engine's own public URL, and the hosted value is only
	// used when an operator sets it deliberately.
	leluIssuer := envOr("LELU_ISSUER", envOr("LELU_ENGINE_PUBLIC_URL", ""))
	if leluIssuer == "" {
		leluIssuer = "http://localhost" + addr
		log.Printf("warning: neither LELU_ISSUER nor LELU_ENGINE_PUBLIC_URL is set — publishing discovery metadata as %s, which is almost certainly not reachable by your clients", leluIssuer)
	}
	rsaKeyPath := envOr("LELU_RSA_KEY_PATH", "/var/lib/lelu/signing.key.pem")

	// Phase 2: Behavioral Analytics Database
	dbPath := envOr("DATABASE_PATH", "/var/lib/lelu/lelu.db")
	behavioralAnalyticsEnabled := envOr("BEHAVIORAL_ANALYTICS_ENABLED", "true") == "true"

	if isProductionEnv() {
		if signingKey == "" || signingKey == "change-me-in-production" {
			log.Fatal("JWT_SIGNING_KEY must be explicitly set to a strong secret in production")
		}
		if apiKey == "change-me-in-production" {
			log.Fatal("API_KEY must be explicitly set in production")
		}
		// Either a static API_KEY or platform key verification (PLATFORM_URL,
		// which lets the engine accept account-bound lelu_sk_ keys) must be
		// configured — otherwise no caller could ever authenticate.
		if apiKey == "" && envOr("PLATFORM_URL", "") == "" {
			log.Fatal("API_KEY or PLATFORM_URL must be explicitly set in production")
		}
	}

	// ── Bootstrap components ─────────────────────────────────────────────────
	eval := evaluator.New()
	if _, err := os.Stat(policyPath); err == nil {
		if err := eval.LoadPolicy(policyPath); err != nil {
			log.Fatalf("failed to load policy from %s: %v", policyPath, err)
		}
		log.Printf("policy loaded from %s", policyPath)
	} else {
		log.Printf("no policy file at %s — starting with empty policy", policyPath)
	}

	if regoPolicyPath != "" {
		if err := eval.LoadRegoPolicy(regoPolicyPath, regoPolicyQuery); err != nil {
			log.Fatalf("failed to load rego policy from %s: %v", regoPolicyPath, err)
		}
		log.Printf("rego policy loaded from %s (query: %s)", regoPolicyPath, regoPolicyQuery)
	}

	// ── Operational fallback modes (Phase 2) ─────────────────────────────────
	fb := fallback.New(fallback.Config{
		RedisMode:        fallback.ParseMode(envOr("FALLBACK_REDIS_MODE", "closed")),
		ControlPlaneMode: fallback.ParseMode(envOr("FALLBACK_CP_MODE", "closed")),
	})
	log.Printf("fallback modes: redis=%s, control_plane=%s",
		envOr("FALLBACK_REDIS_MODE", "closed"), envOr("FALLBACK_CP_MODE", "closed"))

	// ── OpenTelemetry (Phase 2) ──────────────────────────────────────────────
	tp, err := telemetry.InitProvider(telemetry.Config{
		Enabled:      otelEnabled,
		OTLPEndpoint: otelEndpoint,
		SampleRate:   otelSampleRate,
	})
	if err != nil {
		log.Fatalf("failed to initialize telemetry: %v", err)
	}
	defer func() {
		shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := tp.Shutdown(shutCtx); err != nil {
			log.Printf("telemetry shutdown error: %v", err)
		}
	}()

	// ── Database (Phase 2: Behavioral Analytics) ─────────────────────────────
	var db *sql.DB
	if behavioralAnalyticsEnabled {
		// Ensure the configured database's directory exists (respects a
		// custom DATABASE_PATH rather than assuming the production default).
		if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
			log.Printf("warning: could not create database directory: %v", err)
		}

		db, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_synchronous=NORMAL&_cache_size=10000")
		if err != nil {
			log.Printf("warning: could not open database: %v", err)
			db = nil
		} else {
			// Run basic migrations (in production, use proper migration tool)
			if err := initDatabase(db); err != nil {
				log.Printf("warning: could not initialize database: %v", err)
				db.Close()
				db = nil
			} else {
				log.Printf("behavioral analytics database ready: %s", dbPath)
			}
		}
	}

	// ── Redis configuration validation ────────────────────────────────────────
	// REDIS_ADDR is a redis:// URL and carries the password in userinfo, so
	// neither it nor a parse error wrapping it may be logged: container
	// stdout goes to docker logs and onward to any aggregator. Report the
	// redacted form only.
	redisOpts, err := tokens.ParseRedisAddr(redisAddr)
	if err != nil {
		log.Fatalf("invalid REDIS_ADDR (%s): %v", redactRedisAddr(redisAddr), redactRedisErr(err, redisAddr))
	}

	tokenSvc := tokens.New(tokens.Config{
		SigningKey:      signingKey,
		RedisAddr:       redisAddr,
		RedisOptions:    redisOpts,
		FallbackService: fb,
	})
	confGate := confidence.New()

	// ── Audit writer ─────────────────────────────────────────────────────────
	// AuditStatePath keeps the receipt chain continuous across restarts. With
	// it unset, every process start opens a fresh genesis, and an attacker who
	// deletes one process lifetime's worth of events leaves a log that still
	// verifies — indistinguishable from an honest restart.
	auditStatePath := envOr("LELU_AUDIT_STATE_PATH", filepath.Join(filepath.Dir(dbPath), "audit-chain.json"))
	// LELU_AUDIT_BLOCK_ON_FULL trades hot-path latency for the guarantee that a
	// decision is never returned to a caller without its audit event being
	// queued. Default off preserves existing latency behaviour; operators who
	// treat the log as evidence rather than telemetry should turn it on.
	auditBlockOnFull := strings.EqualFold(strings.TrimSpace(envOr("LELU_AUDIT_BLOCK_ON_FULL", "false")), "true")
	auditWriter := audit.New(audit.Config{
		StatePath:   auditStatePath,
		BlockOnFull: auditBlockOnFull,
	})
	if auditBlockOnFull {
		log.Printf("audit: backpressure enabled — decisions block rather than go unrecorded")
	} else {
		log.Printf("audit: drop-on-full (set LELU_AUDIT_BLOCK_ON_FULL=true to apply backpressure instead)")
	}
	incidentNotifier := incident.New(incident.Config{
		WebhookURL: incidentWebhookURL,
		Timeout:    time.Duration(incidentTimeoutMS) * time.Millisecond,
	})

	// ── Human review queue (Phase 2) ──────────────────────────────────────────
	var reviewQueue *queue.Queue
	queueDurable := false
	if redisOpts != nil {
		rdb := redis.NewClient(redisOpts)
		var qErr error
		reviewQueue, qErr = queue.New(rdb)
		if qErr != nil {
			// redisOpts.Addr is host:port only — the password lives in
			// redisOpts.Password, so this is safe to log; the wrapped error
			// is not guaranteed to be, hence the redaction.
			log.Printf("warning: could not init review queue (Redis %s): %v", redisOpts.Addr, redactRedisErr(qErr, redisAddr))
			reviewQueue = queue.NewInMemory()
		} else {
			queueDurable = true
			log.Printf("human review queue ready (Redis %s)", redisOpts.Addr)
		}
	} else {
		reviewQueue = queue.NewInMemory()
	}
	// Gate on whether the queue actually ended up durable, not on whether the
	// URL parsed. Parsing succeeds and connecting fails is the common case —
	// a wrong host, a down Redis, an image that predates the URL format — and
	// that was exactly the case the old redisOpts == nil condition could not
	// see, so the one warning written to tell an operator their approvals are
	// volatile stayed silent precisely when it mattered.
	if !queueDurable {
		if enforcementMode == server.EnforcementModeEnforce {
			log.Printf("WARNING: human review queue is in-memory — pending approvals WILL be lost on restart. Set REDIS_ADDR to a reachable Redis for durable storage when LELU_MODE=enforce")
		} else {
			log.Printf("human review queue is in-memory (no reachable Redis) — pending approvals will be lost on restart")
		}
	}

	// ── Tenant rate limiter (Phase 2) ────────────────────────────────────────
	// Non-zero defaults. A limiter that is off unless an operator opts in is
	// off in every deployment that follows the README, and an unbounded
	// caller is what lets a single API key outrun the audit writer
	// indefinitely. These ceilings are high enough not to interfere with
	// ordinary use and low enough to keep one key from saturating the log;
	// set either to 0 to disable deliberately.
	authLimit := parseIntOr(envOr("TENANT_AUTH_RATE_LIMIT", "6000"), 6000)
	mintLimit := parseIntOr(envOr("TENANT_MINT_RATE_LIMIT", "600"), 600)
	rl := ratelimit.New(ratelimit.Config{
		Defaults: ratelimit.TenantLimits{
			AuthChecksPerMinute: authLimit,
			TokenMintsPerMinute: mintLimit,
		},
	})
	if rl != nil {
		log.Printf("tenant rate limiter enabled (auth=%d/min, mint=%d/min)", authLimit, mintLimit)
	} else {
		log.Printf("WARNING: tenant rate limiting is DISABLED (TENANT_AUTH_RATE_LIMIT and TENANT_MINT_RATE_LIMIT are both 0) — a single credential can saturate the audit writer")
	}

	// ── OAuth Token Vault ─────────────────────────────────────────────────────
	var vaultSvc *vault.Service
	if db != nil {
		vaultKey := envOr("VAULT_KEY", signingKey) // falls back to JWT signing key
		var vErr error
		vaultSvc, vErr = vault.New(vault.Config{
			DB:        db,
			VaultKey:  vaultKey,
			Providers: vault.BuiltinProviders(),
		})
		if vErr != nil {
			log.Printf("warning: vault init failed: %v", vErr)
		} else {
			log.Printf("OAuth token vault ready (providers: %v)", vaultSvc.Providers())
		}
	}

	// ── Agent Identity Registry + MCP OAuth 2.1 ──────────────────────────────
	// Load or generate the RSA signing key and persist it so it survives restarts.
	// Without this, every restart invalidates all issued agent workload JWTs.
	rsaKey, rsaErr := loadOrGenerateRSAKey(rsaKeyPath)
	if rsaErr != nil {
		log.Fatalf("RSA signing key: %v", rsaErr)
	}

	// Sign audit receipts (AARM R5/R6) with the same key, independent of
	// whether DATABASE_PATH/db is configured below — the identity registry
	// needs a DB, receipt signing doesn't.
	var receiptKeyID string
	if kid, err := audit.DeriveKeyID(&rsaKey.PublicKey); err != nil {
		log.Printf("warning: audit receipt signing disabled: %v", err)
	} else {
		auditWriter.SetSigner(rsaKey, kid)
		receiptKeyID = kid
		log.Printf("audit receipts: signing enabled (kid: %s)", kid)
	}

	var identityReg *identity.Registry
	var mcpAuthSvc *mcpauth.Server
	if db != nil {
		var iErr error
		identityReg, iErr = identity.New(identity.Config{
			DB:         db,
			Issuer:     leluIssuer,
			SigningKey: rsaKey,
		})
		if iErr != nil {
			log.Printf("warning: agent identity registry init failed: %v", iErr)
		} else {
			log.Printf("agent identity registry ready (issuer: %s)", leluIssuer)
			mcpAuthSvc, iErr = mcpauth.New(mcpauth.Config{
				DB:         db,
				SigningKey: identityReg.SigningKey(),
				Issuer:     leluIssuer,
				KeyID:      identityReg.KeyID(),
			})
			if iErr != nil {
				log.Printf("warning: MCP OAuth 2.1 server init failed: %v", iErr)
			} else {
				log.Printf("MCP OAuth 2.1 authorization server ready")
			}
		}
	}

	// ── HTTP server ───────────────────────────────────────────────────────────
	h, err := server.New(eval, tokenSvc, confGate, auditWriter, reviewQueue, apiKey, server.ConfidenceConfig{
		AllowUnverifiedConfidence: allowUnverifiedConfidence,
		MissingSignalMode:         missingConfidenceMode,
	}, enforcementMode, incidentNotifier, rl, fb, tp, db)
	if err != nil {
		log.Fatalf("server init: %v", err)
	}
	h.SetPolicyPath(policyPath)
	// Publish the receipt verification key regardless of whether the identity
	// registry came up. Signing receipts against a key nobody can fetch makes
	// the receipts worthless, and the registry needs a database that the
	// receipt signer does not.
	if receiptKeyID != "" {
		h.SetReceiptKey(&rsaKey.PublicKey, receiptKeyID)
	}
	if vaultSvc != nil {
		h.SetVault(vaultSvc)
	}
	if identityReg != nil {
		h.SetIdentityRegistry(identityReg)
	}
	if mcpAuthSvc != nil {
		h.SetMCPAuth(mcpAuthSvc)
	}
	if db != nil {
		nhiInv, nhiErr := nhi.New(db)
		if nhiErr != nil {
			log.Printf("warning: NHI inventory init failed: %v", nhiErr)
		} else {
			h.SetNHIInventory(nhiInv)
			log.Printf("NHI inventory ready")
		}
	}
	srv := server.NewHTTPServer(addr, h)

	// ── Policy sync worker (optional) ─────────────────────────────────────────
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if cpURL != "" {
		worker := syncer.New(syncer.Config{
			ControlPlaneURL: cpURL,
			HMACSecret:      cpHMACSecret,
			TenantID:        tenantID,
			APIKey:          apiKey,
		}, eval)
		go worker.Start(ctx)
		log.Printf("policy sync worker started → %s", cpURL)
	}

	// ── Start server ──────────────────────────────────────────────────────────
	go func() {
		log.Printf("Auth Permission Engine listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	// ── Graceful shutdown ─────────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	// SIGHUP and SIGQUIT reach the graceful path too — every signal that can
	// be caught should drain the audit buffer rather than lose it. SIGKILL
	// cannot be caught, so the un-flushed window is bounded by FlushEvery and
	// closed only by LELU_AUDIT_BLOCK_ON_FULL plus a durable sink.
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM, syscall.SIGHUP, syscall.SIGQUIT)
	<-quit

	log.Println("shutting down…")
	cancel()

	shutCtx, shutCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutCancel()
	if err := srv.Shutdown(shutCtx); err != nil {
		log.Printf("forced shutdown: %v", err)
	}

	h.Shutdown() // Shutdown handler components (e.g., ReputationManager)
	auditWriter.Close()
	if dropped, werrs := auditWriter.Dropped(), auditWriter.WriteErrors(); dropped > 0 || werrs > 0 {
		log.Printf("WARNING: audit log is incomplete for this process lifetime: %d events dropped (queue full), %d failed to write. Sequence gaps in the log identify them.", dropped, werrs)
	}
	if db != nil {
		db.Close()
	}
	log.Println("bye")
}

// initDatabase runs basic database initialization for behavioral analytics
func initDatabase(db *sql.DB) error {
	// Enable WAL mode and other optimizations
	pragmas := []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA synchronous=NORMAL",
		"PRAGMA cache_size=10000",
		"PRAGMA temp_store=memory",
		"PRAGMA mmap_size=268435456", // 256MB
	}

	for _, pragma := range pragmas {
		if _, err := db.Exec(pragma); err != nil {
			return fmt.Errorf("failed to set pragma %s: %w", pragma, err)
		}
	}

	// Create basic tables (simplified version of migration)
	schema := `
	CREATE TABLE IF NOT EXISTS agent_reputation (
		agent_id TEXT PRIMARY KEY,
		reputation_score REAL NOT NULL DEFAULT 0.5,
		decision_count INTEGER NOT NULL DEFAULT 0,
		accuracy_rate REAL NOT NULL DEFAULT 0.0,
		calibration_score REAL NOT NULL DEFAULT 0.5,
		last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		confidence_sum REAL NOT NULL DEFAULT 0.0,
		correct_decisions INTEGER NOT NULL DEFAULT 0,
		high_conf_errors INTEGER NOT NULL DEFAULT 0,
		low_conf_correct INTEGER NOT NULL DEFAULT 0,
		created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
	);
	
	CREATE TABLE IF NOT EXISTS behavioral_baselines (
		agent_id TEXT PRIMARY KEY,
		created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		sample_count INTEGER NOT NULL DEFAULT 0,
		confidence_mean REAL NOT NULL DEFAULT 0.0,
		confidence_std_dev REAL NOT NULL DEFAULT 0.0,
		latency_mean REAL NOT NULL DEFAULT 0.0,
		latency_std_dev REAL NOT NULL DEFAULT 0.0,
		action_frequencies TEXT NOT NULL DEFAULT '{}',
		hourly_patterns TEXT NOT NULL DEFAULT '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]',
		decision_outcomes TEXT NOT NULL DEFAULT '{}',
		confidence_distribution TEXT NOT NULL DEFAULT '[]',
		latency_percentiles TEXT NOT NULL DEFAULT '{}'
	);
	
	CREATE TABLE IF NOT EXISTS anomaly_results (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		agent_id TEXT NOT NULL,
		timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		anomaly_score REAL NOT NULL,
		is_anomaly BOOLEAN NOT NULL DEFAULT FALSE,
		severity TEXT NOT NULL DEFAULT 'none',
		features TEXT NOT NULL DEFAULT '{}',
		explanation TEXT NOT NULL DEFAULT '',
		action TEXT NOT NULL DEFAULT '',
		confidence REAL NOT NULL DEFAULT 0.0,
		latency_ms INTEGER NOT NULL DEFAULT 0,
		outcome TEXT NOT NULL DEFAULT ''
	);
	
	CREATE TABLE IF NOT EXISTS agent_decisions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		agent_id TEXT NOT NULL,
		timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		action TEXT NOT NULL,
		confidence REAL NOT NULL,
		latency_ms INTEGER NOT NULL,
		outcome TEXT NOT NULL,
		was_correct BOOLEAN,
		risk_score REAL,
		human_review_required BOOLEAN DEFAULT FALSE,
		policy_version TEXT,
		trace_id TEXT,
		span_id TEXT
	);
	
	CREATE TABLE IF NOT EXISTS alerts (
		id TEXT PRIMARY KEY,
		rule_id TEXT NOT NULL,
		agent_id TEXT NOT NULL,
		timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		title TEXT NOT NULL,
		description TEXT NOT NULL,
		severity TEXT NOT NULL DEFAULT 'medium',
		priority INTEGER NOT NULL DEFAULT 3,
		trigger_data TEXT NOT NULL DEFAULT '{}',
		context TEXT NOT NULL DEFAULT '{}',
		status TEXT NOT NULL DEFAULT 'active',
		acked_by TEXT,
		acked_at TIMESTAMP,
		resolved_at TIMESTAMP,
		group_id TEXT,
		group_count INTEGER DEFAULT 1,
		tags TEXT NOT NULL DEFAULT '{}',
		channels TEXT NOT NULL DEFAULT '[]'
	);
	
	-- Create indexes
	CREATE INDEX IF NOT EXISTS idx_agent_decisions_agent_timestamp ON agent_decisions(agent_id, timestamp);
	CREATE INDEX IF NOT EXISTS idx_anomaly_results_agent_timestamp ON anomaly_results(agent_id, timestamp);
	CREATE INDEX IF NOT EXISTS idx_alerts_agent_status ON alerts(agent_id, status);

	-- Shadow agent detection
	CREATE TABLE IF NOT EXISTS shadow_agents (
		id              TEXT PRIMARY KEY,
		tenant_id       TEXT NOT NULL DEFAULT '',
		fingerprint_hash TEXT NOT NULL UNIQUE,
		user_agent      TEXT NOT NULL DEFAULT '',
		api_key_prefix  TEXT NOT NULL DEFAULT '',
		first_seen      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		last_seen       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		request_count   INTEGER NOT NULL DEFAULT 1,
		risk_score      REAL NOT NULL DEFAULT 0.0,
		status          TEXT NOT NULL DEFAULT 'unreviewed',
		endpoints_hit   TEXT NOT NULL DEFAULT '[]',
		created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_shadow_agents_status ON shadow_agents(status);
	CREATE INDEX IF NOT EXISTS idx_shadow_agents_tenant ON shadow_agents(tenant_id);
	`

	if _, err := db.Exec(schema); err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}

	return nil
}

// redactRedisAddr renders a redis:// URL with the password removed, for use
// in operator-facing messages. REDIS_ADDR carries the password in userinfo,
// so the raw value must never reach a log line.
func redactRedisAddr(addr string) string {
	u, err := url.Parse(addr)
	if err != nil || u.Host == "" {
		// Unparseable: say nothing about the contents rather than risk
		// echoing a secret out of a malformed string.
		return "<unparseable redis address>"
	}
	if u.User != nil {
		u.User = url.User("<redacted>")
	}
	return u.String()
}

// redactRedisErr strips any literal occurrence of the Redis password out of
// an error's text. Wrapped parse and dial errors quote the address they were
// given, so redacting the address alone is not enough — the secret comes back
// a second time inside the error.
func redactRedisErr(err error, addr string) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	if u, perr := url.Parse(addr); perr == nil && u.User != nil {
		if pw, ok := u.User.Password(); ok && pw != "" {
			msg = strings.ReplaceAll(msg, pw, "<redacted>")
		}
		if name := u.User.Username(); name != "" {
			msg = strings.ReplaceAll(msg, name, "<redacted>")
		}
	}
	// Belt and braces: if the whole address still appears, redact that too.
	if addr != "" {
		msg = strings.ReplaceAll(msg, addr, redactRedisAddr(addr))
	}
	return msg
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseIntOr(value string, fallback int) int {
	v, err := strconv.Atoi(value)
	if err != nil || v <= 0 {
		return fallback
	}
	return v
}

func parseFloatOr(value string, fallback float64) float64 {
	v, err := strconv.ParseFloat(value, 64)
	if err != nil || v <= 0 {
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

// loadOrGenerateRSAKey loads an RSA-2048 private key from path (PEM PKCS1).
// If the file does not exist, a new key is generated and saved there so the
// same key is used after restarts. Without persistence every restart would
// invalidate all issued agent workload JWTs.
func loadOrGenerateRSAKey(path string) (*rsa.PrivateKey, error) {
	if data, err := os.ReadFile(path); err == nil {
		block, _ := pem.Decode(data)
		if block != nil && block.Type == "RSA PRIVATE KEY" {
			key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
			if err == nil {
				log.Printf("RSA signing key loaded from %s", path)
				return key, nil
			}
			log.Printf("warning: could not parse key at %s: %v — generating new key", path, err)
		}
	}

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, fmt.Errorf("generate RSA-2048 key: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		log.Printf("warning: cannot create key dir %s, key will NOT be persisted: %v", filepath.Dir(path), err)
		return key, nil
	}
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		log.Printf("warning: cannot write key to %s, key will NOT be persisted: %v", path, err)
		return key, nil
	}
	defer f.Close()
	block := &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}
	if err := pem.Encode(f, block); err != nil {
		log.Printf("warning: pem encode failed: %v", err)
	}
	log.Printf("RSA signing key generated and persisted to %s", path)
	return key, nil
}
