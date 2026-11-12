package mcpauth

import (
	"crypto/rand"
	"crypto/rsa"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

// newAuthorizeTestServer returns a server with one registered client whose only
// redirect_uri is redirectURI, so a test can drive /oauth/authorize by hand.
func newAuthorizeTestServer(t *testing.T, redirectURI string) (*Server, http.Handler) {
	t.Helper()
	db, err := sql.Open("sqlite3", filepath.Join(t.TempDir(), "lelu.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	srv, err := New(Config{DB: db, SigningKey: key})
	if err != nil {
		t.Fatal(err)
	}

	redirects, _ := json.Marshal([]string{redirectURI})
	grants, _ := json.Marshal([]string{"authorization_code"})
	_, err = db.Exec(`
		INSERT INTO oauth_clients
		  (client_id, client_secret, client_name, redirect_uris, grant_types, scopes,
		   token_endpoint_auth_method, created_at, owner)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"test-client", "test-secret", "test client", string(redirects), string(grants),
		"agent:read", "none", 0, "tester",
	)
	if err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)
	return srv, mux
}

func authorize(t *testing.T, h http.Handler, params url.Values) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/oauth/authorize?"+params.Encode(), nil))
	return rec
}

// A `state` carrying separators used to be appended to the redirect verbatim,
// so the caller could add parameters of its own choosing to the response, and
// a `#` turned the rest of the query — including the real code — into a
// fragment. Every one of these values must come back as a single decoded value.
func TestAuthorizeRedirectKeepsStateAsOneParameter(t *testing.T) {
	const redirectURI = "https://app.example.com/callback"
	_, h := newAuthorizeTestServer(t, redirectURI)

	for _, state := range []string{
		"x&code=attackercode&foo=",
		"a#fragment",
		"k=v",
		"with a space",
		"plus+and%percent",
		"state",
	} {
		t.Run(state, func(t *testing.T) {
			rec := authorize(t, h, url.Values{
				"client_id":             {"test-client"},
				"redirect_uri":          {redirectURI},
				"response_type":         {"code"},
				"code_challenge":        {"challenge"},
				"code_challenge_method": {"S256"},
				"scope":                 {"agent:read"},
				"state":                 {state},
			})
			if rec.Code != http.StatusFound {
				t.Fatalf("status %d, want 302: %s", rec.Code, rec.Body.String())
			}

			loc, err := url.Parse(rec.Header().Get("Location"))
			if err != nil {
				t.Fatalf("Location is not a URL: %v", err)
			}
			if loc.Fragment != "" {
				t.Fatalf("state started a fragment: %q", loc.Fragment)
			}
			q := loc.Query()
			if got := q["state"]; len(got) != 1 || got[0] != state {
				t.Fatalf("state round-trips as %q (one value expected), want %q", got, state)
			}
			if got := q["code"]; len(got) != 1 || got[0] == "" {
				t.Fatalf("code round-trips as %q, want one non-empty value", got)
			}
			if got := q["code"]; got[0] == "attackercode" {
				t.Fatal("the state's own code= parameter replaced the real code")
			}
			if _, injected := q["foo"]; injected {
				t.Fatal("state injected a foo parameter into the redirect")
			}
			if loc.Path != "/callback" {
				t.Fatalf("path is %q, want /callback", loc.Path)
			}
		})
	}
}

// The redirect_uri may already carry what the client uses to correlate the
// response, and a fragment must survive the merge.
func TestAuthorizeRedirectPreservesRegisteredQueryAndFragment(t *testing.T) {
	const redirectURI = "https://app.example.com/callback?tenant=t1#section"
	_, h := newAuthorizeTestServer(t, redirectURI)

	rec := authorize(t, h, url.Values{
		"client_id":             {"test-client"},
		"redirect_uri":          {"https://app.example.com/callback?tenant=t1#section"},
		"response_type":         {"code"},
		"code_challenge":        {"challenge"},
		"code_challenge_method": {"S256"},
		"state":                 {"abc"},
	})
	if rec.Code != http.StatusFound {
		t.Fatalf("status %d, want 302: %s", rec.Code, rec.Body.String())
	}
	loc, err := url.Parse(rec.Header().Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	if got := loc.Query().Get("tenant"); got != "t1" {
		t.Fatalf("tenant is %q, want t1", got)
	}
	if got := loc.Query().Get("state"); got != "abc" {
		t.Fatalf("state is %q, want abc", got)
	}
	if loc.Fragment != "section" {
		t.Fatalf("fragment is %q, want section", loc.Fragment)
	}
	if loc.Query().Get("code") == "" {
		t.Fatal("no code in the redirect")
	}
}

// The code that comes back must be the one that was stored and issued.
func TestAuthorizeRedirectCarriesTheIssuedCode(t *testing.T) {
	const redirectURI = "https://app.example.com/callback"
	srv, h := newAuthorizeTestServer(t, redirectURI)

	rec := authorize(t, h, url.Values{
		"client_id":             {"test-client"},
		"redirect_uri":          {redirectURI},
		"response_type":         {"code"},
		"code_challenge":        {"challenge"},
		"code_challenge_method": {"S256"},
		"state":                 {"s"},
	})
	if rec.Code != http.StatusFound {
		t.Fatalf("status %d, want 302", rec.Code)
	}
	loc, _ := url.Parse(rec.Header().Get("Location"))
	code := loc.Query().Get("code")

	var stored int
	if err := srv.db.QueryRow(`SELECT COUNT(*) FROM oauth_codes WHERE code = ?`, code).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored != 1 {
		t.Fatalf("redirected code %q matches %d rows in oauth_codes, want 1", code, stored)
	}
}

// A redirect_uri that cannot be parsed is refused instead of being redirected
// to. It has to be registered to get this far, so this exercises the guard on
// the URL itself.
func TestAuthorizeRefusesAnUnparseableRedirect(t *testing.T) {
	if _, err := withQuery("://nope", url.Values{"code": {"c"}}); err == nil {
		t.Fatal("a redirect_uri that does not parse must be refused")
	}
}
