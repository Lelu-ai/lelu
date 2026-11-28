package daemon

import (
	"os"
	"path/filepath"
	"testing"
)

func writeSettings(t *testing.T, dir, name, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Join(dir, ".claude"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, ".claude", name), []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestClaudeAllowsWebFetch(t *testing.T) {
	home := t.TempDir()
	project := filepath.Join(t.TempDir(), "repo")
	sub := filepath.Join(project, "pkg", "x")
	if err := os.MkdirAll(sub, 0o700); err != nil {
		t.Fatal(err)
	}
	writeSettings(t, home, "settings.json", `{"permissions":{"allow":["WebFetch(domain:user-trusted.example)","Bash(ls:*)"]}}`)
	writeSettings(t, project, "settings.local.json", `{"permissions":{"allow":["WebFetch(domain:*.corp.example)"]}}`)
	writeSettings(t, project, "settings.json", `not json`)

	cases := []struct {
		host string
		want bool
	}{
		{"user-trusted.example", true},
		{"wiki.corp.example", true}, // wildcard in the project's local settings, found from a subdirectory
		{"corp.example", false},     // "*.corp.example" covers subdomains only
		{"evil.example", false},
		{"", false},
	}
	for _, tc := range cases {
		if got := claudeAllowsWebFetch(tc.host, sub, home); got != tc.want {
			t.Errorf("claudeAllowsWebFetch(%q) = %v, want %v", tc.host, got, tc.want)
		}
	}
}

func TestEngine_WebFetchRespectsClaudeAllowRules(t *testing.T) {
	home := t.TempDir()
	writeSettings(t, home, "settings.json", `{"permissions":{"allow":["WebFetch(domain:user-trusted.example)"]}}`)
	engine, _ := newTestEngine(t, false)
	engine.Home = home
	req := Request{SessionID: "w", Tool: "WebFetch", URL: "https://user-trusted.example/page", Cwd: "/tmp", Env: map[string]string{"HOME": home}}
	if got := engine.Decide(req); got.Outcome != OutcomeAllow {
		t.Errorf("outcome = %q, want allow for a domain allowed in Claude Code settings; %+v", got.Outcome, got)
	}
	req.URL = "https://not-trusted.example/page"
	if got := engine.Decide(req); got.Outcome != OutcomeAsk {
		t.Errorf("outcome = %q, want ask for a domain not allowed anywhere; %+v", got.Outcome, got)
	}
}
