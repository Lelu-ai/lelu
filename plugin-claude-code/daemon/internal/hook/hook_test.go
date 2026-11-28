package hook

import (
	"encoding/json"
	"errors"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	lelu "github.com/lelu-ai/lelu/plugin-claude-code/daemon"
)

type fakeTimeoutErr struct{}

func (fakeTimeoutErr) Error() string   { return "i/o timeout" }
func (fakeTimeoutErr) Timeout() bool   { return true }
func (fakeTimeoutErr) Temporary() bool { return true }

func TestShouldSpawn_ConnectionRefusedYes(t *testing.T) {
	err := &net.OpError{Op: "dial", Err: syscall.ECONNREFUSED}
	if !shouldSpawn(err) {
		t.Error("connection refused should trigger a spawn attempt")
	}
}

func TestShouldSpawn_NoSuchFileYes(t *testing.T) {
	err := &net.OpError{Op: "dial", Err: syscall.ENOENT}
	if !shouldSpawn(err) {
		t.Error("missing socket file should trigger a spawn attempt")
	}
}

func TestShouldSpawn_TimeoutNo(t *testing.T) {
	var netErr net.Error = fakeTimeoutErr{}
	if shouldSpawn(netErr) {
		t.Error("a timeout (daemon present but slow/hung) must NOT trigger spawning a second daemon")
	}
}

func TestShouldSpawn_OtherErrorNo(t *testing.T) {
	err := errors.New("some unrelated error")
	if shouldSpawn(err) {
		t.Error("an unrecognized error should not trigger a spawn attempt")
	}
}

func TestDaemonBinaryPath_PrefersExplicitDaemonBin(t *testing.T) {
	// hooks/lelu-hook.sh points at the release binary it downloaded into the
	// data directory; that must win over the plugin folder, which has none.
	t.Setenv("CLAUDE_PLUGIN_ROOT", "/opt/plugins/lelu")
	t.Setenv("LELU_DAEMON_BIN", "/home/u/.lelu/claude-plugin/bin/0.2.0/lelu-daemon")
	got := daemonBinaryPath()
	if want := "/home/u/.lelu/claude-plugin/bin/0.2.0/lelu-daemon"; got != want {
		t.Errorf("daemonBinaryPath() = %q, want %q", got, want)
	}
}

func TestDaemonBinaryPath_PrefersPluginRoot(t *testing.T) {
	t.Setenv("LELU_DAEMON_BIN", "")
	t.Setenv("CLAUDE_PLUGIN_ROOT", "/opt/plugins/lelu")
	got := daemonBinaryPath()
	want := filepath.Join("/opt/plugins/lelu", "bin", "lelu-daemon")
	if got != want {
		t.Errorf("daemonBinaryPath() = %q, want %q", got, want)
	}
}

func TestDaemonBinaryPath_FallsBackToSiblingOfExecutable(t *testing.T) {
	t.Setenv("LELU_DAEMON_BIN", "")
	t.Setenv("CLAUDE_PLUGIN_ROOT", "")
	got := daemonBinaryPath()
	if got == "" {
		t.Fatal("expected a non-empty fallback path")
	}
	if filepath.Base(got) != "lelu-daemon" {
		t.Errorf("daemonBinaryPath() = %q, want it to end in lelu-daemon", got)
	}
}

func TestUnreachableMessage_LocalBuildMissingPointsToInstallScript(t *testing.T) {
	pluginRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(pluginRoot, "install.sh"), []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("LELU_DAEMON_BIN", "")
	t.Setenv("CLAUDE_PLUGIN_ROOT", pluginRoot) // bin/lelu-daemon deliberately not created

	msg := unreachableMessage(errors.New("connect: no such file or directory"))
	if !strings.Contains(msg, filepath.Join(pluginRoot, "install.sh")) {
		t.Errorf("message should include the concrete install.sh path, got: %q", msg)
	}
}

// The checker hooks/lelu-hook.sh downloads lives in the data directory,
// which has no install.sh. The message must not name one there.
func TestUnreachableMessage_DownloadedCheckerMissingNamesNoScript(t *testing.T) {
	dataBin := filepath.Join(t.TempDir(), "bin", "0.3.0")
	t.Setenv("CLAUDE_PLUGIN_ROOT", t.TempDir())
	t.Setenv("LELU_DAEMON_BIN", filepath.Join(dataBin, "lelu-daemon"))

	msg := unreachableMessage(errors.New("connect: no such file or directory"))
	if strings.Contains(msg, "install.sh") {
		t.Errorf("message names an install.sh that does not exist: %q", msg)
	}
	if !strings.Contains(msg, "/plugin install lelu@lelu") || !strings.Contains(msg, "downloads it again") {
		t.Errorf("message should give the real recovery steps, got: %q", msg)
	}
}

// A plugin root with no install.sh (for example a marketplace copy without a
// local build) gets the reinstall step, not a path that does not exist.
func TestUnreachableMessage_NoInstallScriptNamesNone(t *testing.T) {
	t.Setenv("LELU_DAEMON_BIN", "")
	t.Setenv("CLAUDE_PLUGIN_ROOT", t.TempDir())

	msg := unreachableMessage(errors.New("connect: no such file or directory"))
	if strings.Contains(msg, "install.sh") {
		t.Errorf("message names an install.sh that does not exist: %q", msg)
	}
}

func TestUnreachableMessage_BinaryPresentReportsDialError(t *testing.T) {
	pluginRoot := t.TempDir()
	if err := os.MkdirAll(filepath.Join(pluginRoot, "bin"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(pluginRoot, "bin", "lelu-daemon"), []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CLAUDE_PLUGIN_ROOT", pluginRoot)

	msg := unreachableMessage(errors.New("connect: connection refused"))
	if strings.Contains(msg, "install.sh") {
		t.Errorf("message should not mention install.sh when the binary already exists, got: %q", msg)
	}
	if !strings.Contains(msg, "connection refused") {
		t.Errorf("message should surface the real dial error when the binary exists, got: %q", msg)
	}
}

// TestAskDaemon_SpawnsAndRecoversWhenDaemonIsDown builds the real
// lelu-daemon binary, points everything at an isolated data dir with no
// daemon running, and confirms askDaemon's lazy self-start actually brings
// one up and gets a real (non-error) decision back — not just that the pure
// helper functions return the right booleans in isolation.
func TestAskDaemon_SpawnsAndRecoversWhenDaemonIsDown(t *testing.T) {
	if testing.Short() {
		t.Skip("builds a real binary and starts a real process; skipped in -short")
	}

	dataDir := t.TempDir()
	pluginRoot := t.TempDir()
	binDir := filepath.Join(pluginRoot, "bin")
	if err := os.MkdirAll(binDir, 0o755); err != nil {
		t.Fatal(err)
	}
	policyDir := filepath.Join(pluginRoot, "policies")
	if err := os.MkdirAll(policyDir, 0o755); err != nil {
		t.Fatal(err)
	}
	policyData, err := os.ReadFile("../../../policies/defaults.json")
	if err != nil {
		t.Fatalf("reading real default policy for fixture: %v", err)
	}
	if err := os.WriteFile(filepath.Join(policyDir, "defaults.json"), policyData, 0o644); err != nil {
		t.Fatal(err)
	}

	daemonBin := filepath.Join(binDir, "lelu-daemon")
	build := exec.Command("go", "build", "-o", daemonBin, "../../cmd/lelu-daemon")
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("building lelu-daemon fixture: %v\n%s", err, out)
	}

	t.Setenv("CLAUDE_PLUGIN_ROOT", pluginRoot)
	t.Setenv("LELU_DATA_DIR", dataDir)
	t.Setenv("LELU_POLICY_PATH", filepath.Join(policyDir, "defaults.json"))
	t.Setenv("HOME", "/home/testuser")

	req := lelu.Request{
		SessionID: "test-session",
		Tool:      "Bash",
		Command:   "echo hi",
		Cwd:       "/home/testuser",
		Env:       map[string]string{"HOME": "/home/testuser"},
	}

	// Confirm nothing is listening yet.
	if _, err := net.DialTimeout("unix", socketPath(), 50*time.Millisecond); err == nil {
		t.Fatal("expected no daemon listening before the test starts")
	}

	resp, err := askDaemon(req)
	t.Cleanup(func() { killDaemonListeningOn(t, socketPath()) })
	if err != nil {
		t.Fatalf("askDaemon did not recover after self-starting the daemon: %v", err)
	}
	if resp.Outcome == "" {
		t.Fatalf("expected a real decision after self-start, got empty response: %+v", resp)
	}
}

// killDaemonListeningOn finds the process that owns the given unix socket
// and kills it, so this test doesn't leak a background daemon process on
// every run — Go's t.TempDir() cleans up the directory but has no idea a
// detached (Setsid) child process even exists.
func killDaemonListeningOn(t *testing.T, sockPath string) {
	t.Helper()
	out, err := exec.Command("fuser", sockPath).Output()
	if err != nil {
		return
	}
	for _, f := range strings.Fields(string(out)) {
		if pid, err := strconv.Atoi(f); err == nil {
			_ = syscall.Kill(pid, syscall.SIGTERM)
		}
	}
}

// An explicit "allow" skips Claude Code's own permission prompt and auto-mode
// classifier, so the hook must never emit one — not for an unmatched call,
// not in shadow mode, and not when the daemon is unreachable.
func TestDecisionFor_NeverEmitsAllow(t *testing.T) {
	cases := map[string]lelu.Response{
		"no rule matched": {Outcome: lelu.OutcomeAllow},
		"shadow override": {Outcome: lelu.OutcomeAllow, Shadow: true, Reason: "[shadow mode] would have been deny: x"},
	}
	for name, resp := range cases {
		out := decisionFor(resp)
		if out.HookSpecificOutput.PermissionDecision != "" {
			t.Errorf("%s: PermissionDecision = %q, want empty (defer to Claude Code)", name, out.HookSpecificOutput.PermissionDecision)
		}
		raw, _ := json.Marshal(out)
		if strings.Contains(string(raw), "permissionDecision") {
			t.Errorf("%s: output must not contain permissionDecision at all, got %s", name, raw)
		}
	}
	if got := decisionFor(lelu.Response{Outcome: lelu.OutcomeAllow, Shadow: true, Reason: "r"}).HookSpecificOutput.AdditionalContext; got != "r" {
		t.Errorf("shadow reason should still reach the model, got %q", got)
	}
}

func TestDecisionFor_DenyAndAskStayExplicit(t *testing.T) {
	if got := decisionFor(lelu.Response{Outcome: lelu.OutcomeDeny, Reason: "x"}).HookSpecificOutput.PermissionDecision; got != "deny" {
		t.Errorf("deny: got %q", got)
	}
	if got := decisionFor(lelu.Response{Outcome: lelu.OutcomeAsk, Reason: "x"}).HookSpecificOutput.PermissionDecision; got != "ask" {
		t.Errorf("ask: got %q", got)
	}
}

func TestWarningOutput_FailOpenIsVisibleAndNotAnAllow(t *testing.T) {
	out := warningOutput("Lelu daemon unreachable")
	if out.HookSpecificOutput.PermissionDecision != "" {
		t.Errorf("fail-open must not emit a permission decision, got %q", out.HookSpecificOutput.PermissionDecision)
	}
	if !strings.Contains(out.SystemMessage, "daemon unreachable") {
		t.Errorf("fail-open warning must be shown to the user via systemMessage, got %q", out.SystemMessage)
	}
}

func TestFailClosed_FollowsModeUnlessOverridden(t *testing.T) {
	cases := []struct {
		name, mode, env string
		want            bool
	}{
		{name: "no mode file is shadow", mode: "", env: "", want: false},
		{name: "shadow mode", mode: "shadow", env: "", want: false},
		{name: "enforce mode", mode: "enforce", env: "", want: true},
		{name: "capitalized enforce", mode: "Enforce", env: "", want: true},
		{name: "upper-case enforce", mode: "ENFORCE", env: "", want: true},
		{name: "enforce with whitespace", mode: "  enforce \n", env: "", want: true},
		{name: "unrecognized value is shadow", mode: "enforcing", env: "", want: false},
		{name: "empty file is shadow", mode: "\n", env: "", want: false},
		{name: "override on in shadow mode", mode: "shadow", env: "1", want: true},
		{name: "override off in enforce mode", mode: "enforce", env: "0", want: false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			t.Setenv("LELU_DATA_DIR", dir)
			t.Setenv("LELU_FAIL_CLOSED", tc.env)
			if tc.mode != "" {
				if err := os.WriteFile(filepath.Join(dir, "mode"), []byte(tc.mode), 0o600); err != nil {
					t.Fatal(err)
				}
			}
			if got := failClosed(); got != tc.want {
				t.Errorf("failClosed() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestCannotCheck_ClosedAsksAndOpenTakesNoDecision(t *testing.T) {
	closed := cannotCheck("daemon unreachable", true)
	if closed.HookSpecificOutput.PermissionDecision != "ask" {
		t.Errorf("fail-closed decision = %q, want ask", closed.HookSpecificOutput.PermissionDecision)
	}
	if closed.SystemMessage == "" || closed.HookSpecificOutput.PermissionDecisionReason == "" {
		t.Errorf("fail-closed output must tell the user why: %+v", closed)
	}

	open := cannotCheck("daemon unreachable", false)
	if open.HookSpecificOutput.PermissionDecision != "" {
		t.Errorf("fail-open must not take a decision, got %q", open.HookSpecificOutput.PermissionDecision)
	}
	if open.SystemMessage == "" {
		t.Errorf("fail-open must still warn the user")
	}
}

func TestRequestFrom_MapsNotebookPathAndURL(t *testing.T) {
	var in hookInput
	in.ToolName = "NotebookEdit"
	in.ToolInput.NotebookPath = "/p/analysis.ipynb"
	if got := requestFrom(in).FilePath; got != "/p/analysis.ipynb" {
		t.Errorf("NotebookEdit FilePath = %q, want the notebook path", got)
	}

	in = hookInput{ToolName: "WebFetch"}
	in.ToolInput.URL = "https://example.com/x"
	if got := requestFrom(in).URL; got != "https://example.com/x" {
		t.Errorf("WebFetch URL = %q, want it passed through", got)
	}
}

func TestRequestFrom_MapsGrepAndGlobPaths(t *testing.T) {
	var grep hookInput
	raw := `{"tool_name":"Grep","tool_input":{"pattern":"API_KEY","path":"/p","glob":"**/.env*","output_mode":"content"}}`
	if err := json.Unmarshal([]byte(raw), &grep); err != nil {
		t.Fatal(err)
	}
	if req := requestFrom(grep); req.Path != "/p" || req.Glob != "**/.env*" {
		t.Errorf("Grep: path=%q glob=%q, want /p and its glob (not the content pattern)", req.Path, req.Glob)
	}

	var glob hookInput
	raw = `{"tool_name":"Glob","tool_input":{"pattern":"**/.env","path":"/p"}}`
	if err := json.Unmarshal([]byte(raw), &glob); err != nil {
		t.Fatal(err)
	}
	if req := requestFrom(glob); req.Path != "/p" || req.Glob != "**/.env" {
		t.Errorf("Glob: path=%q glob=%q, want /p and its pattern", req.Path, req.Glob)
	}
}
