package daemon

import (
	"testing"
	"time"
)

func TestLoopTracker_FlagsAfterThreshold(t *testing.T) {
	lt := NewLoopTracker()
	cfg := LoopConfig{Enabled: true, RepeatThreshold: 3, WindowSeconds: 60}
	now := time.Now()

	for i := 0; i < 2; i++ {
		isLoop, count := lt.Check(cfg, "s1", "Bash:rm -rf build", now)
		if isLoop {
			t.Fatalf("call %d: flagged as loop too early (count=%d)", i+1, count)
		}
	}

	isLoop, count := lt.Check(cfg, "s1", "Bash:rm -rf build", now)
	if !isLoop {
		t.Errorf("3rd identical call should trigger the loop flag, got count=%d", count)
	}
	if count != 3 {
		t.Errorf("count = %d, want 3", count)
	}
}

func TestLoopTracker_DifferentCommandsDoNotAccumulate(t *testing.T) {
	lt := NewLoopTracker()
	cfg := LoopConfig{Enabled: true, RepeatThreshold: 3, WindowSeconds: 60}
	now := time.Now()

	cmds := []string{"Bash:ls", "Bash:pwd", "Bash:whoami"}
	for _, c := range cmds {
		if isLoop, _ := lt.Check(cfg, "s1", c, now); isLoop {
			t.Errorf("distinct commands should never trigger loop detection: %q", c)
		}
	}
}

func TestLoopTracker_DifferentSessionsTrackedIndependently(t *testing.T) {
	lt := NewLoopTracker()
	cfg := LoopConfig{Enabled: true, RepeatThreshold: 2, WindowSeconds: 60}
	now := time.Now()

	lt.Check(cfg, "session-A", "Bash:rm -rf x", now)
	// session-B's first occurrence of the same key should not inherit session-A's count.
	isLoop, count := lt.Check(cfg, "session-B", "Bash:rm -rf x", now)
	if isLoop {
		t.Errorf("session-B should start with its own fresh count, got isLoop=true count=%d", count)
	}
}

func TestLoopTracker_OldEventsOutsideWindowDoNotCount(t *testing.T) {
	lt := NewLoopTracker()
	cfg := LoopConfig{Enabled: true, RepeatThreshold: 2, WindowSeconds: 5}
	base := time.Now()

	lt.Check(cfg, "s1", "Bash:poll", base)
	// second occurrence well outside the 5s window
	isLoop, count := lt.Check(cfg, "s1", "Bash:poll", base.Add(1*time.Hour))
	if isLoop {
		t.Errorf("events outside the window should not accumulate, got count=%d", count)
	}
}

func TestLoopTracker_DisabledNeverFlags(t *testing.T) {
	lt := NewLoopTracker()
	cfg := LoopConfig{Enabled: false, RepeatThreshold: 1, WindowSeconds: 60}
	now := time.Now()

	for i := 0; i < 5; i++ {
		if isLoop, _ := lt.Check(cfg, "s1", "Bash:x", now); isLoop {
			t.Fatalf("disabled loop detection must never flag anything")
		}
	}
}

func TestLoopKey_BashUsesCommand(t *testing.T) {
	got := LoopKey(Request{Tool: "Bash", Command: "ls -la"})
	if got != "Bash:ls -la" {
		t.Errorf("LoopKey = %q", got)
	}
}

func TestLoopKey_EditUsesFilePath(t *testing.T) {
	got := LoopKey(Request{Tool: "Edit", FilePath: "/tmp/foo.txt"})
	if got != "Edit:/tmp/foo.txt" {
		t.Errorf("LoopKey = %q", got)
	}
}

func TestLoopKey_UnknownToolEmpty(t *testing.T) {
	got := LoopKey(Request{Tool: "mcp__something"})
	if got != "" {
		t.Errorf("LoopKey for an untracked tool should be empty, got %q", got)
	}
}
