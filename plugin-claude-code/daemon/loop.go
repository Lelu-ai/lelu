package daemon

import (
	"sync"
	"time"
)

// LoopConfig controls retry-storm detection: the same exact action,
// repeated too many times too quickly within one session — the signature
// behind runaway loops and unbounded sub-agent recursion, as distinct from
// any single action being dangerous on its own.
type LoopConfig struct {
	Enabled         bool `json:"enabled"`
	RepeatThreshold int  `json:"repeat_threshold"`
	WindowSeconds   int  `json:"window_seconds"`
}

type loopEvent struct {
	key string
	ts  time.Time
}

// LoopTracker keeps a short rolling history of recent actions per session in
// memory. It's process-local and non-persistent by design — restarting the
// daemon resetting the count is an acceptable tradeoff for not needing a
// database for something this small, and a self-start right after a crash
// (see lelu-hook) is exactly the situation where forgiving a fresh count is
// the friendlier failure mode anyway.
type LoopTracker struct {
	mu      sync.Mutex
	history map[string][]loopEvent
}

func NewLoopTracker() *LoopTracker {
	return &LoopTracker{history: make(map[string][]loopEvent)}
}

// Check records this action under (sessionID, key) and reports whether it
// has now recurred at least cfg.RepeatThreshold times within the trailing
// cfg.WindowSeconds for that session.
func (lt *LoopTracker) Check(cfg LoopConfig, sessionID, key string, now time.Time) (isLoop bool, count int) {
	if !cfg.Enabled || sessionID == "" || key == "" {
		return false, 0
	}

	lt.mu.Lock()
	defer lt.mu.Unlock()

	cutoff := now.Add(-time.Duration(cfg.WindowSeconds) * time.Second)

	kept := lt.history[sessionID][:0]
	for _, e := range lt.history[sessionID] {
		if e.ts.After(cutoff) {
			kept = append(kept, e)
		}
	}
	kept = append(kept, loopEvent{key: key, ts: now})
	lt.history[sessionID] = kept

	for _, e := range kept {
		if e.key == key {
			count++
		}
	}

	return count >= cfg.RepeatThreshold, count
}

// LoopKey builds the identity a repeated action is tracked under — the
// exact tool + exact command/path, not a fuzzy similarity match. Exact
// repetition is the actual signature seen in the real runaway-loop and
// recursive-sub-agent issues this is meant to catch.
func LoopKey(req Request) string {
	switch req.Tool {
	case "Bash":
		return "Bash:" + req.Command
	case "Edit", "Write":
		return req.Tool + ":" + req.FilePath
	default:
		return ""
	}
}
