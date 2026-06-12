package s3sink_test

import (
	"bytes"
	"compress/gzip"
	"context"
	"io"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-auth/lelu/engine/internal/audit/s3sink"
)

// ─── Fake uploader ────────────────────────────────────────────────────────────

type fakeUploader struct {
	mu      sync.Mutex
	uploads []fakeUpload
}

type fakeUpload struct {
	bucket string
	key    string
	body   []byte
}

func (f *fakeUploader) Upload(_ context.Context, bucket, key string, body io.Reader) error {
	data, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	f.mu.Lock()
	f.uploads = append(f.uploads, fakeUpload{bucket: bucket, key: key, body: data})
	f.mu.Unlock()
	return nil
}

func (f *fakeUploader) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.uploads)
}

func (f *fakeUploader) last() fakeUpload {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.uploads[len(f.uploads)-1]
}

// ─── Tests ────────────────────────────────────────────────────────────────────

func TestSink_FlushOnClose(t *testing.T) {
	up := &fakeUploader{}
	sink := s3sink.New(s3sink.Config{
		Bucket:        "test-bucket",
		KeyPrefix:     "lelu/audit",
		FlushInterval: time.Hour, // disable auto-flush
	}, up)

	_, err := sink.Write([]byte(`{"trace_id":"abc"}` + "\n"))
	require.NoError(t, err)
	assert.Equal(t, 0, up.count(), "should not upload before Close")

	require.NoError(t, sink.Close())
	assert.Equal(t, 1, up.count(), "should upload once on Close")

	upload := up.last()
	assert.Equal(t, "test-bucket", upload.bucket)
	assert.Contains(t, upload.key, "lelu/audit/")
	assert.Contains(t, upload.key, ".ndjson.gz")
}

func TestSink_GzipContent(t *testing.T) {
	up := &fakeUploader{}
	sink := s3sink.New(s3sink.Config{
		Bucket:        "test-bucket",
		FlushInterval: time.Hour,
	}, up)

	line := `{"trace_id":"xyz","action":"test"}` + "\n"
	_, err := sink.Write([]byte(line))
	require.NoError(t, err)
	require.NoError(t, sink.Close())

	// Decompress the upload and verify content.
	upload := up.last()
	r, err := gzip.NewReader(bytes.NewReader(upload.body))
	require.NoError(t, err)
	content, err := io.ReadAll(r)
	require.NoError(t, err)

	assert.True(t, strings.Contains(string(content), "xyz"), "decompressed content should contain trace_id")
}

func TestSink_MaxBufferFlush(t *testing.T) {
	up := &fakeUploader{}
	sink := s3sink.New(s3sink.Config{
		Bucket:        "test-bucket",
		FlushInterval: time.Hour,
		MaxBufferSize: 10, // tiny limit to force early flush
	}, up)
	defer sink.Close() //nolint:errcheck

	// Write more than 10 bytes to trigger automatic flush.
	_, err := sink.Write([]byte(`{"trace_id":"trigger-flush"}` + "\n"))
	require.NoError(t, err)

	// Give background goroutine a moment.
	time.Sleep(20 * time.Millisecond)
	assert.GreaterOrEqual(t, up.count(), 1, "oversized buffer should auto-flush")
}

func TestSink_EmptyFlushNoUpload(t *testing.T) {
	up := &fakeUploader{}
	sink := s3sink.New(s3sink.Config{
		Bucket:        "test-bucket",
		FlushInterval: time.Hour,
	}, up)
	require.NoError(t, sink.Close())
	assert.Equal(t, 0, up.count(), "empty buffer should not upload")
}
