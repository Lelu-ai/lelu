// Package audit provides a non-blocking, buffered audit log pipeline.
// Events are queued in-memory and flushed to an output sink in batches
// on a background goroutine, keeping the hot path latency near zero.
package audit

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ─── Event ────────────────────────────────────────────────────────────────────

// Event represents a single immutable audit record.
type Event struct {
	TenantID        string            `json:"tenant_id,omitempty"`
	TraceID         string            `json:"trace_id"`
	Timestamp       time.Time         `json:"timestamp"`
	Actor           string            `json:"actor"`
	Action          string            `json:"action"`
	Resource        map[string]string `json:"resource,omitempty"`
	ConfidenceScore float64           `json:"confidence_score,omitempty"`
	// ConfidenceVerified is true only when ConfidenceScore came from a verified
	// provider signal rather than a self-reported/unverified fallback.
	ConfidenceVerified bool `json:"confidence_verified,omitempty"`
	// ActorVerified is true only when Actor came from a signed WorkloadToken
	// validated against the identity registry, not the self-reported "actor"
	// field.
	ActorVerified   bool    `json:"actor_verified,omitempty"`
	Decision        string  `json:"decision"` // "allowed" | "denied" | "human_review" | "compute" | "shadow_detected"
	Reason          string  `json:"reason,omitempty"`
	DowngradedScope string  `json:"downgraded_scope,omitempty"`
	LatencyMS       float64 `json:"latency_ms"`
	// InputHash is the SHA-256 of the normalized request payload — tamper-proof
	// record of exactly what the agent asked for.
	InputHash string `json:"input_hash,omitempty"`
	// OutputHash is the SHA-256 of the serialized decision — tamper-proof record
	// of exactly what was decided and why.
	OutputHash string `json:"output_hash,omitempty"`
	// PolicyDigest is the SHA-256 of the policy bytes active at evaluation time,
	// proving which policy version authorized this decision.
	PolicyDigest string `json:"policy_digest,omitempty"`

	// ─── Receipt fields (AARM R5/R6) — populated only when the Writer has a
	// signer configured via SetSigner(); zero-valued otherwise, so an
	// unsigned deployment's events are unchanged from before this field
	// existed. See the "Receipts" section below for what these do and don't
	// establish on their own.
	//
	// PrevHash chains this event to the one immediately before it in this
	// Writer's own flush order, so deleting or reordering an event breaks the
	// chain at a detectable point — content tampering alone (leaving the
	// chain intact) is caught by Signature instead.
	PrevHash string `json:"prev_hash,omitempty"`
	// Signature is an RS256 signature (base64url, unpadded) over the
	// JSON-encoded receiptCore for this event — never over a hand-built
	// delimited string. A receipt's evidentiary value depends on an
	// unambiguous canonical encoding; see canonicalizeReceipt for why that's
	// JSON and not string concatenation.
	Signature string `json:"signature,omitempty"`
	// KeyID identifies which public key (from /.well-known/jwks.json)
	// verifies Signature — lets a verifier handle key rotation without
	// guessing which key produced a given event.
	KeyID string `json:"kid,omitempty"`
}

// ─── Writer ───────────────────────────────────────────────────────────────────

// Writer is a non-blocking audit log writer.
type Writer struct {
	queue      chan Event
	sink       io.Writer
	batchSize  int
	flushEvery time.Duration
	wg         sync.WaitGroup
	once       sync.Once

	signerMu sync.RWMutex
	signer   *rsa.PrivateKey
	keyID    string
}

// Config holds constructor options for Writer.
type Config struct {
	QueueDepth int           // channel buffer depth (default 4096)
	BatchSize  int           // max events per flush (default 100)
	FlushEvery time.Duration // flush interval (default 500 ms)
	Sink       io.Writer     // destination (default os.Stdout)
}

// New creates and starts a Writer. Call Close() on shutdown to drain the queue.
func New(cfg ...Config) *Writer {
	c := Config{}
	if len(cfg) > 0 {
		c = cfg[0]
	}
	if c.QueueDepth <= 0 {
		c.QueueDepth = 4096
	}
	if c.BatchSize <= 0 {
		c.BatchSize = 100
	}
	if c.FlushEvery <= 0 {
		c.FlushEvery = 500 * time.Millisecond
	}
	if c.Sink == nil {
		c.Sink = os.Stdout
	}

	w := &Writer{
		queue:      make(chan Event, c.QueueDepth),
		sink:       c.Sink,
		batchSize:  c.BatchSize,
		flushEvery: c.FlushEvery,
	}
	w.start()
	return w
}

// ─── Receipts (AARM R5/R6) ──────────────────────────────────────────────────
//
// What a signed, chained event does and doesn't establish:
//
//   - Signature proves this exact event content was produced by whoever
//     holds the private key for KeyID — not that the underlying decision was
//     correct, only that the record of it wasn't altered after the fact.
//   - PrevHash proves this event's position in a specific sequence produced
//     by this Writer — deleting or reordering an event breaks the chain at a
//     detectable point, even though the deleted event's own signature (if an
//     attacker kept a copy) would still verify in isolation. Signature alone
//     cannot catch deletion; the chain is what catches it.
//   - Neither one proves the decision was delivered to or acted on by the
//     caller — only that the engine recorded it. A receipt is evidence about
//     what the engine decided and logged, not a receipt from the caller
//     that they received it.
//
// SetSigner attaches a receipt signer. Until this is called, events are
// written exactly as before — signing is opt-in and additive, never a
// behavior change for a deployment that doesn't configure it.
//
// v1 reuses whatever RSA key the caller already manages (in practice, the
// same key backing the identity registry's WorkloadTokens) rather than
// provisioning a second one — one key an operator has to generate, persist,
// and rotate is real operational cost, and RS256 signatures over this
// package's JSON receipt shape aren't confusable with an RS256 JWT's shape.
// If key-purpose isolation becomes a real requirement later, mint a
// dedicated key under its own kid in the JWKS set — nothing here assumes
// key reuse, it just doesn't require avoiding it for v1.
func (w *Writer) SetSigner(key *rsa.PrivateKey, keyID string) {
	w.signerMu.Lock()
	defer w.signerMu.Unlock()
	w.signer = key
	w.keyID = keyID
}

// DeriveKeyID computes the same key-fingerprint scheme the identity registry
// uses (SHA-256 of the DER-encoded public key, first 8 bytes, base64url) —
// so a caller reusing the same RSA key for both gets the same kid in both
// places, without this package importing the identity package to share the
// constant.
func DeriveKeyID(pub *rsa.PublicKey) (string, error) {
	der, err := x509.MarshalPKIXPublicKey(pub)
	if err != nil {
		return "", fmt.Errorf("audit: marshal public key: %w", err)
	}
	sum := sha256.Sum256(der)
	return base64.RawURLEncoding.EncodeToString(sum[:8]), nil
}

// receiptCore is the exact, fixed-shape payload that gets signed for each
// event: every substantive Event field except the receipt metadata fields
// themselves (PrevHash is threaded in explicitly as the previous link, not
// copied from the event; Signature and KeyID are outputs of signing, not
// inputs — a field can't usefully sign over itself). Anything not listed
// here is not covered by the signature, so this is deliberately meant to be
// "the whole event," not a curated subset — a narrower core would mean
// tampering with an excluded field (e.g. Reason, the field explaining *why*
// a decision was made) goes undetected while the signature still verifies.
//
// Always JSON-encoded, never hand-concatenated into a delimited string. A
// delimited string ("actor|action|...") is exactly the kind of ambiguous
// canonicalization that lets two different logical events collide onto the
// same signed bytes if a field happens to contain the delimiter; a
// struct-typed JSON encoding with a fixed field set doesn't have that
// failure mode. Map fields (Resource) are safe here because encoding/json
// sorts map keys, so the encoding is deterministic.
type receiptCore struct {
	PrevHash           string            `json:"prev_hash"`
	TenantID           string            `json:"tenant_id"`
	TraceID            string            `json:"trace_id"`
	Timestamp          time.Time         `json:"timestamp"`
	Actor              string            `json:"actor"`
	Action             string            `json:"action"`
	Resource           map[string]string `json:"resource"`
	ConfidenceScore    float64           `json:"confidence_score"`
	ConfidenceVerified bool              `json:"confidence_verified"`
	ActorVerified      bool              `json:"actor_verified"`
	Decision           string            `json:"decision"`
	Reason             string            `json:"reason"`
	DowngradedScope    string            `json:"downgraded_scope"`
	LatencyMS          float64           `json:"latency_ms"`
	InputHash          string            `json:"input_hash"`
	OutputHash         string            `json:"output_hash"`
	PolicyDigest       string            `json:"policy_digest"`
}

func canonicalizeReceipt(e Event, prevHash string) ([]byte, error) {
	return json.Marshal(receiptCore{
		PrevHash:           prevHash,
		TenantID:           e.TenantID,
		TraceID:            e.TraceID,
		Timestamp:          e.Timestamp,
		Actor:              e.Actor,
		Action:             e.Action,
		Resource:           e.Resource,
		ConfidenceScore:    e.ConfidenceScore,
		ConfidenceVerified: e.ConfidenceVerified,
		ActorVerified:      e.ActorVerified,
		Decision:           e.Decision,
		Reason:             e.Reason,
		DowngradedScope:    e.DowngradedScope,
		LatencyMS:          e.LatencyMS,
		InputHash:          e.InputHash,
		OutputHash:         e.OutputHash,
		PolicyDigest:       e.PolicyDigest,
	})
}

// signEvent computes PrevHash/Signature/KeyID for e given the previous
// event's chain hash, and returns e's own chain hash for the next call. Only
// needs key material, not a Writer — kept as a free function so nothing
// about signing depends on Writer's queue/sink machinery. Must only be
// called from a single-threaded context (the flush loop): the chain has no
// meaning if two events could compute their PrevHash concurrently from the
// same prior state.
func signEvent(signer *rsa.PrivateKey, keyID string, e Event, prevHash string) (Event, string, error) {
	core, err := canonicalizeReceipt(e, prevHash)
	if err != nil {
		return e, prevHash, err
	}
	// The chain hash IS the pre-signature digest of this event's core (which
	// itself embeds prevHash) — one hash serves both roles, no need to
	// compute it twice.
	digest := sha256.Sum256(core)
	chainHashHex := base64.RawURLEncoding.EncodeToString(digest[:])

	sig, err := rsa.SignPKCS1v15(rand.Reader, signer, crypto.SHA256, digest[:])
	if err != nil {
		return e, prevHash, fmt.Errorf("audit: sign receipt: %w", err)
	}

	e.PrevHash = prevHash
	e.Signature = base64.RawURLEncoding.EncodeToString(sig)
	e.KeyID = keyID
	return e, chainHashHex, nil
}

// VerifyChain independently checks a sequence of events in flush order
// against a public key: each event's Signature must verify against its own
// receiptCore, and each event's PrevHash must equal the chain hash computed
// from the event immediately before it (the first event's PrevHash is
// checked against genesisPrevHash, typically ""). Returns the index of the
// first event that fails either check, or -1 if the whole sequence verifies.
//
// Deliberately a free function operating only on (events, key) — not a
// Writer method — so a verifier never depends on the engine process that
// produced the log, per the same reasoning that public keys must not arrive
// through the same channel as the receipts they verify: a verifier that can
// only run inside the writer that made the claims isn't independent of them.
func VerifyChain(events []Event, pub *rsa.PublicKey, genesisPrevHash string) int {
	prevHash := genesisPrevHash
	for i, e := range events {
		if e.PrevHash != prevHash {
			return i
		}
		core, err := canonicalizeReceipt(e, e.PrevHash)
		if err != nil {
			return i
		}
		digest := sha256.Sum256(core)
		sig, err := base64.RawURLEncoding.DecodeString(e.Signature)
		if err != nil {
			return i
		}
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, digest[:], sig); err != nil {
			return i
		}
		prevHash = base64.RawURLEncoding.EncodeToString(digest[:])
	}
	return -1
}

// Log enqueues an event. If the queue is full, the event is dropped (non-blocking).
func (w *Writer) Log(e Event) {
	if e.TraceID == "" {
		e.TraceID = uuid.NewString()
	}
	if e.Timestamp.IsZero() {
		e.Timestamp = time.Now().UTC()
	}
	select {
	case w.queue <- e:
	default:
		// queue full — drop rather than block the hot path
	}
}

// Close drains remaining events and shuts down the background goroutine.
func (w *Writer) Close() {
	w.once.Do(func() {
		close(w.queue)
		w.wg.Wait()
	})
}

// ─── Background flush loop ────────────────────────────────────────────────────

func (w *Writer) start() {
	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		ticker := time.NewTicker(w.flushEvery)
		defer ticker.Stop()
		buf := make([]Event, 0, w.batchSize)
		// lastHash persists across flush calls for the life of this Writer —
		// the chain covers every event this process has ever emitted, not
		// just the current batch.
		lastHash := ""

		flush := func() {
			if len(buf) == 0 {
				return
			}
			// Snapshot the signer once per flush rather than per event —
			// it's set once at startup in practice, and reading it under
			// lock for every event in a batch would be pure overhead.
			w.signerMu.RLock()
			signer, keyID := w.signer, w.keyID
			w.signerMu.RUnlock()

			for _, e := range buf {
				if signer != nil {
					signed, chainHash, err := signEvent(signer, keyID, e, lastHash)
					if err != nil {
						fmt.Fprintf(w.sink, `{"error":"audit sign failed","trace_id":%q,"detail":%q}`+"\n", e.TraceID, err.Error())
					} else {
						e = signed
						lastHash = chainHash
					}
				}
				b, err := json.Marshal(e)
				if err != nil {
					fmt.Fprintf(w.sink, `{"error":"audit marshal failed","trace_id":%q}`+"\n", e.TraceID)
					continue
				}
				fmt.Fprintf(w.sink, "%s\n", b)
			}
			buf = buf[:0]
		}

		for {
			select {
			case e, ok := <-w.queue:
				if !ok {
					flush()
					return
				}
				buf = append(buf, e)
				if len(buf) >= w.batchSize {
					flush()
				}
			case <-ticker.C:
				flush()
			}
		}
	}()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// NewTraceID generates a fresh trace ID.
func NewTraceID() string { return uuid.NewString() }

// LogFromContext is a convenience wrapper that populates common fields.
func (w *Writer) LogDecision(_ context.Context, tenantID, actor, action string, resource map[string]string, allowed bool, reason string, conf float64, latencyMS float64) {
	decision := "denied"
	if allowed {
		decision = "allowed"
	}
	w.Log(Event{
		TenantID:        tenantID,
		Actor:           actor,
		Action:          action,
		Resource:        resource,
		ConfidenceScore: conf,
		Decision:        decision,
		Reason:          reason,
		LatencyMS:       latencyMS,
	})
}
