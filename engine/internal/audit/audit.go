// Package audit provides a buffered audit log pipeline with signed, chained
// receipts.
//
// Events are queued in-memory and flushed to an output sink in batches on a
// background goroutine, keeping the hot path latency near zero. Three
// properties exist specifically so that a "verified" chain means something an
// auditor can rely on:
//
//   - Every event gets a monotonic Seq at Log() time, before any drop or
//     buffering decision. A verifier that sees 1,2,3,7 knows three events are
//     missing. Without this the chain is blind by construction: a dropped
//     event never reaches the flush loop, so the chain never records a gap and
//     VerifyChain returns VERIFIED over an arbitrarily incomplete log.
//   - The chain survives the process. lastHash and the sequence high-water
//     mark are persisted (Config.StatePath) and reloaded on start, so a
//     restart continues the existing chain instead of opening a fresh genesis.
//     Without this, deleting a whole epoch of events is indistinguishable from
//     an honest restart, because every remaining epoch still verifies from its
//     own genesis.
//   - Drops are counted and reportable (Dropped()), so an operator can see the
//     gap rather than infer it from a metric mismatch.
//
// See Nate Howard's dynamic review, findings A1–A5.
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
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
)

// ─── Event ────────────────────────────────────────────────────────────────────

// Event represents a single immutable audit record.
type Event struct {
	// Seq is a per-log monotonic sequence number assigned in Log(), before
	// the event is queued and therefore before it can be dropped. It is what
	// makes absence countable: the chain can only attest to events that
	// reached the flush loop, so without a number assigned upstream of the
	// drop decision, a dropped event leaves no trace anywhere and a verified
	// chain says nothing about completeness. Gaps in Seq are the signal.
	// Persisted across restarts via Config.StatePath, so it does not reset.
	Seq             uint64            `json:"seq"`
	TenantID        string            `json:"tenant_id,omitempty"`
	TraceID         string            `json:"trace_id"`
	Timestamp       time.Time         `json:"timestamp"`
	Actor           string            `json:"actor"`
	Action          string            `json:"action"`
	Resource        map[string]string `json:"resource,omitempty"`
	ConfidenceScore float64           `json:"confidence_score,omitempty"`
	// ProviderSignalPresent is true only when ConfidenceScore came from a
	// caller-submitted provider signal rather than the self-reported
	// fallback — not a claim that the signal was confirmed against the
	// provider itself. See agentAuthorizeResponse.ProviderSignalPresent in
	// the server package for the full explanation; renamed from
	// ConfidenceVerified for the same reason.
	ProviderSignalPresent bool `json:"provider_signal_present,omitempty"`
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

// Writer is a buffered audit log writer.
type Writer struct {
	queue      chan Event
	sink       io.Writer
	batchSize  int
	flushEvery time.Duration
	blockOnFull bool
	statePath  string
	signWorkers int
	wg         sync.WaitGroup
	once       sync.Once

	// seq is the sequence high-water mark. Incremented in Log() before the
	// queue send, so a number is burned even for an event that is then
	// dropped — that burned number is the gap a verifier counts.
	seq atomic.Uint64
	// dropped and writeErrs are operational counters, exposed so the server
	// can surface them as metrics and as a degraded health signal. A silent
	// drop that only shows up as a mismatch between a request counter and a
	// line count is not a signal an operator will notice.
	dropped   atomic.Uint64
	writeErrs atomic.Uint64

	signerMu sync.RWMutex
	signer   *rsa.PrivateKey
	keyID    string
}

// Config holds constructor options for Writer.
type Config struct {
	QueueDepth int           // channel buffer depth (default 4096)
	BatchSize  int           // max events per flush (default 100)
	FlushEvery time.Duration // flush interval (default 250 ms)
	Sink       io.Writer     // destination (default os.Stdout)

	// BlockOnFull makes Log() block until the queue has room instead of
	// dropping. It trades hot-path latency for the guarantee that an
	// authorization decision cannot be returned to a caller without a
	// corresponding audit event being at least queued. Off by default
	// because it lets a slow sink become a request-latency problem; on is
	// the right choice for any deployment where the audit log is evidence
	// rather than telemetry.
	BlockOnFull bool

	// StatePath is where the chain's continuity state (last chain hash and
	// sequence high-water mark) is persisted, so the chain survives a
	// restart instead of starting a fresh genesis. Empty disables
	// persistence, which means every process start opens a new chain —
	// acceptable only where nobody relies on the log to be complete across
	// restarts, because an attacker can then delete a whole epoch and every
	// remaining epoch still verifies.
	StatePath string

	// SignWorkers is how many goroutines sign receipts in parallel within a
	// batch. Defaults to GOMAXPROCS. Chaining stays strictly sequential (it
	// has to — each link depends on the previous); only the RSA signatures,
	// which are independent once the digests are known, are parallelized.
	SignWorkers int
}

// chainState is the durable continuity record for a log. Small enough to
// rewrite atomically on every flush.
type chainState struct {
	ChainHash string `json:"chain_hash"`
	NextSeq   uint64 `json:"next_seq"`
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
		c.FlushEvery = 250 * time.Millisecond
	}
	if c.Sink == nil {
		c.Sink = os.Stdout
	}
	if c.SignWorkers <= 0 {
		c.SignWorkers = runtime.GOMAXPROCS(0)
	}

	w := &Writer{
		queue:       make(chan Event, c.QueueDepth),
		sink:        c.Sink,
		batchSize:   c.BatchSize,
		flushEvery:  c.FlushEvery,
		blockOnFull: c.BlockOnFull,
		statePath:   c.StatePath,
		signWorkers: c.SignWorkers,
	}

	seed := chainState{}
	if c.StatePath != "" {
		if st, err := loadChainState(c.StatePath); err == nil {
			seed = st
		}
	}
	w.seq.Store(seed.NextSeq)
	w.start(seed.ChainHash)
	return w
}

// Dropped returns how many events were discarded because the queue was full.
// Non-zero means the log is incomplete and any VerifyChain result over it
// attests only to what survived.
func (w *Writer) Dropped() uint64 { return w.dropped.Load() }

// WriteErrors returns how many events failed to reach the sink. The chain
// does not advance past a failed write, so these are also gaps.
func (w *Writer) WriteErrors() uint64 { return w.writeErrs.Load() }

// loadChainState reads persisted continuity state. A missing or unreadable
// file yields a zero state and an error: the caller starts a fresh chain,
// which is correct for a first run and is the honest fallback otherwise.
func loadChainState(path string) (chainState, error) {
	var st chainState
	b, err := os.ReadFile(path)
	if err != nil {
		return st, err
	}
	if err := json.Unmarshal(b, &st); err != nil {
		return chainState{}, err
	}
	return st, nil
}

// saveChainState rewrites the continuity state atomically (write + rename),
// so a crash mid-write can never leave a truncated state file that would
// silently reset the chain on the next start.
func saveChainState(path string, st chainState) error {
	b, err := json.Marshal(st)
	if err != nil {
		return err
	}
	if dir := filepath.Dir(path); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return err
		}
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// ─── Receipts (AARM R5/R6) ──────────────────────────────────────────────────
//
// What a signed, chained event does and doesn't establish:
//
//   - Signature proves this exact event content was produced by whoever
//     holds the private key for KeyID — not that the underlying decision was
//     correct, only that the record of it wasn't altered after the fact.
//   - PrevHash proves this event's position in a specific sequence — deleting
//     or reordering an event breaks the chain at a detectable point, even
//     though the deleted event's own signature (if an attacker kept a copy)
//     would still verify in isolation. Signature alone cannot catch deletion;
//     the chain is what catches it. This holds across restarts only when
//     Config.StatePath is set: without it each process opens a fresh genesis,
//     and deleting every event of one process lifetime leaves a log that is
//     structurally identical to an honest log with one fewer restart.
//   - Seq proves how many events were meant to exist. The chain covers only
//     events that reached the flush loop, so on its own it cannot see an
//     event dropped under load — a fully verified chain can be missing most
//     of the decisions the engine actually made. Seq gaps are what make that
//     visible, which is why the number is assigned before the drop decision
//     and signed as part of the receipt.
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
	Seq                uint64            `json:"seq"`
	TenantID           string            `json:"tenant_id"`
	TraceID            string            `json:"trace_id"`
	Timestamp          time.Time         `json:"timestamp"`
	Actor              string            `json:"actor"`
	Action             string            `json:"action"`
	Resource           map[string]string `json:"resource"`
	ConfidenceScore    float64           `json:"confidence_score"`
	ProviderSignalPresent bool           `json:"provider_signal_present"`
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
		Seq:                e.Seq,
		TenantID:           e.TenantID,
		TraceID:            e.TraceID,
		Timestamp:          e.Timestamp,
		Actor:              e.Actor,
		Action:             e.Action,
		Resource:           e.Resource,
		ConfidenceScore:    e.ConfidenceScore,
		ProviderSignalPresent: e.ProviderSignalPresent,
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

// SeqGap is a run of missing sequence numbers: the numbers strictly between
// After and Before were assigned to events that never reached the log.
type SeqGap struct {
	After  uint64 `json:"after"`
	Before uint64 `json:"before"`
	Count  uint64 `json:"count"`
}

// ChainReport is the full result of verifying a log: link integrity *and*
// completeness. Both halves are needed for the result to mean anything.
//
// A chain-only answer is actively misleading. The chain can only ever attest
// to events that reached the flush loop, so a log that dropped most of its
// decisions under load still verifies end to end — every link intact, every
// signature valid, and most of the evidence absent. Reporting Missing
// alongside FirstInvalidIndex is what turns "VERIFIED" into a claim an
// auditor can actually use.
type ChainReport struct {
	// Events is how many events were supplied.
	Events int `json:"events"`
	// FirstInvalidIndex is the index of the first event whose PrevHash or
	// Signature failed, or -1 when every link verifies.
	FirstInvalidIndex int `json:"first_invalid_index"`
	// Gaps are the runs of sequence numbers that are missing from the
	// supplied events.
	Gaps []SeqGap `json:"gaps,omitempty"`
	// Missing is the total count of absent sequence numbers.
	Missing uint64 `json:"missing"`
	// Unnumbered counts events with no Seq — records written before
	// sequencing existed. Their absence cannot be detected, so a log
	// containing them cannot be certified complete.
	Unnumbered int `json:"unnumbered"`
}

// Complete reports whether every link verifies AND no sequence number is
// missing. This, not FirstInvalidIndex alone, is the question an auditor is
// asking.
func (r ChainReport) Complete() bool {
	return r.FirstInvalidIndex == -1 && r.Missing == 0 && r.Unnumbered == 0
}

// VerifyChainReport checks link integrity and completeness together. Events
// must be supplied in flush order. Sequence gaps are computed from the Seq
// field, which is assigned before an event can be dropped, so a gap means an
// event was created and never durably recorded.
//
// Note that gap detection describes the supplied slice: verifying a window of
// a log will naturally show the numbers outside it as absent. Feed it whole
// logs, or expect to interpret the edges.
func VerifyChainReport(events []Event, pub *rsa.PublicKey, genesisPrevHash string) ChainReport {
	gaps, missing, unnumbered := SeqGaps(events)
	rep := ChainReport{
		Events:     len(events),
		Gaps:       gaps,
		Missing:    missing,
		Unnumbered: unnumbered,
	}
	// A nil key means "count the gaps, skip the signatures". An unsigned
	// deployment still needs to know whether its log is whole, and that
	// question does not depend on any key.
	if pub == nil {
		rep.FirstInvalidIndex = -1
		return rep
	}
	rep.FirstInvalidIndex = VerifyChain(events, pub, genesisPrevHash)
	return rep
}

// SeqGaps reports the sequence numbers absent from events, which are the
// events the engine created and never durably recorded. Needs no key: absence
// is arithmetic, not cryptography, and an operator should be able to count
// their losses without holding the verification key.
func SeqGaps(events []Event) (gaps []SeqGap, missing uint64, unnumbered int) {
	var prevSeq uint64
	havePrev := false
	for _, e := range events {
		if e.Seq == 0 {
			unnumbered++
			continue
		}
		if havePrev && e.Seq > prevSeq+1 {
			n := e.Seq - prevSeq - 1
			gaps = append(gaps, SeqGap{After: prevSeq, Before: e.Seq, Count: n})
			missing += n
		}
		prevSeq = e.Seq
		havePrev = true
	}
	return gaps, missing, unnumbered
}

// VerifyChain independently checks a sequence of events in flush order
// against a public key: each event's Signature must verify against its own
// receiptCore, and each event's PrevHash must equal the chain hash computed
// from the event immediately before it (the first event's PrevHash is
// checked against genesisPrevHash, typically ""). Returns the index of the
// first event that fails either check, or -1 if the whole sequence verifies.
//
// This checks link integrity only. It cannot see an event that was never
// written — a dropped event never enters the chain, so no gap is created and
// this function happily returns -1 over a log missing most of its decisions.
// Use VerifyChainReport, whose result carries sequence gaps alongside the
// link result; -1 from this function on its own is not evidence the log is
// complete.
//
// Deliberately a free function operating only on (events, key) — not a
// Writer method — so a verifier never depends on the engine process that
// produced the log, per the same reasoning that public keys must not arrive
// through the same channel as the receipts they verify: a verifier that can
// only run inside the writer that made the claims isn't independent of them.
func VerifyChain(events []Event, pub *rsa.PublicKey, genesisPrevHash string) int {
	if pub == nil {
		// Nothing can be verified without a key. Reporting the first event as
		// failing is the fail-closed answer; returning -1 would claim a
		// verification that never happened.
		if len(events) == 0 {
			return -1
		}
		return 0
	}
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

// Log enqueues an event, assigning it a sequence number first.
//
// The Seq assignment happens before the queue send, and deliberately so: if
// the number were assigned by the flush loop, an event dropped here would
// consume no number and leave the log with no evidence it ever existed. A
// burned number is the entire mechanism by which a later verifier can say
// "four thousand decisions are missing" instead of "this chain verifies".
//
// When the queue is full the event is dropped and counted, unless
// BlockOnFull is set, in which case Log blocks until there is room —
// backpressure onto the hot path rather than a silent hole in the evidence.
func (w *Writer) Log(e Event) {
	if e.TraceID == "" {
		e.TraceID = uuid.NewString()
	}
	if e.Timestamp.IsZero() {
		e.Timestamp = time.Now().UTC()
	}
	e.Seq = w.seq.Add(1)

	// A send on a closed queue (Log racing Close during shutdown) must not
	// take the process down. The event is lost either way, so it is counted
	// as a drop — which is also what makes it show up as a seq gap rather
	// than as nothing at all.
	defer func() {
		if recover() != nil {
			w.dropped.Add(1)
		}
	}()

	if w.blockOnFull {
		w.queue <- e
		return
	}

	select {
	case w.queue <- e:
	default:
		w.dropped.Add(1)
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

// syncer is implemented by sinks that can force their buffered data to
// storage (*os.File is one). Flushing to it shrinks the window in which a
// SIGKILL loses already-written events; it cannot close that window entirely,
// which is why BlockOnFull plus a short FlushEvery is the real answer for a
// deployment that treats the log as evidence.
type syncer interface{ Sync() error }

// emitErr distinguishes a per-event problem (skip this one, keep going) from
// a sink problem (stop; the chain must not advance past an event that never
// landed).
type emitErr struct {
	fatal bool
	err   error
}

// emit serialises and writes one event, checking the write. The unchecked
// Fprintf this replaces made a failing sink indistinguishable from a working
// one — every event "written", none of them stored.
func (w *Writer) emit(e Event) *emitErr {
	b, err := json.Marshal(e)
	if err != nil {
		w.writeErrs.Add(1)
		return &emitErr{fatal: false, err: err}
	}
	b = append(b, '\n')
	if _, err := w.sink.Write(b); err != nil {
		w.writeErrs.Add(1)
		return &emitErr{fatal: true, err: err}
	}
	return nil
}

// persist records chain continuity so the next process resumes this chain
// rather than opening a new genesis.
func (w *Writer) persist(lastHash string) {
	if w.statePath == "" {
		return
	}
	// NextSeq is read from the live counter, not from the last written
	// event, so numbers burned by dropped events stay burned across a
	// restart and the gap they left remains countable.
	_ = saveChainState(w.statePath, chainState{ChainHash: lastHash, NextSeq: w.seq.Load()})
}

// signBatch signs each prepared digest. Chaining is inherently sequential —
// every link depends on the one before — but the RSA signatures are
// independent once the digests exist, so they are computed in parallel. This
// is the difference between an audit writer that tops out near one core's
// RSA throughput (~1k signatures/sec, i.e. ~500 decisions/sec) and one that
// scales with the machine. The single-threaded version was the mechanism by
// which ordinary load silently emptied the log.
func (w *Writer) signBatch(signer *rsa.PrivateKey, digests [][32]byte) ([]string, []error) {
	sigs := make([]string, len(digests))
	errs := make([]error, len(digests))

	workers := w.signWorkers
	if workers > len(digests) {
		workers = len(digests)
	}
	if workers <= 1 {
		for i, d := range digests {
			sig, err := rsa.SignPKCS1v15(rand.Reader, signer, crypto.SHA256, d[:])
			if err != nil {
				errs[i] = err
				continue
			}
			sigs[i] = base64.RawURLEncoding.EncodeToString(sig)
		}
		return sigs, errs
	}

	var next atomic.Int64
	var wg sync.WaitGroup
	for n := 0; n < workers; n++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				i := int(next.Add(1)) - 1
				if i >= len(digests) {
					return
				}
				sig, err := rsa.SignPKCS1v15(rand.Reader, signer, crypto.SHA256, digests[i][:])
				if err != nil {
					errs[i] = err
					continue
				}
				sigs[i] = base64.RawURLEncoding.EncodeToString(sig)
			}
		}()
	}
	wg.Wait()
	return sigs, errs
}

func (w *Writer) start(seedHash string) {
	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		ticker := time.NewTicker(w.flushEvery)
		defer ticker.Stop()
		buf := make([]Event, 0, w.batchSize)
		// lastHash continues the chain this log already had — seeded from
		// persisted state at startup, not reset to genesis on every boot.
		lastHash := seedHash

		flush := func() {
			if len(buf) == 0 {
				return
			}
			defer func() {
				buf = buf[:0]
				if sy, ok := w.sink.(syncer); ok {
					_ = sy.Sync()
				}
				w.persist(lastHash)
			}()

			w.signerMu.RLock()
			signer, keyID := w.signer, w.keyID
			w.signerMu.RUnlock()

			if signer == nil {
				for i, e := range buf {
					if ee := w.emit(e); ee != nil && ee.fatal {
						// Sink is broken: everything still buffered after
						// this one is lost too, and counted as lost. emit
						// already counted the event that failed.
						w.writeErrs.Add(uint64(len(buf) - i - 1))
						return
					}
				}
				return
			}

			// ── Pass 1: chain sequentially (cheap SHA-256 only) ──────────
			prepared := make([]Event, 0, len(buf))
			digests := make([][32]byte, 0, len(buf))
			chainHashes := make([]string, 0, len(buf))
			h := lastHash
			for i, e := range buf {
				core, err := canonicalizeReceipt(e, h)
				if err != nil {
					// Cannot chain past an event we cannot canonicalize;
					// abandon the rest of the batch and count it. The seq
					// gap makes the loss visible to a verifier.
					fmt.Fprintf(w.sink, `{"error":"audit canonicalize failed","seq":%d,"trace_id":%q,"detail":%q}`+"\n", e.Seq, e.TraceID, err.Error())
					w.writeErrs.Add(uint64(len(buf) - i))
					break
				}
				d := sha256.Sum256(core)
				e.PrevHash = h
				e.KeyID = keyID
				h = base64.RawURLEncoding.EncodeToString(d[:])

				prepared = append(prepared, e)
				digests = append(digests, d)
				chainHashes = append(chainHashes, h)
			}

			// ── Pass 2: sign in parallel ─────────────────────────────────
			sigs, sigErrs := w.signBatch(signer, digests)

			// ── Pass 3: write sequentially; the chain advances only after
			// the event has actually reached the sink. Advancing first meant
			// the chain could move past an event that was never stored,
			// making the next event's PrevHash reference a link nobody can
			// see.
			for i := range prepared {
				if sigErrs[i] != nil {
					// A signing failure truncates the batch rather than
					// emitting an unsigned event into a signed stream. An
					// unsigned record with an empty PrevHash breaks
					// verification at that point and at every point after
					// it — permanently. Stopping here leaves a countable
					// seq gap instead, and the next batch chains cleanly
					// from the last event that really was written.
					fmt.Fprintf(w.sink, `{"error":"audit sign failed","seq":%d,"trace_id":%q,"detail":%q}`+"\n",
						prepared[i].Seq, prepared[i].TraceID, sigErrs[i].Error())
					w.writeErrs.Add(uint64(len(prepared) - i))
					return
				}
				prepared[i].Signature = sigs[i]
				if ee := w.emit(prepared[i]); ee != nil {
					// Either way the chain must not advance past an event
					// that did not reach the sink, and the rest of the batch
					// was chained onto it — so the remainder is abandoned
					// and counted. emit already counted event i itself.
					w.writeErrs.Add(uint64(len(prepared) - i - 1))
					return
				}
				lastHash = chainHashes[i]
			}
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
