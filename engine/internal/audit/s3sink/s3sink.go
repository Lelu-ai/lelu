// Package s3sink provides an io.Writer that buffers audit events and flushes
// them to an S3-compatible object store (AWS S3, MinIO, R2, etc.) in batches.
//
// Each flush creates one gzip-compressed NDJSON object with a timestamped key:
//
//	lelu/audit/2026/02/19/150405-<uuid>.ndjson.gz
//
// The sink is designed to be plugged into audit.New():
//
//	import "github.com/lelu-auth/lelu/engine/internal/audit/s3sink"
//
//	sink, err := s3sink.New(s3sink.Config{
//	    Bucket:    os.Getenv("AUDIT_S3_BUCKET"),
//	    Region:    os.Getenv("AWS_REGION"),
//	    KeyPrefix: "lelu/audit",
//	})
//	writer := audit.New(audit.Config{Sink: sink})
package s3sink

import (
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ─── Config ───────────────────────────────────────────────────────────────────

// Config holds S3 sink options.
type Config struct {
	// Bucket is the S3 bucket name (required).
	Bucket string

	// Region is the AWS region (e.g. "us-east-1"). Optional when using
	// environment credentials that already specify a region.
	Region string

	// KeyPrefix is the S3 key prefix. Defaults to "lelu/audit".
	KeyPrefix string

	// Endpoint overrides the S3 endpoint URL (for MinIO / R2 / localstack).
	Endpoint string

	// ForcePathStyle forces path-style S3 addressing (required for MinIO).
	ForcePathStyle bool

	// FlushInterval controls how often the buffer is flushed. Default 60s.
	FlushInterval time.Duration

	// MaxBufferSize is the maximum buffer size in bytes before forcing a flush.
	// Default 5 MB.
	MaxBufferSize int
}

func (c *Config) defaults() {
	if c.KeyPrefix == "" {
		c.KeyPrefix = "lelu/audit"
	}
	if c.FlushInterval <= 0 {
		c.FlushInterval = 60 * time.Second
	}
	if c.MaxBufferSize <= 0 {
		c.MaxBufferSize = 5 * 1024 * 1024 // 5 MB
	}
}

// ─── Uploader interface ───────────────────────────────────────────────────────

// Uploader abstracts the S3 PutObject call.  The real implementation uses
// aws-sdk-go-v2 but the interface lets tests inject a fake without pulling
// in the SDK.
type Uploader interface {
	Upload(ctx context.Context, bucket, key string, body io.Reader) error
}

// ─── Sink ─────────────────────────────────────────────────────────────────────

// Sink is a buffered, gzip-compressed newline-delimited JSON writer that
// periodically flushes to S3.
type Sink struct {
	cfg      Config
	uploader Uploader

	mu     sync.Mutex
	buf    bytes.Buffer
	lines  int
	stopCh chan struct{}
	doneCh chan struct{}
}

// New creates a Sink and starts the background flush timer.
// The caller must provide an Uploader (e.g. built via NewAWSUploader).
// Call Close() to flush and stop the background goroutine.
func New(cfg Config, uploader Uploader) *Sink {
	cfg.defaults()
	s := &Sink{
		cfg:      cfg,
		uploader: uploader,
		stopCh:   make(chan struct{}),
		doneCh:   make(chan struct{}),
	}
	go s.loop()
	return s
}

// Write implements io.Writer.  Each Write call is expected to be a complete
// JSON line (as produced by json.Encoder).
func (s *Sink) Write(p []byte) (int, error) {
	s.mu.Lock()
	n, err := s.buf.Write(p)
	s.lines++
	oversize := s.buf.Len() >= s.cfg.MaxBufferSize
	s.mu.Unlock()

	if err != nil {
		return n, err
	}
	if oversize {
		_ = s.flush(context.Background())
	}
	return n, nil
}

// Close flushes any remaining events and stops the background goroutine.
func (s *Sink) Close() error {
	close(s.stopCh)
	<-s.doneCh
	return s.flush(context.Background())
}

// ─── Internal ─────────────────────────────────────────────────────────────────

func (s *Sink) loop() {
	defer close(s.doneCh)
	ticker := time.NewTicker(s.cfg.FlushInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			_ = s.flush(context.Background())
		case <-s.stopCh:
			return
		}
	}
}

func (s *Sink) flush(ctx context.Context) error {
	s.mu.Lock()
	if s.lines == 0 {
		s.mu.Unlock()
		return nil
	}
	data := make([]byte, s.buf.Len())
	copy(data, s.buf.Bytes())
	s.buf.Reset()
	s.lines = 0
	s.mu.Unlock()

	key := s.objectKey()

	// gzip compress
	var gz bytes.Buffer
	w := gzip.NewWriter(&gz)
	if _, err := w.Write(data); err != nil {
		return fmt.Errorf("s3sink: gzip write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("s3sink: gzip close: %w", err)
	}

	if err := s.uploader.Upload(ctx, s.cfg.Bucket, key, &gz); err != nil {
		return fmt.Errorf("s3sink: upload %s: %w", key, err)
	}
	return nil
}

func (s *Sink) objectKey() string {
	now := time.Now().UTC()
	return fmt.Sprintf(
		"%s/%04d/%02d/%02d/%s-%s.ndjson.gz",
		s.cfg.KeyPrefix,
		now.Year(), now.Month(), now.Day(),
		now.Format("150405"),
		uuid.NewString()[:8],
	)
}
