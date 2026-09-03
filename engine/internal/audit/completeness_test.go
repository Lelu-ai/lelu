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
// was full must still have consumed a sequence number, so the gap is visible
// to a verifier. Assigning the number in the flush loop instead would mean a
// dropped event leaves no evidence anywhere and a fully verified chain can be
// missing most of the decisions the engine made.
func TestSeq_AssignedBeforeDrop(t *testing.T) {
	buf := &bytes.Buffer{}
	// Depth 1 with a flush interval long enough that the writer will not
	// drain: everything after the first couple of events is dropped.
	w := New(Config{QueueDepth: 1, BatchSize: 100, FlushEvery: time.Hour, Sink: buf})

	const total = 200
	for i := 0; i < total; i++ {
		w.Log(Event{Actor: "bot", Action: "act", Decision: "allowed"})
	}
	w.Close()

	if w.Dropped() == 0 {
		t.Skip("writer drained faster than the test could fill it; nothing to assert")
	}

	written := decodeEvents(t, buf)
	if len(written) == 0 {
		t.Fatal("expected at least one written event")
	}

	// The highest sequence number seen must account for every event created,
	// not just the ones that survived.
	var maxSeq uint64
	for _, e := range written {
		if e.Seq == 0 {
			t.Fatal("every event must carry a sequence number")
		}
		if e.Seq > maxSeq {
			maxSeq = e.Seq
		}
	}

	// Gap counting needs no key: these events are unsigned.
	_, missing, unnumbered := SeqGaps(written)
	if unnumbered != 0 {
		t.Fatalf("%d events carried no sequence number", unnumbered)
	}
	if uint64(len(written))+missing < maxSeq {
		t.Fatalf("gap accounting is incomplete: %d written + %d missing < highest seq %d",
			len(written), missing, maxSeq)
	}
	if missing == 0 {
		t.Fatal("events were dropped but no sequence gaps are reported — absence must be countable")
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
