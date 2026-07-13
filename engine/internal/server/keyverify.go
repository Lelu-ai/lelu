package server

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// keyVerifier validates account-bound API keys (lelu_sk_…) against the
// platform key store. Enabled by setting PLATFORM_URL; nil when unset.
type keyVerifier struct {
	verifyURL string
	client    *http.Client

	mu    sync.Mutex
	cache map[string]keyCacheEntry // sha256(key) → cached result
}

type keyCacheEntry struct {
	valid   bool
	userID  string
	expires time.Time
}

const (
	keyCacheValidTTL = 60 * time.Second
	// Failed lookups are cached briefly too, so a burst of requests with a bad
	// key cannot hammer the platform — but a platform outage (which also lands
	// here) recovers quickly.
	keyCacheInvalidTTL = 15 * time.Second
	keyCacheMaxEntries = 10_000
)

func newKeyVerifierFromEnv() *keyVerifier {
	base := strings.TrimSpace(os.Getenv("PLATFORM_URL"))
	if base == "" {
		return nil
	}
	return &keyVerifier{
		verifyURL: strings.TrimRight(base, "/") + "/api/v1/keys/verify",
		client:    &http.Client{Timeout: 3 * time.Second},
		cache:     map[string]keyCacheEntry{},
	}
}

// verify resolves an API key to its owning user. Fails closed: any transport
// or platform error counts as invalid.
func (v *keyVerifier) verify(ctx context.Context, key string) (string, bool) {
	cacheKey := hashKeyForCache(key)

	v.mu.Lock()
	if e, ok := v.cache[cacheKey]; ok && time.Now().Before(e.expires) {
		v.mu.Unlock()
		return e.userID, e.valid
	}
	v.mu.Unlock()

	userID, valid := v.verifyRemote(ctx, key)

	ttl := keyCacheInvalidTTL
	if valid {
		ttl = keyCacheValidTTL
	}
	v.mu.Lock()
	if len(v.cache) >= keyCacheMaxEntries {
		// Bounded memory beats LRU bookkeeping here: a full reset just costs
		// one extra platform round-trip per key.
		v.cache = map[string]keyCacheEntry{}
	}
	v.cache[cacheKey] = keyCacheEntry{valid: valid, userID: userID, expires: time.Now().Add(ttl)}
	v.mu.Unlock()

	return userID, valid
}

func (v *keyVerifier) verifyRemote(ctx context.Context, key string) (string, bool) {
	payload, err := json.Marshal(map[string]string{"key": key})
	if err != nil {
		return "", false
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.verifyURL, bytes.NewReader(payload))
	if err != nil {
		return "", false
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := v.client.Do(req)
	if err != nil {
		return "", false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", false
	}

	var out struct {
		Valid  bool   `json:"valid"`
		UserID string `json:"userId"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", false
	}
	return out.UserID, out.Valid
}

// hashKeyForCache digests the key so plaintext keys never sit in memory.
func hashKeyForCache(key string) string {
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:])
}
