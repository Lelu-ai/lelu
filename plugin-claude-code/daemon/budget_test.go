package daemon

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// writeTranscriptFixture writes a minimal two-line transcript — a first
// entry at `first` and a last entry at `last` — matching the shape of a
// real Claude Code transcript's entries (verified against an actual
// ~/.claude/projects/.../<session>.jsonl file): a top-level "timestamp"
// field is all EvaluateSessionBudget actually reads.
func writeTranscriptFixture(t *testing.T, dir string, first, last time.Time) string {
	t.Helper()
	path := filepath.Join(dir, "transcript.jsonl")
	line := func(ts time.Time) string {
		return `{"type":"queue-operation","operation":"enqueue","timestamp":"` +
			ts.UTC().Format(time.RFC3339Nano) + `","sessionId":"s1"}` + "\n"
	}
	content := line(first) + line(last)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestBudget_UnderThresholdNotExceeded(t *testing.T) {
	bt := NewBudgetTracker()
	dir := t.TempDir()
	// Started 30 minutes ago, still active now.
	transcript := writeTranscriptFixture(t, dir, time.Now().Add(-30*time.Minute), time.Now())
	cfg := SessionBudgetConfig{Enabled: true, MaxDurationSecs: 4 * 3600}

	exceeded, _ := bt.EvaluateSessionBudget(cfg, "s1", transcript, time.Now())
	if exceeded {
		t.Errorf("a 30-minute-old session should not exceed a 4-hour budget")
	}
}

func TestBudget_OverThresholdAndCurrentlyActiveExceeded(t *testing.T) {
	bt := NewBudgetTracker()
	dir := t.TempDir()
	// Started 26 hours ago (the real verified incident) and still active now.
	transcript := writeTranscriptFixture(t, dir, time.Now().Add(-26*time.Hour), time.Now())
	cfg := SessionBudgetConfig{Enabled: true, MaxDurationSecs: 4 * 3600}

	exceeded, span := bt.EvaluateSessionBudget(cfg, "s1", transcript, time.Now())
	if !exceeded {
		t.Fatalf("a 26-hour, currently-active session must exceed a 4-hour budget")
	}
	if span < 25*time.Hour {
		t.Errorf("span = %s, want roughly 26h", span)
	}
}

// TestBudget_OldButIdleDoesNotFlag is the case this design exists to avoid:
// a conversation resumed after being idle for days should not immediately
// nag just because its first-ever message is old.
func TestBudget_OldButIdleDoesNotFlag(t *testing.T) {
	bt := NewBudgetTracker()
	dir := t.TempDir()
	// First message 8 days ago, last activity ALSO 8 days ago (long idle since).
	eightDaysAgo := time.Now().Add(-8 * 24 * time.Hour)
	transcript := writeTranscriptFixture(t, dir, eightDaysAgo, eightDaysAgo.Add(2*time.Minute))
	cfg := SessionBudgetConfig{Enabled: true, MaxDurationSecs: 4 * 3600}

	exceeded, _ := bt.EvaluateSessionBudget(cfg, "s1", transcript, time.Now())
	if exceeded {
		t.Errorf("a session idle for days should not flag just because it's old — only currently-active sessions should")
	}
}

func TestBudget_OnlyFlagsOncePerSession(t *testing.T) {
	bt := NewBudgetTracker()
	dir := t.TempDir()
	transcript := writeTranscriptFixture(t, dir, time.Now().Add(-26*time.Hour), time.Now())
	cfg := SessionBudgetConfig{Enabled: true, MaxDurationSecs: 4 * 3600}

	first, _ := bt.EvaluateSessionBudget(cfg, "s1", transcript, time.Now())
	if !first {
		t.Fatalf("first check should exceed")
	}
	second, _ := bt.EvaluateSessionBudget(cfg, "s1", transcript, time.Now())
	if second {
		t.Errorf("a session already flagged once should not be flagged again on every subsequent call")
	}
}

func TestBudget_DifferentSessionsFlaggedIndependently(t *testing.T) {
	bt := NewBudgetTracker()
	dir := t.TempDir()
	transcript := writeTranscriptFixture(t, dir, time.Now().Add(-26*time.Hour), time.Now())
	cfg := SessionBudgetConfig{Enabled: true, MaxDurationSecs: 4 * 3600}

	bt.EvaluateSessionBudget(cfg, "session-A", transcript, time.Now())
	exceeded, _ := bt.EvaluateSessionBudget(cfg, "session-B", transcript, time.Now())
	if !exceeded {
		t.Errorf("session-B should be evaluated independently of session-A's already-flagged state")
	}
}

func TestBudget_DisabledNeverFlags(t *testing.T) {
	bt := NewBudgetTracker()
	dir := t.TempDir()
	transcript := writeTranscriptFixture(t, dir, time.Now().Add(-100*time.Hour), time.Now())
	cfg := SessionBudgetConfig{Enabled: false, MaxDurationSecs: 3600}

	exceeded, _ := bt.EvaluateSessionBudget(cfg, "s1", transcript, time.Now())
	if exceeded {
		t.Errorf("disabled session-budget checking must never flag anything")
	}
}

func TestBudget_MissingTranscriptFileNeverFlags(t *testing.T) {
	bt := NewBudgetTracker()
	cfg := SessionBudgetConfig{Enabled: true, MaxDurationSecs: 60}

	exceeded, _ := bt.EvaluateSessionBudget(cfg, "s1", "/no/such/file.jsonl", time.Now())
	if exceeded {
		t.Errorf("a missing/unreadable transcript should fail safe (not exceeded), not crash or false-flag")
	}
}

func TestFirstTranscriptTimestamp_ParsesRealFormat(t *testing.T) {
	dir := t.TempDir()
	want := time.Date(2026, 7, 15, 7, 29, 9, 234000000, time.UTC)
	path := writeTranscriptFixture(t, dir, want, want.Add(time.Minute))

	got, ok := firstTranscriptTimestamp(path)
	if !ok {
		t.Fatal("expected to parse the fixture's first line")
	}
	if !got.Equal(want) {
		t.Errorf("got %s, want %s", got, want)
	}
}

func TestLastTranscriptTimestamp_ParsesRealFormat(t *testing.T) {
	dir := t.TempDir()
	first := time.Date(2026, 7, 15, 7, 29, 9, 234000000, time.UTC)
	want := first.Add(90 * time.Minute)
	path := writeTranscriptFixture(t, dir, first, want)

	got, ok := lastTranscriptTimestamp(path)
	if !ok {
		t.Fatal("expected to parse the fixture's last line")
	}
	if !got.Equal(want) {
		t.Errorf("got %s, want %s", got, want)
	}
}

// TestEngine_LongRunningActiveSessionAsksForReview exercises the full
// Engine path (not just BudgetTracker in isolation) with a fixture
// transcript standing in for the real ~26-hour incident.
func TestEngine_LongRunningActiveSessionAsksForReview(t *testing.T) {
	engine, _ := newTestEngine(t, false)
	dir := t.TempDir()
	transcript := writeTranscriptFixture(t, dir, time.Now().Add(-26*time.Hour), time.Now())

	resp := engine.Decide(Request{
		SessionID: "s1", Tool: "Bash", Command: "echo still going",
		Cwd: "/home/testuser", TranscriptPath: transcript,
		Env: map[string]string{"HOME": "/home/testuser"},
	})

	if resp.Outcome != OutcomeAsk {
		t.Errorf("outcome = %q, want ask for a 26-hour, currently-active session", resp.Outcome)
	}
	if resp.Rule != "session-budget" {
		t.Errorf("rule = %q, want session-budget", resp.Rule)
	}
}

func TestEngine_FreshSessionNeverAsksForBudget(t *testing.T) {
	engine, _ := newTestEngine(t, false)
	dir := t.TempDir()
	transcript := writeTranscriptFixture(t, dir, time.Now(), time.Now())

	resp := engine.Decide(Request{
		SessionID: "s1", Tool: "Bash", Command: "echo just started",
		Cwd: "/home/testuser", TranscriptPath: transcript,
		Env: map[string]string{"HOME": "/home/testuser"},
	})

	if resp.Outcome != OutcomeAllow {
		t.Errorf("outcome = %q, want allow for a session that just started", resp.Outcome)
	}
}

func TestEngine_ResumedOldSessionNeverAsksForBudget(t *testing.T) {
	engine, _ := newTestEngine(t, false)
	dir := t.TempDir()
	eightDaysAgo := time.Now().Add(-8 * 24 * time.Hour)
	transcript := writeTranscriptFixture(t, dir, eightDaysAgo, eightDaysAgo.Add(2*time.Minute))

	resp := engine.Decide(Request{
		SessionID: "s1", Tool: "Bash", Command: "echo resumed after a week",
		Cwd: "/home/testuser", TranscriptPath: transcript,
		Env: map[string]string{"HOME": "/home/testuser"},
	})

	if resp.Outcome != OutcomeAllow {
		t.Errorf("outcome = %q, want allow — an old conversation resumed after being idle is not a runaway session", resp.Outcome)
	}
}
