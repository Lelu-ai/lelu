package apikeys

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
)

func setupTestRedis(t *testing.T) (*Service, *miniredis.Miniredis) {
	t.Helper()

	// Create in-memory Redis server
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("Failed to start miniredis: %v", err)
	}

	// Create service with test Redis
	svc, err := New(Config{
		RedisAddr: mr.Addr(),
	})
	if err != nil {
		mr.Close()
		t.Fatalf("Failed to create service: %v", err)
	}

	return svc, mr
}

func TestGenerateKey(t *testing.T) {
	svc, mr := setupTestRedis(t)
	defer mr.Close()
	defer svc.Close()

	ctx := context.Background()

	tests := []struct {
		name      string
		tenantID  string
		env       string
		keyName   string
		wantErr   bool
		wantEnv   string
	}{
		{
			name:     "generate test key",
			tenantID: "tenant_001",
			env:      "test",
			keyName:  "Test Key",
			wantErr:  false,
			wantEnv:  "test",
		},
		{
			name:     "generate live key",
			tenantID: "tenant_002",
			env:      "live",
			keyName:  "Production Key",
			wantErr:  false,
			wantEnv:  "live",
		},
		{
			name:     "generate dev key (maps to test)",
			tenantID: "tenant_003",
			env:      "dev",
			keyName:  "Dev Key",
			wantErr:  false,
			wantEnv:  "test",
		},
		{
			name:     "invalid environment",
			tenantID: "tenant_004",
			env:      "invalid",
			keyName:  "Invalid Key",
			wantErr:  true,
		},
		{
			name:     "empty tenant ID",
			tenantID: "",
			env:      "test",
			keyName:  "No Tenant",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			apiKey, err := svc.GenerateKey(ctx, tt.tenantID, tt.env, tt.keyName)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			// Verify key format
			if !IsValidKeyFormat(apiKey) {
				t.Errorf("Invalid key format: %s", apiKey)
			}

			// Verify environment prefix
			expectedPrefix := PrefixTest
			if tt.wantEnv == "live" {
				expectedPrefix = PrefixLive
			}
			if !strings.HasPrefix(apiKey, expectedPrefix) {
				t.Errorf("Expected prefix %s, got key: %s", expectedPrefix, apiKey)
			}

			// Verify key is stored in Redis
			metadata, err := svc.GetKeyMetadata(ctx, apiKey)
			if err != nil {
				t.Fatalf("Failed to get metadata: %v", err)
			}

			if metadata.TenantID != tt.tenantID {
				t.Errorf("Expected tenant_id %s, got %s", tt.tenantID, metadata.TenantID)
			}

			if metadata.Name != tt.keyName {
				t.Errorf("Expected name %s, got %s", tt.keyName, metadata.Name)
			}

			if metadata.Env != tt.wantEnv {
				t.Errorf("Expected env %s, got %s", tt.wantEnv, metadata.Env)
			}

			if metadata.Revoked {
				t.Errorf("New key should not be revoked")
			}
		})
	}
}

func TestValidateKey(t *testing.T) {
	svc, mr := setupTestRedis(t)
	defer mr.Close()
	defer svc.Close()

	ctx := context.Background()

	// Generate a test key
	apiKey, err := svc.GenerateKey(ctx, "tenant_test", "test", "Test Key")
	if err != nil {
		t.Fatalf("Failed to generate key: %v", err)
	}

	tests := []struct {
		name      string
		apiKey    string
		wantTenant string
		wantErr   error
	}{
		{
			name:       "valid key",
			apiKey:     apiKey,
			wantTenant: "tenant_test",
			wantErr:    nil,
		},
		{
			name:    "invalid format",
			apiKey:  "invalid_key",
			wantErr: ErrInvalidKey,
		},
		{
			name:    "non-existent key",
			apiKey:  "lelu_test_nonexistent123456789",
			wantErr: ErrKeyNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tenantID, err := svc.ValidateKey(ctx, tt.apiKey)

			if tt.wantErr != nil {
				if err != tt.wantErr {
					t.Errorf("Expected error %v, got %v", tt.wantErr, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if tenantID != tt.wantTenant {
				t.Errorf("Expected tenant_id %s, got %s", tt.wantTenant, tenantID)
			}
		})
	}
}

func TestRevokeKey(t *testing.T) {
	svc, mr := setupTestRedis(t)
	defer mr.Close()
	defer svc.Close()

	ctx := context.Background()

	// Generate a test key
	apiKey, err := svc.GenerateKey(ctx, "tenant_revoke", "test", "Revoke Test")
	if err != nil {
		t.Fatalf("Failed to generate key: %v", err)
	}

	// Verify key works before revocation
	tenantID, err := svc.ValidateKey(ctx, apiKey)
	if err != nil {
		t.Fatalf("Key should be valid before revocation: %v", err)
	}
	if tenantID != "tenant_revoke" {
		t.Errorf("Expected tenant_id tenant_revoke, got %s", tenantID)
	}

	// Revoke the key
	err = svc.RevokeKey(ctx, apiKey)
	if err != nil {
		t.Fatalf("Failed to revoke key: %v", err)
	}

	// Verify key is revoked
	_, err = svc.ValidateKey(ctx, apiKey)
	if err != ErrKeyRevoked {
		t.Errorf("Expected ErrKeyRevoked, got %v", err)
	}

	// Verify metadata shows revoked status
	metadata, err := svc.GetKeyMetadata(ctx, apiKey)
	if err != nil {
		t.Fatalf("Failed to get metadata: %v", err)
	}
	if !metadata.Revoked {
		t.Errorf("Metadata should show key as revoked")
	}
}

func TestGenerateAnonymousKey(t *testing.T) {
	svc, mr := setupTestRedis(t)
	defer mr.Close()
	defer svc.Close()

	ctx := context.Background()

	tests := []struct {
		name    string
		ip      string
		wantErr bool
	}{
		{
			name:    "valid IP",
			ip:      "192.168.1.100",
			wantErr: false,
		},
		{
			name:    "empty IP",
			ip:      "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			apiKey, err := svc.GenerateAnonymousKey(ctx, tt.ip)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			// Verify key format
			if !IsAnonymousKey(apiKey) {
				t.Errorf("Key should be anonymous: %s", apiKey)
			}

			// Verify key structure: lelu_anon_{shortid}_{random}
			parts := strings.Split(apiKey, "_")
			if len(parts) != 4 {
				t.Errorf("Expected 4 parts in anonymous key, got %d: %s", len(parts), apiKey)
			}

			if len(parts) >= 3 {
				shortID := parts[2]
				if len(shortID) < 6 || len(shortID) > 12 {
					t.Errorf("Expected short ID between 6-12 chars, got %d chars: %s", len(shortID), shortID)
				}
			}

			if len(parts) >= 4 {
				randomPart := parts[3]
				if len(randomPart) < 20 || len(randomPart) > 50 {
					t.Errorf("Expected random part between 20-50 chars, got %d chars: %s", len(randomPart), randomPart)
				}
			}

			// Verify metadata
			metadata, err := svc.GetKeyMetadata(ctx, apiKey)
			if err != nil {
				t.Fatalf("Failed to get metadata: %v", err)
			}

			if !metadata.IsAnonymous {
				t.Errorf("Metadata should mark key as anonymous")
			}

			if metadata.CreatedIP != tt.ip {
				t.Errorf("Expected created_ip %s, got %s", tt.ip, metadata.CreatedIP)
			}

			if len(parts) >= 3 {
				shortID := parts[2]
				expectedTenantID := "anon_" + shortID
				if metadata.TenantID != expectedTenantID {
					t.Errorf("Expected tenant_id %s, got %s", expectedTenantID, metadata.TenantID)
				}
			}
		})
	}
}

func TestAnonymousKeyRateLimit(t *testing.T) {
	svc, mr := setupTestRedis(t)
	defer mr.Close()
	defer svc.Close()

	ctx := context.Background()
	ip := "192.168.1.200"

	// Generate keys up to hourly limit
	for i := 0; i < 5; i++ {
		_, err := svc.GenerateAnonymousKey(ctx, ip)
		if err != nil {
			t.Fatalf("Failed to generate key %d: %v", i+1, err)
		}
	}

	// Next key should fail due to rate limit
	_, err := svc.GenerateAnonymousKey(ctx, ip)
	if err == nil {
		t.Errorf("Expected rate limit error after 5 keys")
	}
	if !strings.Contains(err.Error(), "rate limit exceeded") {
		t.Errorf("Expected rate limit error, got: %v", err)
	}
}

func TestIPBinding(t *testing.T) {
	svc, mr := setupTestRedis(t)
	defer mr.Close()
	defer svc.Close()

	ctx := context.Background()

	// Generate anonymous key
	apiKey, err := svc.GenerateAnonymousKey(ctx, "192.168.1.100")
	if err != nil {
		t.Fatalf("Failed to generate key: %v", err)
	}

	// First IP binding should succeed
	err = svc.BindIPToKey(ctx, apiKey, "192.168.1.100")
	if err != nil {
		t.Fatalf("First IP binding failed: %v", err)
	}

	// Verify IP is bound
	metadata, err := svc.GetKeyMetadata(ctx, apiKey)
	if err != nil {
		t.Fatalf("Failed to get metadata: %v", err)
	}
	if metadata.BoundIP != "192.168.1.100" {
		t.Errorf("Expected bound_ip 192.168.1.100, got %s", metadata.BoundIP)
	}

	// Same IP should work
	err = svc.BindIPToKey(ctx, apiKey, "192.168.1.100")
	if err != nil {
		t.Errorf("Same IP should be allowed: %v", err)
	}

	// Different IP should be allowed (with tracking)
	err = svc.BindIPToKey(ctx, apiKey, "192.168.1.101")
	if err != nil {
		t.Errorf("IP change should be allowed: %v", err)
	}

	// Verify IP was updated
	metadata, err = svc.GetKeyMetadata(ctx, apiKey)
	if err != nil {
		t.Fatalf("Failed to get metadata: %v", err)
	}
	if metadata.BoundIP != "192.168.1.101" {
		t.Errorf("Expected bound_ip 192.168.1.101, got %s", metadata.BoundIP)
	}
}

func TestListKeysForTenant(t *testing.T) {
	svc, mr := setupTestRedis(t)
	defer mr.Close()
	defer svc.Close()

	ctx := context.Background()
	tenantID := "tenant_list_test"

	// Generate multiple keys for the same tenant
	key1, err := svc.GenerateKey(ctx, tenantID, "test", "Key 1")
	if err != nil {
		t.Fatalf("Failed to generate key 1: %v", err)
	}

	key2, err := svc.GenerateKey(ctx, tenantID, "test", "Key 2")
	if err != nil {
		t.Fatalf("Failed to generate key 2: %v", err)
	}

	// Generate key for different tenant
	_, err = svc.GenerateKey(ctx, "other_tenant", "test", "Other Key")
	if err != nil {
		t.Fatalf("Failed to generate other key: %v", err)
	}

	// List keys for tenant
	keys, err := svc.ListKeysForTenant(ctx, tenantID)
	if err != nil {
		t.Fatalf("Failed to list keys: %v", err)
	}

	// Should have exactly 2 keys
	if len(keys) != 2 {
		t.Errorf("Expected 2 keys, got %d", len(keys))
	}

	// Verify keys are correct
	foundKey1 := false
	foundKey2 := false
	for _, key := range keys {
		if key == key1 {
			foundKey1 = true
		}
		if key == key2 {
			foundKey2 = true
		}
	}

	if !foundKey1 || !foundKey2 {
		t.Errorf("Expected to find both keys, found key1=%v, key2=%v", foundKey1, foundKey2)
	}
}

func TestKeyExpiration(t *testing.T) {
	svc, mr := setupTestRedis(t)
	defer mr.Close()
	defer svc.Close()

	ctx := context.Background()

	// Generate anonymous key (has expiration)
	apiKey, err := svc.GenerateAnonymousKey(ctx, "192.168.1.100")
	if err != nil {
		t.Fatalf("Failed to generate key: %v", err)
	}

	t.Logf("Generated anonymous key: %s", apiKey)

	// Verify key exists
	_, err = svc.ValidateKey(ctx, apiKey)
	if err != nil {
		t.Fatalf("Key should be valid: %v (key=%s)", err, apiKey)
	}

	// Fast-forward time in miniredis (30 days + 1 second)
	mr.FastForward(30*24*time.Hour + time.Second)

	// Key should be expired
	_, err = svc.ValidateKey(ctx, apiKey)
	if err != ErrKeyNotFound {
		t.Errorf("Expected ErrKeyNotFound for expired key, got %v", err)
	}
}

func TestIsValidKeyFormat(t *testing.T) {
	tests := []struct {
		key   string
		valid bool
	}{
		{"lelu_test_abc123defghijklmnop", true},
		{"lelu_live_xyz789abcdefghijklm", true},
		{"lelu_anon_12345678_abcdefghijklmnopqrstuvwxyz12", true},
		{"lelu_anon_MqO-3zOC_abcdefghijklmnopqrstuvwxyz", true}, // Realistic format
		{"invalid_key", false},
		{"lelu_invalid_abc", false},
		{"", false},
		{"lelu_test_", false},
		{"lelu_test_short", false}, // Too short
		{"lelu_anon_short_random", false}, // Wrong format for anon key (parts too short)
	}

	for _, tt := range tests {
		t.Run(tt.key, func(t *testing.T) {
			result := IsValidKeyFormat(tt.key)
			if result != tt.valid {
				t.Errorf("IsValidKeyFormat(%s) = %v, want %v", tt.key, result, tt.valid)
			}
		})
	}
}

func TestExtractEnv(t *testing.T) {
	tests := []struct {
		key     string
		wantEnv string
	}{
		{"lelu_test_abc123", "test"},
		{"lelu_live_xyz789", "live"},
		{"lelu_anon_short_random", "anon"},
		{"invalid_key", ""},
	}

	for _, tt := range tests {
		t.Run(tt.key, func(t *testing.T) {
			result := ExtractEnv(tt.key)
			if result != tt.wantEnv {
				t.Errorf("ExtractEnv(%s) = %s, want %s", tt.key, result, tt.wantEnv)
			}
		})
	}
}
