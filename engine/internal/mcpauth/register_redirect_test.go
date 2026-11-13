package mcpauth

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

// A redirect_uri is where /oauth/authorize sends an authorization code, so a
// value it may not be sent to must be refused at registration, before it is
// stored. Every case below used to be accepted.
func TestRegisterClientRefusesUnsafeRedirectURIs(t *testing.T) {
	for _, uri := range []string{
		"javascript:alert(1)",
		"data:text/html,<script>alert(1)</script>",
		"file:///etc/passwd",
		"http://evil.example/cb",
		"https://app.example.com/cb*",
		"https://*.example.com/cb",
		"https://app.example.com/cb#fragment",
		"/relative/cb",
		"",
	} {
		t.Run(uri, func(t *testing.T) {
			srv, h := newRegisterTestServer(t)
			rec := registerClient(t, h, uri)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status %d, want 400: %s", rec.Code, rec.Body.String())
			}
			if !bytes.Contains(rec.Body.Bytes(), []byte("invalid_redirect_uri")) {
				t.Fatalf("error body %s, want invalid_redirect_uri", rec.Body.String())
			}
			var stored int
			if err := srv.db.QueryRow(`SELECT COUNT(*) FROM oauth_clients WHERE client_id LIKE 'lelu_client_%'`).Scan(&stored); err != nil {
				t.Fatal(err)
			}
			if stored != 0 {
				t.Fatalf("a refused registration stored %d client row(s)", stored)
			}
		})
	}
}

// The URIs a real client uses still register, and the refusal is per URI: a
// bad entry in a list rejects the whole registration.
func TestRegisterClientAcceptsUsableRedirectURIs(t *testing.T) {
	for _, uri := range []string{
		"https://app.example.com/callback",
		"http://localhost:8080/callback",
		"http://127.0.0.1:3000/cb",
		"http://[::1]:5000/cb",
		"com.example.app:/oauth/callback",
		"myapp://callback",
	} {
		t.Run(uri, func(t *testing.T) {
			_, h := newRegisterTestServer(t)
			if rec := registerClient(t, h, uri); rec.Code != http.StatusCreated {
				t.Fatalf("status %d, want 201: %s", rec.Code, rec.Body.String())
			}
		})
	}

	_, h := newRegisterTestServer(t)
	if rec := registerClient(t, h, "https://app.example.com/cb", "http://evil.example/cb"); rec.Code != http.StatusBadRequest {
		t.Fatalf("a list with one bad URI: status %d, want 400", rec.Code)
	}
}

func newRegisterTestServer(t *testing.T) (*Server, http.Handler) {
	t.Helper()
	db, err := sql.Open("sqlite3", filepath.Join(t.TempDir(), "lelu.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	srv, err := New(Config{DB: db, SigningKey: testSigningKey(t)})
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)
	return srv, mux
}

func registerClient(t *testing.T, h http.Handler, uris ...string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(map[string]any{"client_name": "test", "redirect_uris": uris})
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/oauth/clients", bytes.NewReader(body))
	req = req.WithContext(WithOwner(context.Background(), "tester"))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func testSigningKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	return key
}
