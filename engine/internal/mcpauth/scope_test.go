package mcpauth

import "testing"

// grantableScope is the fix for the scope half of the OAuth findings: a
// client registered with "read" could request "admin:everything" and receive
// it, because the requested string was stored verbatim at /oauth/authorize
// and copied into a signed JWT at /oauth/token without ever being compared to
// anything.

func TestGrantableScope_RejectsUnsupported(t *testing.T) {
	client := &OAuthClient{Scopes: "agent:read agent:write"}
	if _, err := grantableScope("admin:everything", client); err == nil {
		t.Fatal("admin:everything must be rejected — it is not a scope this server supports")
	}
}

func TestGrantableScope_RejectsBeyondClientRegistration(t *testing.T) {
	client := &OAuthClient{Scopes: "agent:read"}
	if _, err := grantableScope("agent:write", client); err == nil {
		t.Fatal("a client registered for agent:read must not be granted agent:write")
	}
}

func TestGrantableScope_AllowsWhatTheClientHolds(t *testing.T) {
	client := &OAuthClient{Scopes: "agent:read tools:call"}
	got, err := grantableScope("agent:read", client)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "agent:read" {
		t.Fatalf("granted %q, want %q", got, "agent:read")
	}
}

// An empty request means "everything this client holds" — bounded by the
// client's registration, never by the caller's ambition.
func TestGrantableScope_EmptyRequestUsesClientCeiling(t *testing.T) {
	client := &OAuthClient{Scopes: "agent:read tools:call"}
	got, err := grantableScope("", client)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "agent:read tools:call" {
		t.Fatalf("granted %q, want the client's registered scopes", got)
	}
}

// A client registered with no scopes is bounded by the server's supported
// set, not unbounded.
func TestGrantableScope_UnscopedClientBoundedByServer(t *testing.T) {
	client := &OAuthClient{Scopes: ""}
	if _, err := grantableScope("admin:everything", client); err == nil {
		t.Fatal("an unscoped client must still be bounded by SupportedScopes")
	}
}
