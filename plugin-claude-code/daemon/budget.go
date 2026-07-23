package daemon

import (
	"bufio"
	"encoding/json"
	"io"
	"os"
	"strings"
	"sync"
	"time"
)

// SessionBudgetConfig guards against the other verified real-world failure
// mode this plugin targets alongside data loss: a session left running far
// longer than any interactive task would need (the real, reported "$6,000
// burned overnight" incident ran for ~26 hours unattended). This checks
// wall-clock elapsed time only, not token/dollar cost — see the note on
// EvaluateSessionBudget for why.
type SessionBudgetConfig struct {
	Enabled         bool `json:"enabled"`
	MaxDurationSecs int  `json:"max_duration_seconds"`
}

// recentActivityWindow bounds how "live" the session has to be right now
// for a long total span to count. Without this, a conversation resumed
// after being idle overnight or over a weekend — completely ordinary, not a
// runaway anything — would trip the budget on its very first command back,
// since the gap between its first-ever message and now is large regardless
// of how much of that time was actually idle. Requiring recent activity
// targets what the incident actually was: continuous execution, not an old
// conversation being picked back up.
const recentActivityWindow = 30 * time.Minute

// BudgetTracker remembers which sessions have already been flagged, so a
// long-running session gets one review prompt instead of one on every
// single subsequent tool call.
type BudgetTracker struct {
	mu      sync.Mutex
	flagged map[string]bool
}

func NewBudgetTracker() *BudgetTracker {
	return &BudgetTracker{flagged: make(map[string]bool)}
}

// EvaluateSessionBudget reports whether this session both (a) has been
// active within the last recentActivityWindow, and (b) spans more than the
// configured budget from its first recorded message to its most recent one.
// Both conditions matter: (a) alone would fire on any old session merely
// because it's being used right now; (b) alone would fire on a session
// resumed after days idle even though nothing has actually been running.
//
// Deliberately wall-clock only, not a token/dollar budget: an accurate cost
// figure needs per-model, per-token-type pricing (cache-read tokens cost
// far less than fresh input, output tokens differ again), which turns this
// from a policy heuristic into a billing engine. Wall-clock span is read
// from two small slices of the transcript (its first line and a tail
// chunk) rather than a full-file scan repeated on every tool call, and
// alone would have caught the verified 26-hour incident this targets.
//
// Known remaining gap, stated rather than hidden: this can't distinguish
// "continuously running for 8 hours straight" from "used in several short
// bursts spread across 8 hours with idle gaps in between" — both show the
// same first-to-last span. Catching only true continuous-runtime would
// need scanning every entry for gaps, which brings back the full-file-scan
// cost this design exists to avoid. The tradeoff favors the common case:
// a rare, one-time, non-blocking notice on a long multi-burst session is a
// low-cost false positive; nagging on every ordinary resumed conversation
// is a real and much more common annoyance the idle gate above prevents.
func (bt *BudgetTracker) EvaluateSessionBudget(cfg SessionBudgetConfig, sessionID, transcriptPath string, now time.Time) (exceeded bool, span time.Duration) {
	if !cfg.Enabled || sessionID == "" || transcriptPath == "" {
		return false, 0
	}

	bt.mu.Lock()
	alreadyFlagged := bt.flagged[sessionID]
	bt.mu.Unlock()
	if alreadyFlagged {
		return false, 0
	}

	first, ok := firstTranscriptTimestamp(transcriptPath)
	if !ok {
		return false, 0
	}
	last, ok := lastTranscriptTimestamp(transcriptPath)
	if !ok {
		return false, 0
	}

	if now.Sub(last) > recentActivityWindow {
		return false, 0 // not currently active — a resumed/dormant session, not a live runaway
	}

	span = last.Sub(first)
	if span < time.Duration(cfg.MaxDurationSecs)*time.Second {
		return false, span
	}

	bt.mu.Lock()
	bt.flagged[sessionID] = true
	bt.mu.Unlock()

	return true, span
}

// firstTranscriptTimestamp reads only the first line of the transcript —
// every entry type (queue-operation, user, assistant, ...) carries a
// top-level "timestamp" field, so this is a fixed, small read regardless of
// how large the session has grown, not a scan of the whole file.
func firstTranscriptTimestamp(path string) (time.Time, bool) {
	f, err := os.Open(path)
	if err != nil {
		return time.Time{}, false
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024) // transcript lines can be large (e.g. thinking blocks)
	if !scanner.Scan() {
		return time.Time{}, false
	}
	return parseTranscriptTimestamp(scanner.Bytes())
}

// lastTranscriptTimestamp reads only a tail chunk of the file — enough to
// contain at least one complete line even when the final entries are large
// — and returns the last parseable timestamp found in it, walking backward
// so a malformed or fielless trailing line doesn't block older ones in the
// same chunk.
func lastTranscriptTimestamp(path string) (time.Time, bool) {
	const tailSize = 256 * 1024

	f, err := os.Open(path)
	if err != nil {
		return time.Time{}, false
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return time.Time{}, false
	}

	offset := int64(0)
	if info.Size() > tailSize {
		offset = info.Size() - tailSize
	}
	if _, err := f.Seek(offset, io.SeekStart); err != nil {
		return time.Time{}, false
	}

	data, err := io.ReadAll(f)
	if err != nil {
		return time.Time{}, false
	}

	lines := strings.Split(strings.TrimRight(string(data), "\n"), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		if ts, ok := parseTranscriptTimestamp([]byte(lines[i])); ok {
			return ts, true
		}
	}
	return time.Time{}, false
}

func parseTranscriptTimestamp(line []byte) (time.Time, bool) {
	var entry struct {
		Timestamp string `json:"timestamp"`
	}
	if err := json.Unmarshal(line, &entry); err != nil || entry.Timestamp == "" {
		return time.Time{}, false
	}
	ts, err := time.Parse(time.RFC3339, entry.Timestamp)
	if err != nil {
		return time.Time{}, false
	}
	return ts, true
}
