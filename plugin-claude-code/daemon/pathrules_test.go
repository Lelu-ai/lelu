package daemon

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

const testHome = "/home/testuser"

func decideAs(t *testing.T, shadow bool, req Request) Response {
	t.Helper()
	engine, _ := newTestEngine(t, shadow)
	req.SessionID = "s-" + req.Tool + req.FilePath + req.Command + req.Path + req.Glob
	if req.Cwd == "" {
		req.Cwd = testHome + "/project"
	}
	req.Env = map[string]string{"HOME": testHome}
	return engine.Decide(req)
}

// Path rules match whole file and folder names. A rule for ".env" must not
// fire on a file that only has ".env" somewhere inside its name.
func TestPathRules_EditTools(t *testing.T) {
	cases := []struct {
		path string
		want Outcome
	}{
		// Names that only contain a rule's text.
		{"/home/testuser/project/src/app.environment.ts", OutcomeAllow},
		{"/home/testuser/project/types/config.env.d.ts", OutcomeAllow},
		{"/home/testuser/project/docs/setup.ssh.md", OutcomeAllow},
		{"/home/testuser/project/src/env.ts", OutcomeAllow},
		{"/home/testuser/project/.github/workflows/ci.yml", OutcomeAllow},
		{"/home/testuser/project/.gitignore", OutcomeAllow},
		{"/home/testuser/project/docs/git/notes.md", OutcomeAllow},
		// A project folder named .lelu is not Lelu's data directory.
		{"/home/testuser/project/.lelu/config.yaml", OutcomeAllow},
		{"/home/testuser/project/docs/claude/settings.json", OutcomeAllow},
		// Templates stay editable.
		{"/home/testuser/project/.env.example", OutcomeAllow},
		{"/home/testuser/project/.env.sample", OutcomeAllow},
		{"/home/testuser/project/.env.template", OutcomeAllow},
		{"/home/testuser/project/.env.dist", OutcomeAllow},
		// Real env files, keys and the .git folder.
		{"/home/testuser/project/.env", OutcomeDeny},
		{"/home/testuser/project/.env.local", OutcomeDeny},
		{"/home/testuser/project/.env.production", OutcomeDeny},
		{"/home/testuser/project/web/.env.development.local", OutcomeDeny},
		{"/home/testuser/project/.envrc", OutcomeDeny},
		{"/home/testuser/.ssh/id_rsa", OutcomeDeny},
		{"/home/testuser/.ssh/authorized_keys", OutcomeDeny},
		{"/home/testuser/project/foo/.ssh/config", OutcomeDeny},
		{"/home/testuser/keys/id_ed25519.pub", OutcomeDeny},
		{"/home/testuser/.aws/credentials", OutcomeDeny},
		{"/home/testuser/project/.git/config", OutcomeDeny},
		{"/home/testuser/project/.git/hooks/pre-commit", OutcomeDeny},
		// Lelu's own files and Claude Code's settings ask.
		{"/home/testuser/.lelu/claude-plugin/mode", OutcomeAsk},
		{"/home/testuser/project/.claude/settings.json", OutcomeAsk},
		{"/home/testuser/project/.claude/settings.local.json", OutcomeAsk},
		{"/home/testuser/.claude/plugins/cache/lelu/lelu/0.3.0/hooks/hooks.json", OutcomeAsk},
	}
	for _, tc := range cases {
		t.Run(tc.path, func(t *testing.T) {
			for _, tool := range []string{"Write", "Edit"} {
				if got := decideAs(t, false, Request{Tool: tool, FilePath: tc.path}); got.Outcome != tc.want {
					t.Errorf("%s: outcome = %q, want %q; response=%+v", tool, got.Outcome, tc.want, got)
				}
			}
		})
	}
}

func TestPathRules_Read(t *testing.T) {
	cases := []struct {
		path string
		want Outcome
	}{
		{"/home/testuser/project/src/app.environment.ts", OutcomeAllow},
		{"/home/testuser/project/types/config.env.d.ts", OutcomeAllow},
		{"/home/testuser/project/docs/setup.ssh.md", OutcomeAllow},
		{"/home/testuser/project/.env.example", OutcomeAllow},
		{"/home/testuser/project/docs/netrc-format.md", OutcomeAllow},
		{"/home/testuser/project/k8s/kube/config", OutcomeAllow},
		{"/home/testuser/project/.env", OutcomeAsk},
		{"/home/testuser/project/.env.local", OutcomeAsk},
		{"/home/testuser/project/.envrc", OutcomeAsk},
		{"/home/testuser/.ssh/id_rsa", OutcomeAsk},
		{"/home/testuser/project/foo/.ssh/config", OutcomeAsk},
		{"/home/testuser/.netrc", OutcomeAsk},
		{"/home/testuser/.aws/config", OutcomeAsk},
		{"/home/testuser/.kube/config", OutcomeAsk},
		{"/home/testuser/.docker/config.json", OutcomeAsk},
		{"/home/testuser/.gnupg/private-keys-v1.d/x.key", OutcomeAsk},
		{"/home/testuser/backup/id_ecdsa", OutcomeAsk},
	}
	for _, tc := range cases {
		t.Run(tc.path, func(t *testing.T) {
			if got := decideAs(t, false, Request{Tool: "Read", FilePath: tc.path}); got.Outcome != tc.want {
				t.Errorf("outcome = %q, want %q; response=%+v", got.Outcome, tc.want, got)
			}
		})
	}
}

func TestPathRules_Bash(t *testing.T) {
	cases := []struct {
		cmd  string
		want Outcome
	}{
		{"cat src/app.environment.ts", OutcomeAllow},
		{"cat docs/setup.ssh.md", OutcomeAllow},
		{"rm -rf types/config.env.d.ts", OutcomeAllow},
		{"echo x > .lelu/notes.txt", OutcomeAllow},
		{"sed -i s/a/b/ .github/workflows/ci.yml", OutcomeAllow},
		{"cat .env", OutcomeAsk},
		{"cat .env*", OutcomeAsk},
		{"cat ~/.ssh/config", OutcomeAsk},
		{"cp foo/.ssh/id_rsa /tmp/k", OutcomeAsk},
		{"rm -rf .env.local", OutcomeDeny},
		{"rm -rf ~/.ssh", OutcomeDeny},
		{"echo shadow > ~/.lelu/claude-plugin/mode", OutcomeAsk},
	}
	for _, tc := range cases {
		t.Run(tc.cmd, func(t *testing.T) {
			if got := decideAs(t, false, Request{Tool: "Bash", Command: tc.cmd}); got.Outcome != tc.want {
				t.Errorf("outcome = %q, want %q; response=%+v", got.Outcome, tc.want, got)
			}
		})
	}
}

// Grep and Glob read files too, so a search of a secret file asks, as a
// Read of it does.
func TestPathRules_GrepAndGlob(t *testing.T) {
	cases := []struct {
		name string
		req  Request
		want Outcome
	}{
		{"Grep of the project", Request{Tool: "Grep"}, OutcomeAllow},
		{"Grep of source files", Request{Tool: "Grep", Path: "src", Glob: "*.ts"}, OutcomeAllow},
		{"Grep with a match-all glob", Request{Tool: "Grep", Glob: "**/*"}, OutcomeAllow},
		{"Grep of env templates", Request{Tool: "Grep", Glob: "**/.env.example"}, OutcomeAllow},
		{"Grep of a name containing env", Request{Tool: "Grep", Glob: "**/*.environment.ts"}, OutcomeAllow},
		{"Glob for markdown", Request{Tool: "Glob", Glob: "**/*.md", Path: "/home/testuser/project/docs"}, OutcomeAllow},
		{"Glob for ssh docs", Request{Tool: "Glob", Glob: "docs/*.ssh.md"}, OutcomeAllow},

		{"Grep of ~/.ssh", Request{Tool: "Grep", Path: "/home/testuser/.ssh"}, OutcomeAsk},
		{"Grep of ~/.ssh with tilde", Request{Tool: "Grep", Path: "~/.ssh"}, OutcomeAsk},
		{"Grep of a key file", Request{Tool: "Grep", Path: "/home/testuser/.ssh/id_rsa"}, OutcomeAsk},
		{"Grep of the .env file", Request{Tool: "Grep", Path: ".env"}, OutcomeAsk},
		{"Grep with glob .env", Request{Tool: "Grep", Glob: ".env"}, OutcomeAsk},
		{"Grep with glob .env*", Request{Tool: "Grep", Glob: "**/.env*"}, OutcomeAsk},
		{"Grep with glob .env.*", Request{Tool: "Grep", Glob: ".env.*"}, OutcomeAsk},
		{"Grep with a brace glob", Request{Tool: "Grep", Glob: "**/{.env,config.ts}"}, OutcomeAsk},
		{"Grep of ~/.aws", Request{Tool: "Grep", Path: "/home/testuser/.aws"}, OutcomeAsk},
		{"Grep of ~/.aws for credentials", Request{Tool: "Grep", Path: "/home/testuser/.aws", Glob: "credentials"}, OutcomeAsk},
		{"Grep from a cwd inside ~/.ssh", Request{Tool: "Grep", Cwd: "/home/testuser/.ssh"}, OutcomeAsk},
		{"Glob for .env files", Request{Tool: "Glob", Glob: "**/.env"}, OutcomeAsk},
		{"Glob for .env.local", Request{Tool: "Glob", Glob: "**/.env.local"}, OutcomeAsk},
		{"Glob for keys", Request{Tool: "Glob", Glob: "**/id_rsa*"}, OutcomeAsk},
		{"Glob inside ~/.ssh", Request{Tool: "Glob", Glob: "~/.ssh/*"}, OutcomeAsk},
		{"Glob of ~/.aws contents", Request{Tool: "Glob", Path: "/home/testuser", Glob: ".aws/*"}, OutcomeAsk},
		{"Glob with a relative path into ~/.ssh", Request{Tool: "Glob", Path: "../.ssh", Glob: "*"}, OutcomeAsk},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := decideAs(t, false, tc.req); got.Outcome != tc.want {
				t.Errorf("outcome = %q, want %q; response=%+v", got.Outcome, tc.want, got)
			}
		})
	}
}

func TestLedger_RecordsGrepAndGlobPaths(t *testing.T) {
	engine, dir := newTestEngine(t, true)
	engine.Decide(Request{SessionID: "s", Tool: "Grep", Path: "/home/testuser/.ssh", Glob: "*.pub",
		Cwd: "/home/testuser/project", Env: map[string]string{"HOME": testHome}})
	data, err := os.ReadFile(filepath.Join(dir, "ledger.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	line := string(data)
	for _, want := range []string{`"path":"/home/testuser/.ssh"`, `"glob":"*.pub"`, `"outcome":"ask"`} {
		if !strings.Contains(line, want) {
			t.Errorf("ledger line missing %s: %s", want, line)
		}
	}
}

// Shadow mode records and blocks nothing, except a change to Lelu's own
// files or Claude Code's settings: that change would still be in place once
// enforcement is on, so it asks in shadow mode too.
func TestShadowMode_StillAsksForSelfProtection(t *testing.T) {
	cases := []struct {
		name string
		req  Request
		want Outcome
	}{
		{"Write the mode file", Request{Tool: "Write", FilePath: "/home/testuser/.lelu/claude-plugin/mode"}, OutcomeAsk},
		{"Write the local policy", Request{Tool: "Write", FilePath: "/home/testuser/.lelu/claude-plugin/policy.local.json"}, OutcomeAsk},
		{"Edit the plugin's hooks", Request{Tool: "Edit", FilePath: "/home/testuser/.claude/plugins/cache/lelu/lelu/0.3.0/hooks/hooks.json"}, OutcomeAsk},
		{"Edit Claude Code settings", Request{Tool: "Edit", FilePath: "/home/testuser/.claude/settings.json"}, OutcomeAsk},
		{"Edit project settings", Request{Tool: "MultiEdit", FilePath: "/home/testuser/project/.claude/settings.local.json"}, OutcomeAsk},
		{"Bash writes the mode file", Request{Tool: "Bash", Command: "echo shadow > ~/.lelu/claude-plugin/mode"}, OutcomeAsk},
		// A stricter rule in the same line must not hide the self-protection
		// ask, which shadow mode would otherwise turn into an allow.
		{"Bash mode write next to a deny", Request{Tool: "Bash", Command: "printf x > ~/.lelu/claude-plugin/mode; rm -rf ~"}, OutcomeAsk},
		// Everything else is still only recorded.
		{"Bash home wipe", Request{Tool: "Bash", Command: "rm -rf ~"}, OutcomeAllow},
		{"Write .env", Request{Tool: "Write", FilePath: "/home/testuser/project/.env"}, OutcomeAllow},
		{"Read the mode file", Request{Tool: "Read", FilePath: "/home/testuser/.lelu/claude-plugin/mode"}, OutcomeAllow},
		{"cat the ledger", Request{Tool: "Bash", Command: "tail -n 5 ~/.lelu/claude-plugin/ledger.jsonl"}, OutcomeAllow},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := decideAs(t, true, tc.req)
			if got.Outcome != tc.want {
				t.Errorf("outcome = %q, want %q; response=%+v", got.Outcome, tc.want, got)
			}
			if !got.Shadow {
				t.Errorf("response should still report shadow mode: %+v", got)
			}
		})
	}
}

func TestExpandBraces(t *testing.T) {
	cases := map[string][]string{
		"*.go":               {"*.go"},
		"**/.{env,netrc}":    {"**/.env", "**/.netrc"},
		"{a,b}/{c,d}":        {"a/c", "a/d", "b/c", "b/d"},
		"x{a,{b,c}}y":        {"xay", "xby", "xcy"},
		"unclosed{a,b":       {"unclosed{a,b"},
		"no-alternatives{a}": {"no-alternatives{a}"},
	}
	for in, want := range cases {
		if got := expandBraces(in); !reflect.DeepEqual(got, want) {
			t.Errorf("expandBraces(%q) = %q, want %q", in, got, want)
		}
	}
}

// Rules users add with "contains" keep matching text anywhere in the path.
func TestPathRules_ContainsStillMatchesSubstrings(t *testing.T) {
	r := protectedPathRule{Contains: "prod-db"}
	if !r.matches("/srv/prod-db-backup/dump.sql", testHome) {
		t.Error("a contains rule should match text anywhere in the path")
	}
}
