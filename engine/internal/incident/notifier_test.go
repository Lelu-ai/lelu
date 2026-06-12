package incident_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-auth/lelu/engine/internal/incident"
)

func TestNotifierEnabled(t *testing.T) {
	n := incident.New(incident.Config{})
	assert.False(t, n.Enabled())
}

func TestNotifierNotify(t *testing.T) {
	received := make(chan incident.Event, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		var event incident.Event
		require.NoError(t, json.NewDecoder(r.Body).Decode(&event))
		received <- event
		w.WriteHeader(http.StatusNoContent)
	}))
	defer ts.Close()

	n := incident.New(incident.Config{
		WebhookURL: ts.URL,
		Timeout:    time.Second,
	})
	require.True(t, n.Enabled())

	err := n.Notify(context.Background(), incident.Event{
		Type:     "authorization.denied",
		Severity: "high",
		Action:   "approve_refunds",
		TraceID:  "trace-1",
		Decision: "denied",
	})
	require.NoError(t, err)

	select {
	case evt := <-received:
		assert.Equal(t, "authorization.denied", evt.Type)
		assert.Equal(t, "high", evt.Severity)
		assert.Equal(t, "approve_refunds", evt.Action)
		assert.Equal(t, "trace-1", evt.TraceID)
		assert.Equal(t, "denied", evt.Decision)
		assert.NotEmpty(t, evt.Timestamp)
	case <-time.After(2 * time.Second):
		t.Fatal("expected webhook event")
	}
}
