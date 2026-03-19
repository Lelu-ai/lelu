package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	_ "github.com/mattn/go-sqlite3" // SQLite driver

	"github.com/lelu/engine/internal/audit"
	"github.com/lelu/engine/internal/confidence"
	"github.com/lelu/engine/internal/evaluator"
	"github.com/lelu/engine/internal/fallback"
	"github.com/lelu/engine/internal/incident"
	"github.com/lelu/engine/internal/queue"
	"github.com/lelu/engine/internal/ratelimit"
	"github.com/lelu/engine/internal/server"
	syncer "github.com/lelu/engine/internal/sync"
	"github.com/lelu/engine/internal/telemetry"
	"github.com/lelu/engine/internal/tokens"
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
	
	// Phase 2: Behavioral Analytics Database
	dbPath := envOr("DATABASE_PATH", "/var/lib/lelu/lelu.db")
	behavioralAnalyticsEnabled := envOr("BEHAVIORAL_ANALYTICS_ENABLED", "true") == "true"

	if isProductionEnv() {
		if signingKey == "" || signingKey == "change-me-in-production" {
			log.Fatal("JWT_SIGNING_KEY must be explicitly set to a strong secret in production")
		}
		if apiKey == "" || apiKey == "change-me-in-production" {
			log.Fatal("API_KEY must be explicitly set in production")
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
		// Ensure database directory exists
		if err := os.MkdirAll("/var/lib/lelu", 0755); err != nil {
			log.Printf("warning: could not create database directory: %v", err)
		}
		
		db, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_synchronous=NORMAL&_cache_size=10000")
		if err != nil {
			log.Printf("warning: could not open database: %v", err)
			behavioralAnalyticsEnabled = false
		} else {
			// Run basic migrations (in production, use proper migration tool)
			if err := initDatabase(db); err != nil {
				log.Printf("warning: could not initialize database: %v", err)
				db.Close()
				db = nil
				behavioralAnalyticsEnabled = false
			} else {
				log.Printf("behavioral analytics database ready: %s", dbPath)
			}
		}
	}

	tokenSvc := tokens.New(tokens.Config{
		SigningKey:      signingKey,
		RedisAddr:       redisAddr,
		FallbackService: fb,
	})
	confGate := confidence.New()
	auditWriter := audit.New()
	incidentNotifier := incident.New(incident.Config{
		WebhookURL: incidentWebhookURL,
		Timeout:    time.Duration(incidentTimeoutMS) * time.Millisecond,
	})

	// ── Human review queue (Phase 2) ──────────────────────────────────────────
	var reviewQueue *queue.Queue
	if redisAddr != "" {
		rdb := redis.NewClient(&redis.Options{Addr: redisAddr})
		var qErr error
		reviewQueue, qErr = queue.New(rdb)
		if qErr != nil {
			log.Printf("warning: could not init review queue: %v", qErr)
			reviewQueue = queue.NewInMemory()
		} else {
			log.Printf("human review queue ready (Redis %s)", redisAddr)
		}
	} else {
		reviewQueue = queue.NewInMemory()
	}

	// ── Tenant rate limiter (Phase 2) ────────────────────────────────────────
	rl := ratelimit.New(ratelimit.Config{
		Defaults: ratelimit.TenantLimits{
			AuthChecksPerMinute: parseIntOr(envOr("TENANT_AUTH_RATE_LIMIT", "0"), 0),
			TokenMintsPerMinute: parseIntOr(envOr("TENANT_MINT_RATE_LIMIT", "0"), 0),
		},
	})
	if rl != nil {
		log.Printf("tenant rate limiter enabled (auth=%s/min, mint=%s/min)",
			envOr("TENANT_AUTH_RATE_LIMIT", "0"), envOr("TENANT_MINT_RATE_LIMIT", "0"))
	}

	// ── HTTP server ───────────────────────────────────────────────────────────
	h := server.New(eval, tokenSvc, confGate, auditWriter, reviewQueue, apiKey, server.ConfidenceConfig{
		AllowUnverifiedConfidence: allowUnverifiedConfidence,
		MissingSignalMode:         missingConfidenceMode,
	}, enforcementMode, incidentNotifier, rl, fb, tp, db)
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
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down…")
	cancel()

	shutCtx, shutCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutCancel()
	if err := srv.Shutdown(shutCtx); err != nil {
		log.Printf("forced shutdown: %v", err)
	}

	auditWriter.Close()
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
	`
	
	if _, err := db.Exec(schema); err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}
	
	return nil
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
