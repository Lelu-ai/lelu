package daemon

import "testing"

func TestEngine_ToolRules(t *testing.T) {
	cases := []struct {
		name string
		req  Request
		want Outcome
	}{
		{"MultiEdit on a protected path", Request{Tool: "MultiEdit", FilePath: "/home/testuser/project/.env"}, OutcomeDeny},
		{"NotebookEdit on a protected path", Request{Tool: "NotebookEdit", FilePath: "/home/testuser/project/.env"}, OutcomeDeny},
		{"MultiEdit on an ordinary file", Request{Tool: "MultiEdit", FilePath: "/home/testuser/project/main.go"}, OutcomeAllow},
		{"Read of an SSH key", Request{Tool: "Read", FilePath: "/home/testuser/.ssh/id_ed25519"}, OutcomeAsk},
		{"Read of AWS credentials", Request{Tool: "Read", FilePath: "/home/testuser/.aws/credentials"}, OutcomeAsk},
		{"Read of an ordinary file", Request{Tool: "Read", FilePath: "/home/testuser/project/main.go"}, OutcomeAllow},
		{"WebFetch to an allowed host", Request{Tool: "WebFetch", URL: "https://pkg.go.dev/net/url"}, OutcomeAllow},
		{"WebFetch to an allowed host's subdomain", Request{Tool: "WebFetch", URL: "https://gist.github.com/x"}, OutcomeAllow},
		{"WebFetch to another host", Request{Tool: "WebFetch", URL: "https://attacker.example/upload?d=secret"}, OutcomeAsk},
		{"WebFetch to a lookalike host", Request{Tool: "WebFetch", URL: "https://evilgithub.com/x"}, OutcomeAsk},
		{"WebFetch with a non-http URL", Request{Tool: "WebFetch", URL: "file:///etc/passwd"}, OutcomeAsk},
		{"WebFetch with no URL", Request{Tool: "WebFetch"}, OutcomeAsk},
		{"Task is allowed (sub-agent calls are hooked too)", Request{Tool: "Task"}, OutcomeAllow},
		{"Grep of ordinary files is allowed", Request{Tool: "Grep", Path: "src", Glob: "*.go"}, OutcomeAllow},
		{"MCP tool keeps current behaviour", Request{Tool: "mcp__github__create_issue"}, OutcomeAllow},
		{"unknown tool asks", Request{Tool: "SomeNewTool"}, OutcomeAsk},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			engine, _ := newTestEngine(t, false)
			tc.req.SessionID = "s-" + tc.name
			tc.req.Cwd = "/home/testuser/project"
			tc.req.Env = map[string]string{"HOME": "/home/testuser"}
			if got := engine.Decide(tc.req); got.Outcome != tc.want {
				t.Errorf("outcome = %q, want %q; response=%+v", got.Outcome, tc.want, got)
			}
		})
	}
}

func TestMerge_LocalToolAndHostAllowLists(t *testing.T) {
	ps := loadTestPolicy(t)
	ps.Merge(&PolicySet{Tools: ToolPolicy{Allow: []string{"SomeNewTool"}, WebFetchAllowedHosts: []string{"internal.example"}}})
	if !ps.toolAllowed("SomeNewTool") {
		t.Error("a tool added in the local file should be allowed")
	}
	if _, ok := ps.webFetchHostAllowed("https://wiki.internal.example/page"); !ok {
		t.Error("a host added in the local file should be allowed, with its subdomains")
	}
	if !ps.toolAllowed("LS") {
		t.Error("merging must keep the default allow list")
	}
}
