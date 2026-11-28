package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-ai/lelu/engine/internal/queue"
)

// GET /v1/queue/{id}/wait may block for up to 60 s, far longer than the
// server's 10 s WriteTimeout, so the handler extends the write deadline for
// its own request. That extension silently did nothing: the logging
// middleware's ResponseWriter wrapper had no Unwrap method, so
// http.ResponseController could not reach the connection. A wait that ran
// past 10 s reached the client as an empty reply, even though the engine
// logged a response.
//
// The test runs the real server (NewHTTPServer: same middleware, same
// handler) with its timeouts shortened from 10 s to 300 ms, and waits for
// longer than that, both for a review approved mid-wait and for one still
// pending when the wait times out.
func TestQueueWait_OutlivesServerTimeouts(t *testing.T) {
	const (
		staticKey     = "static-admin-key"
		serverTimeout = 300 * time.Millisecond
	)

	h := newReputationHandler(t, nil)
	h.apiKey = staticKey

	httpSrv := NewHTTPServer(":0", h)
	require.Equal(t, 10*time.Second, httpSrv.WriteTimeout, "test assumes the production WriteTimeout")
	require.Equal(t, 10*time.Second, httpSrv.ReadTimeout, "test assumes the production ReadTimeout")
	httpSrv.ReadTimeout = serverTimeout
	httpSrv.WriteTimeout = serverTimeout
	srv := httptest.NewUnstartedServer(nil)
	srv.Config = httpSrv
	srv.Start()
	t.Cleanup(srv.Close)

	enqueue := func(t *testing.T) string {
		t.Helper()
		id, err := h.queue.EnqueueRequest(context.Background(), queue.ReviewRequest{
			Actor:  "deploy_bot",
			Action: "deploy_prod",
			Reason: "needs a human",
		})
		require.NoError(t, err)
		return id
	}

	wait := func(t *testing.T, id string, timeoutMs int) (int, queue.ReviewRequest, time.Duration) {
		t.Helper()
		req, err := http.NewRequest(http.MethodGet, srv.URL+"/v1/queue/"+id+"/wait?timeout_ms="+strconv.Itoa(timeoutMs), nil)
		require.NoError(t, err)
		req.Header.Set("Authorization", "Bearer "+staticKey)
		start := time.Now()
		resp, err := srv.Client().Do(req)
		require.NoError(t, err, "the client must get a response, not a dropped connection")
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var item queue.ReviewRequest
		require.NoError(t, json.Unmarshal(body, &item), "response body %q", body)
		return resp.StatusCode, item, time.Since(start)
	}

	t.Run("resolved after the server timeout", func(t *testing.T) {
		id := enqueue(t)
		go func() {
			time.Sleep(2 * serverTimeout)
			_ = h.queue.Approve(context.Background(), id, "reviewer", "ok")
		}()
		status, item, elapsed := wait(t, id, 5_000)
		assert.Equal(t, http.StatusOK, status)
		assert.Equal(t, queue.StatusApproved, item.Status)
		assert.Equal(t, id, item.ID)
		assert.Greater(t, elapsed, serverTimeout, "the wait must outlast the server timeout to prove anything")
	})

	t.Run("still pending at its own timeout", func(t *testing.T) {
		id := enqueue(t)
		status, item, elapsed := wait(t, id, int(3*serverTimeout/time.Millisecond))
		assert.Equal(t, http.StatusRequestTimeout, status)
		assert.Equal(t, queue.StatusPending, item.Status)
		assert.Greater(t, elapsed, serverTimeout)
	})
}
