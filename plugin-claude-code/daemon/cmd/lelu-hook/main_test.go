package main

import (
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

func TestDaemonBinaryPath_PrefersPluginRoot(t *testing.T) {
	t.Setenv("CLAUDE_PLUGIN_ROOT", "/opt/plugins/lelu")
	got := daemonBinaryPath()
	want := filepath.Join("/opt/plugins/lelu", "bin", "lelu-daemon")
	if got != want {
		t.Errorf("daemonBinaryPath() = %q, want %q", got, want)
	}
}

func TestDaemonBinaryPath_FallsBackToSiblingOfExecutable(t *testing.T) {
	t.Setenv("CLAUDE_PLUGIN_ROOT", "")
	got := daemonBinaryPath()
	if got == "" {
		t.Fatal("expected a non-empty fallback path")
	}
	if filepath.Base(got) != "lelu-daemon" {
		t.Errorf("daemonBinaryPath() = %q, want it to end in lelu-daemon", got)
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
	build := exec.Command("go", "build", "-o", daemonBin, "../lelu-daemon")
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
