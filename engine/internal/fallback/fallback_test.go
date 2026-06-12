package fallback_test

import (
	"testing"

	"github.com/lelu-auth/lelu/engine/internal/fallback"
)

func TestParseMode(t *testing.T) {
	cases := []struct {
		input string
		want  fallback.Mode
	}{
		{"open", fallback.ModeOpen},
		{"fail-open", fallback.ModeOpen},
		{"fail_open", fallback.ModeOpen},
		{"OPEN", fallback.ModeOpen},
		{"closed", fallback.ModeClosed},
		{"fail-closed", fallback.ModeClosed},
		{"", fallback.ModeClosed},
		{"anything", fallback.ModeClosed},
	}
	for _, tc := range cases {
		got := fallback.ParseMode(tc.input)
		if got != tc.want {
			t.Errorf("ParseMode(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

func TestShouldAllow_Healthy(t *testing.T) {
	s := fallback.New(fallback.Config{
		RedisMode:        fallback.ModeClosed,
		ControlPlaneMode: fallback.ModeClosed,
	})
	allowed, reason := s.ShouldAllow(fallback.DepRedis)
	if !allowed {
		t.Error("healthy dep should allow")
	}
	if reason != "" {
		t.Errorf("expected empty reason, got %q", reason)
	}
}

func TestShouldAllow_FailClosed(t *testing.T) {
	s := fallback.New(fallback.Config{
		RedisMode: fallback.ModeClosed,
	})
	s.RecordFailure(fallback.DepRedis)

	allowed, reason := s.ShouldAllow(fallback.DepRedis)
	if allowed {
		t.Error("fail-closed should deny when degraded")
	}
	if reason == "" {
		t.Error("expected non-empty reason")
	}
}

func TestShouldAllow_FailOpen(t *testing.T) {
	s := fallback.New(fallback.Config{
		RedisMode: fallback.ModeOpen,
	})
	s.RecordFailure(fallback.DepRedis)

	allowed, reason := s.ShouldAllow(fallback.DepRedis)
	if !allowed {
		t.Error("fail-open should allow when degraded")
	}
	if reason == "" {
		t.Error("expected non-empty reason even on fail-open")
	}
}

func TestRecovery(t *testing.T) {
	s := fallback.New(fallback.Config{
		RedisMode: fallback.ModeClosed,
	})
	s.RecordFailure(fallback.DepRedis)
	if s.IsHealthy(fallback.DepRedis) {
		t.Error("expected unhealthy after failure")
	}
	s.RecordSuccess(fallback.DepRedis)
	if !s.IsHealthy(fallback.DepRedis) {
		t.Error("expected healthy after recovery")
	}
}

func TestStatus(t *testing.T) {
	s := fallback.New(fallback.Config{
		RedisMode:        fallback.ModeOpen,
		ControlPlaneMode: fallback.ModeClosed,
	})
	s.RecordFailure(fallback.DepRedis)
	status := s.Status()
	if len(status) < 2 {
		t.Errorf("expected at least 2 deps in status, got %d", len(status))
	}
	redis := status["redis"]
	if redis["healthy"] != false {
		t.Error("expected redis to be unhealthy")
	}
	if redis["mode"] != "open" {
		t.Errorf("expected redis mode=open, got %v", redis["mode"])
	}
	cp := status["control_plane"]
	if cp["healthy"] != true {
		t.Error("expected control_plane to be healthy")
	}
}
