package audit

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// Regressions for the audit findings in Nate Howard's dynamic review
// (A1, A2, A4).

// TestSeq_AssignedBeforeDrop covers A2/A4. An event dropped because the queue
// was full must still have consumed a sequence number, so that every event the
// engine created is accounted for — either present in the log, or identifiable
// as absent.
//
// The assertion is deliberately about accounting rather than about gaps.
// Whether a drop shows up as an internal gap or as a shortfall against the
// high-water mark depends on scheduling: if the last events logged are the
// ones dropped, there is no following event to reveal a gap. Both are losses
// and both must be countable, which is exactly why the high-water mark is part
// of verification.
func TestSeq_AssignedBeforeDrop(t *testing.T) {
	buf := &bytes.Buffer{}
	// Depth 1 with a long flush interval: the writer cannot keep up, so most
	// events are dropped.
	w := New(Config{QueueDepth: 1, BatchSize: 100, FlushEvery: time.Hour, Sink: buf})

	const total = 200
	for i := 0; i < total; i++ {
		w.Log(Event{Actor: "bot", Action: "act", Decision: "allowed"})
	}
	highWater := w.HighWater()
	w.Close()

	if highWater != total {
		t.Fatalf("high-water mark is %d, want %d — every event must consume a number before it can be dropped", highWater, total)
	}
	if w.Dropped() == 0 {
		t.Skip("writer kept up; nothing was dropped, so there is no loss to account for")
	}

	written := decodeEvents(t, buf)
	if len(written) == 0 {
		t.Fatal("expected at least one written event")
	}
	for _, e := range written {
		if e.Seq == 0 {
			t.Fatal("every event must carry a sequence number")
		}
	}

	rep := VerifyChainReportAt(written, nil, "", highWater)
	if rep.Unnumbered != 0 {
		t.Fatalf("%d events carried no sequence number", rep.Unnumbered)
	}

	// Everything the engine created is either in the log, missing between two
	// events, or missing from the end. Nothing may be unaccounted for.
	accounted := uint64(len(written)) + rep.Missing + rep.Truncated
	if accounted != highWater {
		t.Fatalf("%d events created, but only %d accounted for (%d written + %d gaps + %d truncated)",
			highWater, accounted, len(written), rep.Missing, rep.Truncated)
	}
	if rep.Missing+rep.Truncated == 0 {
		t.Fatal("events were dropped but the report accounts for no loss at all")
	}
	if rep.Complete() {
		t.Fatal("a log with dropped events must never report Complete()")
	}
}

// TestVerifyChainReport_DetectsTruncation covers the case sequence gaps alone
// cannot: events removed from the *end* of a log. There is no following event
// to reveal the absence, so without the writer's high-water mark a truncated
// log is indistinguishable from a log that simply ended earlier — which is the
// easiest and most attractive tampering there is, since the newest records are
// the incriminating ones.
func TestVerifyChainReport_DetectsTruncation(t *testing.T) {
	key := testKey(t)
	buf := &bytes.Buffer{}
	w := New(Config{BatchSize: 1, FlushEvery: time.Hour, Sink: buf})
	w.SetSigner(key, "kid-1")
	for i := 0; i < 6; i++ {
		w.Log(Event{Actor: "bot", Action: "act", Decision: "allowed"})
	}
	highWater := w.HighWater()
	w.Close()

	events := decodeEvents(t, buf)
	if len(events) != 6 {
		t.Fatalf("expected 6 events, got %d", len(events))
	}

	// Cut the last two. Every remaining link still verifies.
	truncated := events[:4]

	blind := VerifyChainReport(truncated, &key.PublicKey, "")
	if blind.FirstInvalidIndex != -1 || blind.Missing != 0 {
		t.Fatal("truncation should leave the remaining chain intact — that is the whole problem")
	}
	if blind.Complete() {
		t.Fatal("a report with no high-water mark must not claim completeness")
	}

	seeing := VerifyChainReportAt(truncated, &key.PublicKey, "", highWater)
	if seeing.Truncated != 2 {
		t.Fatalf("expected 2 truncated events, got %d", seeing.Truncated)
	}
	if seeing.Complete() {
		t.Fatal("a truncated log must not report Complete()")
	}

	// The untouched log, checked the same way, must pass.
	whole := VerifyChainReportAt(events, &key.PublicKey, "", highWater)
	if !whole.Complete() {
		t.Fatalf("an intact log must report Complete(): %+v", whole)
	}
}

// TestChainState_SurvivesRestart covers A1. Without persisted continuity every
// process start opens a fresh genesis, and deleting one process lifetime's
// worth of events yields a log that is structurally identical to an honest
// log with one fewer restart — every remaining chain verifies.
func TestChainState_SurvivesRestart(t *testing.T) {
	key := testKey(t)
	dir := t.TempDir()
	statePath := filepath.Join(dir, "audit-chain.json")

	first := &bytes.Buffer{}
	w1 := New(Config{BatchSize: 1, FlushEvery: time.Hour, Sink: first, StatePath: statePath})
	w1.SetSigner(key, "kid-1")
	w1.Log(Event{Actor: "bot", Action: "pre-restart", Decision: "allowed"})
	w1.Close()

	if _, err := os.Stat(statePath); err != nil {
		t.Fatalf("chain state was not persisted: %v", err)
	}

	second := &bytes.Buffer{}
	w2 := New(Config{BatchSize: 1, FlushEvery: time.Hour, Sink: second, StatePath: statePath})
	w2.SetSigner(key, "kid-1")
	w2.Log(Event{Actor: "bot", Action: "post-restart", Decision: "allowed"})
	w2.Close()

	before := decodeEvents(t, first)
	after := decodeEvents(t, second)
	if len(before) != 1 || len(after) != 1 {
		t.Fatalf("expected one event per lifetime, got %d and %d", len(before), len(after))
	}

	if after[0].PrevHash == "" {
		t.Fatal("the event after a restart opened a fresh genesis: prev_hash is empty")
	}
	if after[0].Seq <= before[0].Seq {
		t.Fatalf("sequence restarted across processes: %d then %d", before[0].Seq, after[0].Seq)
	}

	// The two lifetimes must verify as one continuous chain.
	whole := append(append([]Event{}, before...), after...)
	if bad := VerifyChain(whole, &key.PublicKey, ""); bad != -1 {
		t.Fatalf("chain across a restart failed at index %d; it must be continuous", bad)
	}
}

// TestVerifyChainReport_SeesDeletedEpoch is the tampering case A1 describes:
// with a continuous chain, removing events breaks verification instead of
// looking like an extra restart.
func TestVerifyChainReport_SeesDeletedEpoch(t *testing.T) {
	key := testKey(t)
	statePath := filepath.Join(t.TempDir(), "chain.json")

	buf := &bytes.Buffer{}
	w := New(Config{BatchSize: 1, FlushEvery: time.Hour, Sink: buf, StatePath: statePath})
	w.SetSigner(key, "kid-1")
	for i := 0; i < 6; i++ {
		w.Log(Event{Actor: "bot", Action: "act", Decision: "allowed"})
	}
	w.Close()

	events := decodeEvents(t, buf)
	if len(events) != 6 {
		t.Fatalf("expected 6 events, got %d", len(events))
	}

	tampered := append(append([]Event{}, events[:2]...), events[4:]...)
	rep := VerifyChainReport(tampered, &key.PublicKey, "")
	if rep.FirstInvalidIndex == -1 {
		t.Fatal("deleting events left the chain verifiable")
	}
	if rep.Missing != 2 {
		t.Fatalf("expected 2 missing sequence numbers, got %d", rep.Missing)
	}
}

func decodeEvents(t *testing.T, buf *bytes.Buffer) []Event {
	t.Helper()
	var out []Event
	dec := json.NewDecoder(bytes.NewReader(buf.Bytes()))
	for dec.More() {
		var e Event
		if err := dec.Decode(&e); err != nil {
			t.Fatalf("decode written event: %v", err)
		}
		// Skip the writer's own diagnostic lines, which are not Events.
		if e.Decision == "" && e.Actor == "" {
			continue
		}
		out = append(out, e)
	}
	return out
}
