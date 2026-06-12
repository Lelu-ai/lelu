package ratelimit_test

import (
	"testing"

	"github.com/lelu-auth/lelu/engine/internal/ratelimit"
)

func TestLimiter_Nil_AlwaysAllows(t *testing.T) {
	var l *ratelimit.Limiter
	if !l.AllowAuth("tenant-1") {
		t.Error("nil limiter should always allow auth")
	}
	if !l.AllowMint("tenant-1") {
		t.Error("nil limiter should always allow mint")
	}
}

func TestLimiter_AuthRateLimit(t *testing.T) {
	l := ratelimit.New(ratelimit.Config{
		Defaults: ratelimit.TenantLimits{
			AuthChecksPerMinute: 5,
			TokenMintsPerMinute: 3,
		},
	})
	if l == nil {
		t.Fatal("expected non-nil limiter")
	}

	// First 5 should pass.
	for i := 0; i < 5; i++ {
		if !l.AllowAuth("tenant-1") {
			t.Errorf("expected auth call %d to be allowed", i+1)
		}
	}
	// 6th should be rejected.
	if l.AllowAuth("tenant-1") {
		t.Error("expected 6th auth call to be rate-limited")
	}
	// Different tenant should still be allowed.
	if !l.AllowAuth("tenant-2") {
		t.Error("expected different tenant to be allowed")
	}
}

func TestLimiter_MintRateLimit(t *testing.T) {
	l := ratelimit.New(ratelimit.Config{
		Defaults: ratelimit.TenantLimits{
			AuthChecksPerMinute: 100,
			TokenMintsPerMinute: 2,
		},
	})

	if !l.AllowMint("t1") {
		t.Error("first mint should be allowed")
	}
	if !l.AllowMint("t1") {
		t.Error("second mint should be allowed")
	}
	if l.AllowMint("t1") {
		t.Error("third mint should be rate-limited")
	}
}

func TestLimiter_OverridePerTenant(t *testing.T) {
	l := ratelimit.New(ratelimit.Config{
		Defaults: ratelimit.TenantLimits{
			AuthChecksPerMinute: 2,
			TokenMintsPerMinute: 2,
		},
		Overrides: map[string]ratelimit.TenantLimits{
			"vip-tenant": {AuthChecksPerMinute: 100, TokenMintsPerMinute: 100},
		},
	})

	// Default tenant limited to 2.
	for i := 0; i < 2; i++ {
		l.AllowAuth("normal")
	}
	if l.AllowAuth("normal") {
		t.Error("expected default tenant to be rate-limited after 2 calls")
	}

	// VIP tenant gets 100 — should be fine.
	for i := 0; i < 50; i++ {
		if !l.AllowAuth("vip-tenant") {
			t.Errorf("expected vip tenant auth call %d to pass", i+1)
		}
	}
}

func TestLimiter_Disabled_ReturnsNil(t *testing.T) {
	l := ratelimit.New(ratelimit.Config{})
	if l != nil {
		t.Error("expected nil limiter when defaults are zero")
	}
}
