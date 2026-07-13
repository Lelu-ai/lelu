package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// fakePlatform returns a verify endpoint that accepts exactly one key and
// counts how many requests it received.
func fakePlatform(t *testing.T, acceptedKey string, hits *atomic.Int64) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		if r.URL.Path != "/api/v1/keys/verify" {
			http.NotFound(w, r)
			return
		}
		var body struct {
			Key string `json:"key"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if body.Key == acceptedKey {
			json.NewEncoder(w).Encode(map[string]any{"valid": true, "userId": "user-1", "keyId": "key-1"})
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"valid": false})
	}))
}

func newTestVerifier(platformURL string) *keyVerifier {
	return &keyVerifier{
		verifyURL: platformURL + "/api/v1/keys/verify",
		client:    &http.Client{Timeout: 2 * time.Second},
		cache:     map[string]keyCacheEntry{},
	}
}

func TestKeyVerifierAcceptsValidKey(t *testing.T) {
	var hits atomic.Int64
	platform := fakePlatform(t, "lelu_sk_abc_secret", &hits)
	defer platform.Close()

	v := newTestVerifier(platform.URL)
	userID, ok := v.verify(context.Background(), "lelu_sk_abc_secret")
	if !ok {
		t.Fatal("expected valid key to be accepted")
	}
	if userID != "user-1" {
		t.Fatalf("expected userID user-1, got %q", userID)
	}
}

func TestKeyVerifierRejectsUnknownKey(t *testing.T) {
	var hits atomic.Int64
	platform := fakePlatform(t, "lelu_sk_abc_secret", &hits)
	defer platform.Close()

	v := newTestVerifier(platform.URL)
	if _, ok := v.verify(context.Background(), "lelu_sk_wrong_key"); ok {
		t.Fatal("expected unknown key to be rejected")
	}
}

func TestKeyVerifierCachesResults(t *testing.T) {
	var hits atomic.Int64
	platform := fakePlatform(t, "lelu_sk_abc_secret", &hits)
	defer platform.Close()

	v := newTestVerifier(platform.URL)
	for i := 0; i < 5; i++ {
		if _, ok := v.verify(context.Background(), "lelu_sk_abc_secret"); !ok {
			t.Fatal("expected valid key to be accepted")
		}
	}
	if got := hits.Load(); got != 1 {
		t.Fatalf("expected 1 platform hit (rest cached), got %d", got)
	}
}

func TestKeyVerifierFailsClosedWhenPlatformDown(t *testing.T) {
	var hits atomic.Int64
	platform := fakePlatform(t, "lelu_sk_abc_secret", &hits)
	platform.Close() // unreachable

	v := newTestVerifier(platform.URL)
	if _, ok := v.verify(context.Background(), "lelu_sk_abc_secret"); ok {
		t.Fatal("expected verification to fail closed when platform is unreachable")
	}
}

func TestAuthMiddlewareAcceptsPlatformVerifiedKey(t *testing.T) {
	var hits atomic.Int64
	platform := fakePlatform(t, "lelu_sk_abc_secret", &hits)
	defer platform.Close()

	h := &Handler{apiKey: "static-key", keyVerify: newTestVerifier(platform.URL)}
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mw := h.authMiddleware(next)

	cases := []struct {
		name   string
		header string
		want   int
	}{
		{"static key", "Bearer static-key", http.StatusOK},
		{"platform key", "Bearer lelu_sk_abc_secret", http.StatusOK},
		{"unknown platform key", "Bearer lelu_sk_nope_nope", http.StatusUnauthorized},
		{"garbage", "Bearer whatever", http.StatusUnauthorized},
		{"missing", "", http.StatusUnauthorized},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/v1/agent/authorize", nil)
			if tc.header != "" {
				req.Header.Set("Authorization", tc.header)
			}
			rec := httptest.NewRecorder()
			mw.ServeHTTP(rec, req)
			if rec.Code != tc.want {
				t.Fatalf("expected status %d, got %d", tc.want, rec.Code)
			}
		})
	}
}

func TestAuthMiddlewareFailsClosedWithoutAnyAuthConfigured(t *testing.T) {
	t.Setenv("LELU_DEV_INSECURE", "false")
	h := &Handler{} // no apiKey, no keyVerify
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/agent/authorize", nil)
	rec := httptest.NewRecorder()
	h.authMiddleware(next).ServeHTTP(rec, req)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 misconfigured, got %d", rec.Code)
	}
}
