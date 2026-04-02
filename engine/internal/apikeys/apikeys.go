// Package apikeys provides API key generation, validation, and tenant resolution
// for the dual-mode SDK architecture (SaaS + self-hosted).
package apikeys

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	// Key prefixes for different environments
	PrefixLive = "lelu_live_"
	PrefixTest = "lelu_test_"
	PrefixAnon = "lelu_anon_"

	// Redis key prefix for API key storage
	redisKeyPrefix = "lelu:apikey:"
	redisIPPrefix  = "lelu:ip:"

	// Default key length (random portion)
	defaultKeyLength = 32
)

var (
	ErrInvalidKey  = errors.New("invalid API key format")
	ErrKeyNotFound = errors.New("API key not found")
	ErrKeyExpired  = errors.New("API key has expired")
	ErrKeyRevoked  = errors.New("API key has been revoked")
)

// KeyMetadata contains information about an API key
type KeyMetadata struct {
	TenantID    string     `json:"tenant_id"`
	KeyID       string     `json:"key_id"`
	CreatedAt   time.Time  `json:"created_at"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	Revoked     bool       `json:"revoked"`
	Name        string     `json:"name,omitempty"`
	Env         string     `json:"env"`                  // "live", "test", or "anon"
	CreatedIP   string     `json:"created_ip,omitempty"` // For anonymous keys
	BoundIP     string     `json:"bound_ip,omitempty"`   // IP binding for anonymous keys
	IsAnonymous bool       `json:"is_anonymous"`
}

// Service manages API keys and tenant resolution
type Service struct {
	rdb *redis.Client
}

// Config configures the API key service
type Config struct {
	RedisAddr string
}

// New creates a new API key service
func New(cfg Config) (*Service, error) {
	if cfg.RedisAddr == "" {
		return nil, errors.New("redis address is required")
	}

	rdb := redis.NewClient(&redis.Options{
		Addr: cfg.RedisAddr,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis connection failed: %w", err)
	}

	return &Service{rdb: rdb}, nil
}

// GenerateKey creates a new API key for a tenant
func (s *Service) GenerateKey(ctx context.Context, tenantID, env, name string) (string, error) {
	if tenantID == "" {
		return "", errors.New("tenant_id is required")
	}

	// Validate environment
	var prefix string
	switch strings.ToLower(env) {
	case "live", "production", "prod":
		prefix = PrefixLive
		env = "live"
	case "test", "testing", "dev", "development":
		prefix = PrefixTest
		env = "test"
	default:
		return "", fmt.Errorf("invalid environment: %s (must be 'live' or 'test')", env)
	}

	// Generate secure random key
	randomBytes := make([]byte, defaultKeyLength)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", fmt.Errorf("failed to generate random key: %w", err)
	}

	// Encode as base64 URL-safe
	randomPart := base64.RawURLEncoding.EncodeToString(randomBytes)
	apiKey := prefix + randomPart

	// Store metadata in Redis
	metadata := KeyMetadata{
		TenantID:  tenantID,
		KeyID:     randomPart[:16], // Use first 16 chars as key ID
		CreatedAt: time.Now().UTC(),
		Revoked:   false,
		Name:      name,
		Env:       env,
	}

	// Serialize metadata as JSON
	data := fmt.Sprintf(`{"tenant_id":"%s","key_id":"%s","created_at":"%s","revoked":false,"name":"%s","env":"%s"}`,
		metadata.TenantID,
		metadata.KeyID,
		metadata.CreatedAt.Format(time.RFC3339),
		metadata.Name,
		metadata.Env,
	)

	// Store with no expiration (keys don't expire unless explicitly revoked)
	if err := s.rdb.Set(ctx, redisKey(apiKey), data, 0).Err(); err != nil {
		return "", fmt.Errorf("failed to store API key: %w", err)
	}

	return apiKey, nil
}

// ValidateKey checks if an API key is valid and returns the tenant ID
func (s *Service) ValidateKey(ctx context.Context, apiKey string) (string, error) {
	// Check key format
	if !IsValidKeyFormat(apiKey) {
		return "", ErrInvalidKey
	}

	// Lookup in Redis
	data, err := s.rdb.Get(ctx, redisKey(apiKey)).Result()
	if err == redis.Nil {
		return "", ErrKeyNotFound
	}
	if err != nil {
		return "", fmt.Errorf("redis lookup failed: %w", err)
	}

	// Parse metadata (simple JSON parsing for tenant_id and revoked status)
	tenantID := extractJSONField(data, "tenant_id")
	revoked := extractJSONField(data, "revoked")

	if tenantID == "" {
		return "", ErrKeyNotFound
	}

	if revoked == "true" {
		return "", ErrKeyRevoked
	}

	return tenantID, nil
}

// RevokeKey immediately invalidates an API key
func (s *Service) RevokeKey(ctx context.Context, apiKey string) error {
	// Get existing metadata
	data, err := s.rdb.Get(ctx, redisKey(apiKey)).Result()
	if err == redis.Nil {
		return ErrKeyNotFound
	}
	if err != nil {
		return fmt.Errorf("redis lookup failed: %w", err)
	}

	// Update revoked status
	tenantID := extractJSONField(data, "tenant_id")
	keyID := extractJSONField(data, "key_id")
	createdAt := extractJSONField(data, "created_at")
	name := extractJSONField(data, "name")
	env := extractJSONField(data, "env")

	updatedData := fmt.Sprintf(`{"tenant_id":"%s","key_id":"%s","created_at":"%s","revoked":true,"name":"%s","env":"%s"}`,
		tenantID, keyID, createdAt, name, env,
	)

	if err := s.rdb.Set(ctx, redisKey(apiKey), updatedData, 0).Err(); err != nil {
		return fmt.Errorf("failed to revoke key: %w", err)
	}

	return nil
}

// GetKeyMetadata retrieves metadata for an API key
func (s *Service) GetKeyMetadata(ctx context.Context, apiKey string) (*KeyMetadata, error) {
	data, err := s.rdb.Get(ctx, redisKey(apiKey)).Result()
	if err == redis.Nil {
		return nil, ErrKeyNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("redis lookup failed: %w", err)
	}

	// Parse metadata
	tenantID := extractJSONField(data, "tenant_id")
	keyID := extractJSONField(data, "key_id")
	createdAtStr := extractJSONField(data, "created_at")
	revoked := extractJSONField(data, "revoked") == "true"
	name := extractJSONField(data, "name")
	env := extractJSONField(data, "env")
	createdIP := extractJSONField(data, "created_ip")
	boundIP := extractJSONField(data, "bound_ip")
	isAnonymous := extractJSONField(data, "is_anonymous") == "true"

	createdAt, _ := time.Parse(time.RFC3339, createdAtStr)

	return &KeyMetadata{
		TenantID:    tenantID,
		KeyID:       keyID,
		CreatedAt:   createdAt,
		Revoked:     revoked,
		Name:        name,
		Env:         env,
		CreatedIP:   createdIP,
		BoundIP:     boundIP,
		IsAnonymous: isAnonymous,
	}, nil
}

// ListKeysForTenant returns all API keys for a tenant
func (s *Service) ListKeysForTenant(ctx context.Context, tenantID string) ([]string, error) {
	// Scan for all keys matching the pattern
	pattern := redisKeyPrefix + "*"
	var keys []string

	iter := s.rdb.Scan(ctx, 0, pattern, 100).Iterator()
	for iter.Next(ctx) {
		key := iter.Val()

		// Get metadata to check tenant_id
		data, err := s.rdb.Get(ctx, key).Result()
		if err != nil {
			continue
		}

		if extractJSONField(data, "tenant_id") == tenantID {
			// Extract API key from Redis key
			apiKey := strings.TrimPrefix(key, redisKeyPrefix)
			keys = append(keys, apiKey)
		}
	}

	if err := iter.Err(); err != nil {
		return nil, fmt.Errorf("redis scan failed: %w", err)
	}

	return keys, nil
}

// Close closes the Redis connection
func (s *Service) Close() error {
	return s.rdb.Close()
}

// Helper functions

func redisKey(apiKey string) string {
	return redisKeyPrefix + apiKey
}

// Simple JSON field extractor (avoids full JSON parsing for performance)
func extractJSONField(jsonStr, field string) string {
	// Look for "field":"value" or "field":true/false
	searchStr := `"` + field + `":`
	start := strings.Index(jsonStr, searchStr)
	if start == -1 {
		return ""
	}
	start += len(searchStr)

	// Skip whitespace
	for start < len(jsonStr) && (jsonStr[start] == ' ' || jsonStr[start] == '\t') {
		start++
	}

	if start >= len(jsonStr) {
		return ""
	}

	// Check if value is a string (starts with ")
	if jsonStr[start] == '"' {
		start++ // Skip opening quote
		end := strings.Index(jsonStr[start:], `"`)
		if end == -1 {
			return ""
		}
		return jsonStr[start : start+end]
	}

	// Check if value is a boolean or number
	end := start
	for end < len(jsonStr) && jsonStr[end] != ',' && jsonStr[end] != '}' && jsonStr[end] != ' ' {
		end++
	}
	return jsonStr[start:end]
}

// IsValidKeyFormat checks if a string matches the API key format
func IsValidKeyFormat(key string) bool {
	// Check for valid prefix
	hasValidPrefix := strings.HasPrefix(key, PrefixLive) ||
		strings.HasPrefix(key, PrefixTest) ||
		strings.HasPrefix(key, PrefixAnon)
	
	if !hasValidPrefix {
		return false
	}
	
	// Check minimum length (prefix + at least some random data)
	minLength := len(PrefixTest) + 8 // Shortest prefix + minimum random part
	if len(key) < minLength {
		return false
	}
	
	// For anonymous keys, check format: lelu_anon_shortid_random
	if strings.HasPrefix(key, PrefixAnon) {
		parts := strings.Split(key, "_")
		// Should have 4-5 parts: "lelu", "anon", "shortid", "random" (and possibly empty string from trailing _)
		if len(parts) < 4 || len(parts) > 5 {
			return false
		}
		// Short ID should be around 8 chars, random should be around 32 chars
		// Allow some flexibility for base64 encoding variations
		if len(parts[2]) < 6 || len(parts[2]) > 12 {
			return false
		}
		if len(parts[3]) < 20 || len(parts[3]) > 50 {
			return false
		}
	}
	
	return true
}

// ExtractEnv returns the environment from an API key
func ExtractEnv(key string) string {
	if strings.HasPrefix(key, PrefixLive) {
		return "live"
	}
	if strings.HasPrefix(key, PrefixTest) {
		return "test"
	}
	if strings.HasPrefix(key, PrefixAnon) {
		return "anon"
	}
	return ""
}

// GenerateAnonymousKey creates a new anonymous beta key with IP binding
func (s *Service) GenerateAnonymousKey(ctx context.Context, createdIP string) (string, error) {
	if createdIP == "" {
		return "", errors.New("created_ip is required for anonymous keys")
	}

	// Check IP rate limit (5 keys per hour)
	if err := s.checkIPRateLimit(ctx, createdIP); err != nil {
		return "", err
	}

	// Generate 8-character short ID (remove underscores and hyphens from base64)
	shortIDBytes := make([]byte, 6)
	if _, err := rand.Read(shortIDBytes); err != nil {
		return "", fmt.Errorf("failed to generate short ID: %w", err)
	}
	shortID := strings.ReplaceAll(base64.RawURLEncoding.EncodeToString(shortIDBytes), "_", "")
	shortID = strings.ReplaceAll(shortID, "-", "")
	if len(shortID) > 8 {
		shortID = shortID[:8]
	}

	// Generate 32-character random part (remove underscores and hyphens from base64)
	randomBytes := make([]byte, 24)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", fmt.Errorf("failed to generate random key: %w", err)
	}
	randomPart := strings.ReplaceAll(base64.RawURLEncoding.EncodeToString(randomBytes), "_", "")
	randomPart = strings.ReplaceAll(randomPart, "-", "")
	if len(randomPart) > 32 {
		randomPart = randomPart[:32]
	}

	apiKey := fmt.Sprintf("%s%s_%s", PrefixAnon, shortID, randomPart)
	tenantID := fmt.Sprintf("anon_%s", shortID)

	// Store metadata
	metadata := KeyMetadata{
		TenantID:    tenantID,
		KeyID:       shortID,
		CreatedAt:   time.Now().UTC(),
		Revoked:     false,
		Name:        "Anonymous Beta Key",
		Env:         "anon",
		CreatedIP:   createdIP,
		IsAnonymous: true,
	}

	// Serialize metadata
	data := fmt.Sprintf(`{"tenant_id":"%s","key_id":"%s","created_at":"%s","revoked":false,"name":"%s","env":"anon","created_ip":"%s","is_anonymous":true}`,
		metadata.TenantID,
		metadata.KeyID,
		metadata.CreatedAt.Format(time.RFC3339),
		metadata.Name,
		metadata.CreatedIP,
	)

	// Store with 30-day expiration
	expiration := 30 * 24 * time.Hour
	if err := s.rdb.Set(ctx, redisKey(apiKey), data, expiration).Err(); err != nil {
		return "", fmt.Errorf("failed to store anonymous key: %w", err)
	}

	// Increment IP counter
	if err := s.incrementIPCounter(ctx, createdIP); err != nil {
		return "", fmt.Errorf("failed to increment IP counter: %w", err)
	}

	return apiKey, nil
}

// checkIPRateLimit checks if an IP has exceeded key generation limits
func (s *Service) checkIPRateLimit(ctx context.Context, ip string) error {
	// Check hourly limit (5 keys per hour)
	hourKey := fmt.Sprintf("%sgen:hour:%s:%s", redisIPPrefix, ip, time.Now().Format("2006-01-02-15"))
	hourCount, err := s.rdb.Get(ctx, hourKey).Int()
	if err != nil && err != redis.Nil {
		return fmt.Errorf("failed to check hourly limit: %w", err)
	}

	if hourCount >= 5 {
		return errors.New("rate limit exceeded: maximum 5 keys per hour")
	}

	// Check daily limit (10 keys per day)
	dayKey := fmt.Sprintf("%sgen:day:%s:%s", redisIPPrefix, ip, time.Now().Format("2006-01-02"))
	dayCount, err := s.rdb.Get(ctx, dayKey).Int()
	if err != nil && err != redis.Nil {
		return fmt.Errorf("failed to check daily limit: %w", err)
	}

	if dayCount >= 10 {
		return errors.New("rate limit exceeded: maximum 10 keys per day")
	}

	return nil
}

// incrementIPCounter increments the IP-based key generation counter
func (s *Service) incrementIPCounter(ctx context.Context, ip string) error {
	now := time.Now()

	// Increment hourly counter
	hourKey := fmt.Sprintf("%sgen:hour:%s:%s", redisIPPrefix, ip, now.Format("2006-01-02-15"))
	if err := s.rdb.Incr(ctx, hourKey).Err(); err != nil {
		return err
	}
	s.rdb.Expire(ctx, hourKey, 2*time.Hour) // Expire after 2 hours

	// Increment daily counter
	dayKey := fmt.Sprintf("%sgen:day:%s:%s", redisIPPrefix, ip, now.Format("2006-01-02"))
	if err := s.rdb.Incr(ctx, dayKey).Err(); err != nil {
		return err
	}
	s.rdb.Expire(ctx, dayKey, 48*time.Hour) // Expire after 2 days

	return nil
}

// BindIPToKey binds an IP address to an anonymous key on first use
func (s *Service) BindIPToKey(ctx context.Context, apiKey, ip string) error {
	// Get existing metadata
	data, err := s.rdb.Get(ctx, redisKey(apiKey)).Result()
	if err != nil {
		return fmt.Errorf("failed to get key metadata: %w", err)
	}

	tenantID := extractJSONField(data, "tenant_id")
	boundIP := extractJSONField(data, "bound_ip")

	// Check if already bound to a different IP
	if boundIP != "" && boundIP != ip {
		// Track IP change for monitoring (don't block legitimate users)
		log.Printf("IP change detected for anonymous key: tenant=%s, old_ip=%s, new_ip=%s",
			tenantID, boundIP, ip)

		// Check if this is suspicious behavior (many IP changes in short time)
		ipChangeKey := fmt.Sprintf("lelu:ip:changes:%s", tenantID)
		changes, _ := s.rdb.Incr(ctx, ipChangeKey).Result()
		s.rdb.Expire(ctx, ipChangeKey, time.Hour) // Reset counter every hour

		// Only block if excessive IP changes (10+ per hour = likely abuse)
		if changes > 10 {
			log.Printf("Excessive IP changes detected for tenant %s: %d changes in last hour",
				tenantID, changes)
			return fmt.Errorf("excessive IP changes detected - possible key sharing")
		}

		// Allow the IP change but update the bound IP
		// This handles legitimate cases: VPN, WiFi switching, CI/CD, mobile hotspot
		log.Printf("Allowing IP change for tenant %s (change #%d this hour)", tenantID, changes)
	}

	// Bind or update to this IP
	if boundIP == "" || boundIP != ip {
		keyID := extractJSONField(data, "key_id")
		createdAt := extractJSONField(data, "created_at")
		name := extractJSONField(data, "name")
		createdIP := extractJSONField(data, "created_ip")

		updatedData := fmt.Sprintf(`{"tenant_id":"%s","key_id":"%s","created_at":"%s","revoked":false,"name":"%s","env":"anon","created_ip":"%s","bound_ip":"%s","is_anonymous":true}`,
			tenantID, keyID, createdAt, name, createdIP, ip,
		)

		// Update with same expiration
		ttl, _ := s.rdb.TTL(ctx, redisKey(apiKey)).Result()
		if err := s.rdb.Set(ctx, redisKey(apiKey), updatedData, ttl).Err(); err != nil {
			return fmt.Errorf("failed to bind IP: %w", err)
		}
	}

	return nil
}

// IsAnonymousKey checks if a key is an anonymous beta key
func IsAnonymousKey(key string) bool {
	return strings.HasPrefix(key, PrefixAnon)
}
