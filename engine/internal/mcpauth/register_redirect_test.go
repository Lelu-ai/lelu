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

func TestValidateRedirectURIEdgeCases(t *testing.T) {
	tests := []struct {
		name    string
		uri     string
		wantErr bool
	}{
		// Loopback & host-parsing edge cases
		{name: "userinfo spoofing localhost", uri: "http://localhost@evil.example/cb", wantErr: true},
		{name: "localhost subdomain spoofing", uri: "http://localhost.evil.example/cb", wantErr: true},
		{name: "127.0.0.1 subdomain spoofing", uri: "http://127.0.0.1.evil.com/cb", wantErr: true},
		{name: "ipv6 loopback without port", uri: "http://[::1]/cb", wantErr: false},
		{name: "ipv6 loopback with port", uri: "http://[::1]:8080/cb", wantErr: false},
		{name: "uppercase scheme and localhost per RFC 3986", uri: "HTTP://LOCALHOST/cb", wantErr: false},
		{name: "uppercase localhost with port", uri: "HTTP://LOCALHOST:3000/cb", wantErr: false},
		{name: "localhost without port", uri: "http://localhost/cb", wantErr: false},
		{name: "127.0.0.1 without port", uri: "http://127.0.0.1/cb", wantErr: false},
		{name: "https with query params and encoded chars", uri: "https://app.example.com/cb?state=a%20b&next=%2Fhome", wantErr: false},
		{name: "https with trailing slash", uri: "https://app.example.com/cb/", wantErr: false},

		// Disallowed schemes
		{name: "vbscript scheme refused", uri: "vbscript:x", wantErr: true},
		{name: "blob scheme refused", uri: "blob:https://x", wantErr: true},
		{name: "uppercase vbscript refused", uri: "VBSCRIPT:msgbox(1)", wantErr: true},
		{name: "uppercase blob refused", uri: "BLOB:https://example.com/uuid", wantErr: true},
		{name: "javascript scheme refused", uri: "javascript:alert(1)", wantErr: true},
		{name: "data scheme refused", uri: "data:text/html,hi", wantErr: true},
		{name: "file scheme refused", uri: "file:///etc/passwd", wantErr: true},

		// Fragments, wildcards, missing scheme
		{name: "empty fragment refused", uri: "https://app.example.com/cb#", wantErr: true},
		{name: "wildcard in path refused", uri: "https://app.example.com/*", wantErr: true},
		{name: "relative path refused", uri: "/oauth/callback", wantErr: true},
		{name: "empty uri refused", uri: "", wantErr: true},

		// Legitimate custom native app schemes
		{name: "reverse-DNS custom scheme", uri: "com.example.app:/oauth/callback", wantErr: false},
		{name: "custom app scheme", uri: "myapp://callback", wantErr: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validateRedirectURI(tc.uri)
			if (err != nil) != tc.wantErr {
				t.Fatalf("validateRedirectURI(%q) error = %v, wantErr %v", tc.uri, err, tc.wantErr)
			}
		})
	}
}

func TestIsLoopbackHost(t *testing.T) {
	tests := []struct {
		host string
		want bool
	}{
		{host: "localhost", want: true},
		{host: "LOCALHOST", want: true},
		{host: "LocalHost:8080", want: true},
		{host: "127.0.0.1", want: true},
		{host: "127.0.0.1:3000", want: true},
		{host: "127.0.0.2:9000", want: true},
		{host: "[::1]", want: true},
		{host: "[::1]:5000", want: true},
		{host: "", want: false},
		{host: "evil.example", want: false},
		{host: "localhost.evil.example", want: false},
		{host: "127.0.0.1.evil.com", want: false},
		{host: "127.0.0.1.evil.com:8080", want: false},
		{host: "0.0.0.0", want: false},
	}

	for _, tc := range tests {
		t.Run(tc.host, func(t *testing.T) {
			if got := isLoopbackHost(tc.host); got != tc.want {
				t.Fatalf("isLoopbackHost(%q) = %v, want %v", tc.host, got, tc.want)
			}
		})
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
