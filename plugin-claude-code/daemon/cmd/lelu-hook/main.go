// Command lelu-hook is the thin PreToolUse adapter registered in hooks.json.
// It reads Claude Code's hook JSON on stdin, asks the local lelu-daemon for a
// decision over a unix socket, and prints Claude Code's expected
// hookSpecificOutput JSON to stdout.
//
// Failure mode, deliberately: if the daemon can't be reached or times out,
// this fails OPEN (allow) rather than blocking every tool call in Claude Code
// over an infra hiccup — but it says so loudly via additionalContext rather
// than silently dropping protection. Claude Code's own permission system and
// sandboxing remain the backstop underneath; Lelu is a supplement, not a
// replacement, so failing open here does not leave the user unprotected in
// the way it would for Lelu's own core engine.
package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/lelu-ai/lelu/plugin-claude-code/daemon"
)

const dialTimeout = 300 * time.Millisecond
const roundTripTimeout = 2 * time.Second
const spawnRetryDelay = 200 * time.Millisecond

// hookInput mirrors Claude Code's PreToolUse stdin schema.
type hookInput struct {
	SessionID string `json:"session_id"`
	Cwd       string `json:"cwd"`
	ToolName  string `json:"tool_name"`
	ToolInput struct {
		Command   string `json:"command"`
		FilePath  string `json:"file_path"`
		NewString string `json:"new_string"`
		OldString string `json:"old_string"`
		Content   string `json:"content"`
	} `json:"tool_input"`
}

type hookSpecificOutput struct {
	HookEventName            string `json:"hookEventName"`
	PermissionDecision       string `json:"permissionDecision"`
	PermissionDecisionReason string `json:"permissionDecisionReason,omitempty"`
	AdditionalContext        string `json:"additionalContext,omitempty"`
}

type hookOutput struct {
	HookSpecificOutput hookSpecificOutput `json:"hookSpecificOutput"`
}

func main() {
	raw, err := io.ReadAll(os.Stdin)
	if err != nil {
		allowWithWarning("could not read hook input: " + err.Error())
		return
	}

	var in hookInput
	if err := json.Unmarshal(raw, &in); err != nil {
		allowWithWarning("could not parse hook input JSON: " + err.Error())
		return
	}

	req := daemon.Request{
		SessionID: in.SessionID,
		Tool:      in.ToolName,
		Command:   in.ToolInput.Command,
		FilePath:  in.ToolInput.FilePath,
		NewString: in.ToolInput.NewString,
		OldString: in.ToolInput.OldString,
		Content:   in.ToolInput.Content,
		Cwd:       in.Cwd,
		Env:       currentEnv(),
	}

	resp, err := askDaemon(req)
	if err != nil {
		allowWithWarning("Lelu daemon unreachable (" + err.Error() + ") — this action was not checked")
		return
	}

	print_(decisionFor(resp))
}

func decisionFor(resp daemon.Response) hookOutput {
	out := hookSpecificOutput{HookEventName: "PreToolUse"}

	switch resp.Outcome {
	case daemon.OutcomeDeny:
		out.PermissionDecision = "deny"
		out.PermissionDecisionReason = resp.Reason
	case daemon.OutcomeAsk:
		out.PermissionDecision = "ask"
		out.PermissionDecisionReason = resp.Reason
	default: // allow, including shadow-mode overrides
		out.PermissionDecision = "allow"
		if resp.Shadow && resp.Reason != "" {
			out.AdditionalContext = resp.Reason
		}
	}

	return hookOutput{HookSpecificOutput: out}
}

func allowWithWarning(msg string) {
	print_(hookOutput{HookSpecificOutput: hookSpecificOutput{
		HookEventName:      "PreToolUse",
		PermissionDecision: "allow",
		AdditionalContext:  "⚠️ " + msg,
	}})
}

func print_(out hookOutput) {
	enc := json.NewEncoder(os.Stdout)
	_ = enc.Encode(out)
}

// askDaemon tries the socket once; if nothing is listening (as opposed to a
// slow/hung daemon — see shouldSpawn), it makes one best-effort attempt to
// start the daemon itself and retries a single time after a short delay.
// This is the lazy self-start: it closes the window between "daemon crashed"
// and "user notices and reruns install.sh" down to about spawnRetryDelay,
// without needing OS-specific supervision (systemd/launchd) for the wedge
// stage.
func askDaemon(req daemon.Request) (daemon.Response, error) {
	resp, err := dialOnce(req)
	if err == nil {
		return resp, nil
	}
	if !shouldSpawn(err) {
		return daemon.Response{}, err
	}

	spawnDaemon()
	time.Sleep(spawnRetryDelay)

	return dialOnce(req)
}

func dialOnce(req daemon.Request) (daemon.Response, error) {
	conn, err := net.DialTimeout("unix", socketPath(), dialTimeout)
	if err != nil {
		return daemon.Response{}, err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(roundTripTimeout))

	data, err := json.Marshal(req)
	if err != nil {
		return daemon.Response{}, err
	}
	data = append(data, '\n')
	if _, err := conn.Write(data); err != nil {
		return daemon.Response{}, err
	}

	scanner := bufio.NewScanner(conn)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	if !scanner.Scan() {
		if err := scanner.Err(); err != nil {
			return daemon.Response{}, err
		}
		return daemon.Response{}, io.ErrUnexpectedEOF
	}

	var resp daemon.Response
	if err := json.Unmarshal(scanner.Bytes(), &resp); err != nil {
		return daemon.Response{}, err
	}
	return resp, nil
}

// shouldSpawn reports whether a dial error means "nothing is listening"
// (worth trying to start) as opposed to "something's there but slow/hung"
// (spawning a second daemon would be wrong — it would just fail to bind the
// socket and exit, but there's no point trying).
func shouldSpawn(err error) bool {
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return false
	}
	return errors.Is(err, syscall.ECONNREFUSED) || errors.Is(err, syscall.ENOENT) || os.IsNotExist(err)
}

func spawnDaemon() {
	bin := daemonBinaryPath()
	if bin == "" {
		return
	}
	if _, err := os.Stat(bin); err != nil {
		return
	}

	logPath := filepath.Join(dataDir(), "daemon.log")
	logFile, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}

	cmd := exec.Command(bin)
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	// Setsid detaches the daemon into its own session so it outlives this
	// short-lived hook process — a plain background "&" is not enough; it
	// stays in the same process group and can be reaped along with it.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	_ = cmd.Start()
	// Deliberately not Wait()'d: a Setsid child is no longer this process's
	// responsibility, and this process is about to exit anyway.
}

// daemonBinaryPath resolves the daemon binary the same way for a real
// install (relative to CLAUDE_PLUGIN_ROOT) and for local dev/testing
// (relative to this hook binary's own location, mirroring install.sh's
// hooks/ + bin/ sibling layout).
func daemonBinaryPath() string {
	if root := os.Getenv("CLAUDE_PLUGIN_ROOT"); root != "" {
		return filepath.Join(root, "bin", "lelu-daemon")
	}
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	return filepath.Join(filepath.Dir(exe), "..", "bin", "lelu-daemon")
}

func dataDir() string {
	if d := os.Getenv("LELU_DATA_DIR"); d != "" {
		return d
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return ".lelu-claude-plugin"
	}
	return filepath.Join(home, ".lelu", "claude-plugin")
}

func socketPath() string {
	return filepath.Join(dataDir(), "daemon.sock")
}

func currentEnv() map[string]string {
	env := map[string]string{}
	for _, kv := range os.Environ() {
		if i := strings.IndexByte(kv, '='); i >= 0 {
			env[kv[:i]] = kv[i+1:]
		}
	}
	return env
}
