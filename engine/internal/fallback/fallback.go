// Package fallback provides operational degradation modes for the engine.
//
// When upstream dependencies (Redis, control plane) become unreachable the
// engine needs a deterministic policy for how to handle in-flight requests:
//
//   - fail-open:   allow the action (optimistic — preserves availability)
//   - fail-closed: deny the action  (pessimistic — preserves security)
//
// The Strategy is configured per-dependency at startup via environment
// variables and queried by handlers whenever a dependency call fails.
package fallback

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"
)

// Mode is the operational degradation mode.
type Mode string

const (
	ModeOpen   Mode = "open"   // allow on failure
	ModeClosed Mode = "closed" // deny on failure
)

// ParseMode normalises a string to a Mode, defaulting to ModeClosed.
func ParseMode(s string) Mode {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "open", "fail-open", "fail_open":
		return ModeOpen
	default:
		return ModeClosed
	}
}

// Dep identifies a dependency that can degrade.
type Dep string

const (
	DepRedis        Dep = "redis"
	DepControlPlane Dep = "control_plane"
)

// Config configures per-dependency fallback behaviour.
type Config struct {
	RedisMode        Mode
	ControlPlaneMode Mode
}

// Strategy holds the runtime state of fallback decisions.
type Strategy struct {
	cfg Config

	mu     sync.RWMutex
	status map[Dep]*depStatus
}

type depStatus struct {
	healthy   bool
	lastCheck time.Time
	failures  int
}

// New creates a Strategy from config.
func New(cfg Config) *Strategy {
	return &Strategy{
		cfg: cfg,
		status: map[Dep]*depStatus{
			DepRedis:        {healthy: true},
			DepControlPlane: {healthy: true},
		},
	}
}

// ModeFor returns the configured fallback mode for a given dependency.
func (s *Strategy) ModeFor(dep Dep) Mode {
	if s == nil {
		return ModeClosed
	}
	switch dep {
	case DepRedis:
		return s.cfg.RedisMode
	case DepControlPlane:
		return s.cfg.ControlPlaneMode
	default:
		return ModeClosed
	}
}

// RecordFailure marks a dependency as degraded.
func (s *Strategy) RecordFailure(dep Dep) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ds := s.status[dep]
	if ds == nil {
		ds = &depStatus{}
		s.status[dep] = ds
	}
	ds.healthy = false
	ds.failures++
	ds.lastCheck = time.Now()
	log.Printf("fallback: %s marked degraded (failures=%d)", dep, ds.failures)
}

// RecordSuccess marks a dependency as healthy.
func (s *Strategy) RecordSuccess(dep Dep) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ds := s.status[dep]
	if ds == nil {
		ds = &depStatus{}
		s.status[dep] = ds
	}
	wasUnhealthy := !ds.healthy
	ds.healthy = true
	ds.failures = 0
	ds.lastCheck = time.Now()
	if wasUnhealthy {
		log.Printf("fallback: %s recovered", dep)
	}
}

// IsHealthy returns whether a dependency is currently marked healthy.
func (s *Strategy) IsHealthy(dep Dep) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ds := s.status[dep]
	if ds == nil {
		return true
	}
	return ds.healthy
}

// ShouldAllow determines whether a request should be allowed when the given
// dependency is degraded. It returns (allowed bool, reason string).
//
//   - If the dependency is healthy, returns (true, "").
//   - If fail-open: returns (true, "dependency <dep> degraded — fail-open").
//   - If fail-closed: returns (false, "dependency <dep> degraded — fail-closed").
func (s *Strategy) ShouldAllow(dep Dep) (bool, string) {
	if s.IsHealthy(dep) {
		return true, ""
	}
	mode := s.ModeFor(dep)
	reason := fmt.Sprintf("dependency %s degraded — fail-%s", dep, mode)
	return mode == ModeOpen, reason
}

// Status returns a snapshot of all dependency health for observability.
func (s *Strategy) Status() map[string]map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]map[string]any, len(s.status))
	for dep, ds := range s.status {
		out[string(dep)] = map[string]any{
			"healthy":    ds.healthy,
			"failures":   ds.failures,
			"last_check": ds.lastCheck,
			"mode":       string(s.ModeFor(dep)),
		}
	}
	return out
}
