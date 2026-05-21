// Package audit provides a non-blocking, buffered audit log pipeline.
// Events are queued in-memory and flushed to an output sink in batches
// on a background goroutine, keeping the hot path latency near zero.
package audit

import (
	"context"
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
	Decision        string            `json:"decision"` // "allowed" | "denied" | "human_review"
	Reason          string            `json:"reason,omitempty"`
	DowngradedScope string            `json:"downgraded_scope,omitempty"`
	LatencyMS       float64           `json:"latency_ms"`
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

		flush := func() {
			if len(buf) == 0 {
				return
			}
			for _, e := range buf {
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
