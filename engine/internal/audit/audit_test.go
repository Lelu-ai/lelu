package audit

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"sync"
	"testing"
	"time"
)

// testKey returns a shared 2048-bit RSA key, generated once per test binary
// run rather than once per test — key generation is the slow part of these
// tests and the key material itself isn't what's under test.
var (
	testKeyOnce sync.Once
	sharedKey   *rsa.PrivateKey
)

func testKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	testKeyOnce.Do(func() {
		k, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			panic(err)
		}
		sharedKey = k
	})
	return sharedKey
}

// writeAndClose runs a Writer against buf with the given signer (nil for
// unsigned), logs each event, then closes — Close() drains the queue and
// waits for the background goroutine to finish, so reading buf afterward is
// race-free without any sleep/poll.
func writeAndClose(t *testing.T, signer *rsa.PrivateKey, keyID string, events []Event) []Event {
	t.Helper()
	buf := &bytes.Buffer{}
	w := New(Config{BatchSize: 1, FlushEvery: time.Hour, Sink: buf})
	if signer != nil {
		w.SetSigner(signer, keyID)
	}
	for _, e := range events {
		w.Log(e)
	}
	w.Close()

	var out []Event
	dec := json.NewDecoder(buf)
	for dec.More() {
		var e Event
		if err := dec.Decode(&e); err != nil {
			t.Fatalf("decode written event: %v", err)
		}
		out = append(out, e)
	}
	if len(out) != len(events) {
		t.Fatalf("wrote %d events, decoded %d", len(events), len(out))
	}
	return out
}

func chainOf(n int) []Event {
	events := make([]Event, n)
	for i := range events {
		events[i] = Event{
			Actor:     "actor",
			Action:    "action",
			Decision:  "allowed",
			InputHash: "hash-in",
		}
	}
	return events
}

func TestSignEvent_RoundTripVerifies(t *testing.T) {
	key := testKey(t)
	kid, err := DeriveKeyID(&key.PublicKey)
	if err != nil {
		t.Fatalf("DeriveKeyID: %v", err)
	}

	written := writeAndClose(t, key, kid, chainOf(3))

	for i, e := range written {
		if e.Signature == "" {
			t.Fatalf("event %d: Signature is empty, signing did not run", i)
		}
		if e.KeyID != kid {
			t.Fatalf("event %d: KeyID = %q, want %q", i, e.KeyID, kid)
		}
	}

	if bad := VerifyChain(written, &key.PublicKey, ""); bad != -1 {
		t.Fatalf("VerifyChain on an untampered chain failed at index %d", bad)
	}
}

func TestWriter_NoSigner_EventsUnsignedAndBackwardCompatible(t *testing.T) {
	written := writeAndClose(t, nil, "", chainOf(2))
	for i, e := range written {
		if e.Signature != "" || e.PrevHash != "" || e.KeyID != "" {
			t.Fatalf("event %d: expected no receipt fields without SetSigner, got Signature=%q PrevHash=%q KeyID=%q",
				i, e.Signature, e.PrevHash, e.KeyID)
		}
	}
}

func TestVerifyChain_DetectsContentTampering(t *testing.T) {
	key := testKey(t)
	kid, _ := DeriveKeyID(&key.PublicKey)
	written := writeAndClose(t, key, kid, chainOf(3))

	// Mutate the middle event's content after signing — the signature was
	// computed over the original Reason, not this one.
	written[1].Reason = "an attacker's version of events"

	bad := VerifyChain(written, &key.PublicKey, "")
	if bad != 1 {
		t.Fatalf("VerifyChain on a tampered event = %d, want 1 (the mutated event)", bad)
	}
}

func TestVerifyChain_DetectsDeletedEvent(t *testing.T) {
	key := testKey(t)
	kid, _ := DeriveKeyID(&key.PublicKey)
	written := writeAndClose(t, key, kid, chainOf(3))

	// Each event still verifies individually if kept in isolation — deletion
	// is only visible as a break in the chain, not a broken signature. Drop
	// the middle event and confirm the gap is caught.
	withGap := []Event{written[0], written[2]}

	bad := VerifyChain(withGap, &key.PublicKey, "")
	if bad != 1 {
		t.Fatalf("VerifyChain across a deleted event = %d, want 1 (PrevHash mismatch at the gap)", bad)
	}
}

func TestVerifyChain_RejectsWrongKey(t *testing.T) {
	key := testKey(t)
	kid, _ := DeriveKeyID(&key.PublicKey)
	written := writeAndClose(t, key, kid, chainOf(1))

	otherKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate second key: %v", err)
	}

	if bad := VerifyChain(written, &otherKey.PublicKey, ""); bad != 0 {
		t.Fatalf("VerifyChain against the wrong public key = %d, want 0 (signature must not verify)", bad)
	}
}

func TestDeriveKeyID_DeterministicAndDistinct(t *testing.T) {
	key := testKey(t)
	kid1, err := DeriveKeyID(&key.PublicKey)
	if err != nil {
		t.Fatalf("DeriveKeyID: %v", err)
	}
	kid2, err := DeriveKeyID(&key.PublicKey)
	if err != nil {
		t.Fatalf("DeriveKeyID: %v", err)
	}
	if kid1 != kid2 {
		t.Fatalf("DeriveKeyID not deterministic: %q != %q", kid1, kid2)
	}

	otherKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate second key: %v", err)
	}
	kid3, err := DeriveKeyID(&otherKey.PublicKey)
	if err != nil {
		t.Fatalf("DeriveKeyID: %v", err)
	}
	if kid1 == kid3 {
		t.Fatalf("DeriveKeyID produced the same kid for two different keys")
	}
}
