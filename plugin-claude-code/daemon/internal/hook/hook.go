// Package hook is the thin PreToolUse adapter registered in hooks.json.
// It reads Claude Code's hook JSON on stdin, asks the local lelu-daemon for a
// decision over a unix socket, and prints Claude Code's expected
// hookSpecificOutput JSON to stdout.
//
// The hook only ever *adds* friction. It emits an explicit permissionDecision
// for deny and ask, and nothing at all otherwise. An explicit "allow" is not
// neutral in Claude Code: it skips the user's permission prompt and auto
// mode's safety classifier, so emitting it for "no rule matched" (or in
// shadow mode, or when the daemon is down) left a user with the plugin
// installed less protected than without it.
//
// Failure mode: if the action can't be checked (the daemon can't be reached
// or times out, or the hook input is unreadable), the user is always told via
// systemMessage (shown in the UI) and the model via additionalContext. In
// shadow mode the call is then left to Claude Code's own permission flow. In
// enforce mode it is routed to "ask" instead: once the user has turned
// blocking on, an agent must not be able to get past Lelu by stopping the
// daemon. LELU_FAIL_CLOSED=1 or =0 overrides either default.
package hook

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
	SessionID      string `json:"session_id"`
	Cwd            string `json:"cwd"`
	TranscriptPath string `json:"transcript_path"`
	ToolName       string `json:"tool_name"`
	ToolInput      struct {
		Command   string `json:"command"`
		FilePath  string `json:"file_path"`
		NewString string `json:"new_string"`
		OldString string `json:"old_string"`
		Content   string `json:"content"`
		// NotebookEdit names its file notebook_path; WebFetch has a url.
		NotebookPath string `json:"notebook_path"`
		URL          string `json:"url"`
	} `json:"tool_input"`
}

type hookSpecificOutput struct {
	HookEventName string `json:"hookEventName"`
	// PermissionDecision is only ever "deny" or "ask". Empty means "no
	// opinion", which leaves Claude Code's normal permission flow in charge.
	PermissionDecision       string `json:"permissionDecision,omitempty"`
	PermissionDecisionReason string `json:"permissionDecisionReason,omitempty"`
	AdditionalContext        string `json:"additionalContext,omitempty"`
}

type hookOutput struct {
	// SystemMessage is shown to the user, unlike additionalContext which only
	// reaches the model.
	SystemMessage      string             `json:"systemMessage,omitempty"`
	HookSpecificOutput hookSpecificOutput `json:"hookSpecificOutput"`
}

func Main() {
	raw, err := io.ReadAll(os.Stdin)
	if err != nil {
		print_(cannotCheck("could not read hook input: "+err.Error(), failClosed()))
		return
	}

	var in hookInput
	if err := json.Unmarshal(raw, &in); err != nil {
		print_(cannotCheck("could not parse hook input JSON: "+err.Error(), failClosed()))
		return
	}

	resp, err := askDaemon(requestFrom(in))
	if err != nil {
		print_(cannotCheck(unreachableMessage(err), failClosed()))
		return
	}

	print_(decisionFor(resp))
}

// requestFrom turns Claude Code's hook input into a daemon request.
func requestFrom(in hookInput) daemon.Request {
	filePath := in.ToolInput.FilePath
	if filePath == "" {
		filePath = in.ToolInput.NotebookPath
	}
	return daemon.Request{
		SessionID:      in.SessionID,
		Tool:           in.ToolName,
		Command:        in.ToolInput.Command,
		FilePath:       filePath,
		NewString:      in.ToolInput.NewString,
		OldString:      in.ToolInput.OldString,
		Content:        in.ToolInput.Content,
		URL:            in.ToolInput.URL,
		Cwd:            in.Cwd,
		TranscriptPath: in.TranscriptPath,
		Env:            currentEnv(),
	}
}

// failClosed reports whether an action Lelu cannot check should be routed to
// "ask". LELU_FAIL_CLOSED=1 (or true) and =0 (or false) decide outright.
// Otherwise it follows the plugin mode: enforce fails closed, shadow mode
// (the default, including when there is no mode file) does not.
func failClosed() bool {
	switch strings.ToLower(os.Getenv("LELU_FAIL_CLOSED")) {
	case "1", "true":
		return true
	case "0", "false":
		return false
	}
	data, err := os.ReadFile(filepath.Join(dataDir(), "mode"))
	return err == nil && strings.TrimSpace(string(data)) == "enforce"
}

// unreachableMessage distinguishes "nothing has been built/installed here
// yet" from "the daemon just isn't running right now" — a stranger's very
// first tool call after installing the plugin via the marketplace (before
// ever running install.sh) should get a clear next step, not a generic
// connectivity warning that doesn't say what to do about it.
func unreachableMessage(dialErr error) string {
	bin := daemonBinaryPath()
	if _, statErr := os.Stat(bin); statErr != nil {
		installScript := filepath.Join(filepath.Dir(filepath.Dir(bin)), "install.sh")
		return "Lelu isn't set up yet — run " + installScript + " once, then this warning goes away. This action was not checked."
	}
	return "Lelu daemon unreachable (" + dialErr.Error() + ") — this action was not checked"
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
	default:
		// No rule fired (or shadow mode reported what it would have done).
		// Leave PermissionDecision empty so Claude Code's own prompt,
		// permission rules and auto-mode classifier still apply.
		if resp.Shadow && resp.Reason != "" {
			out.AdditionalContext = resp.Reason
		}
	}

	return hookOutput{HookSpecificOutput: out}
}

// cannotCheck reports that Lelu could not check the action. Failing closed
// asks the user; otherwise no permission decision is taken, so Claude Code's
// own permission flow decides. The user is told either way.
func cannotCheck(msg string, closed bool) hookOutput {
	out := warningOutput(msg)
	if closed {
		out.HookSpecificOutput.PermissionDecision = "ask"
		out.HookSpecificOutput.PermissionDecisionReason = "Lelu could not check this action, and it is enforcing, so it needs your approval: " + msg
	}
	return out
}

func warningOutput(msg string) hookOutput {
	return hookOutput{
		SystemMessage: "⚠️ Lelu: " + msg,
		HookSpecificOutput: hookSpecificOutput{
			HookEventName:     "PreToolUse",
			AdditionalContext: "⚠️ " + msg,
		},
	}
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

// daemonBinaryPath resolves the daemon binary. LELU_DAEMON_BIN comes first:
// hooks/lelu-hook.sh sets it to the release binary it downloaded into the
// data directory, which is outside the plugin folder. Otherwise the daemon
// is looked up relative to CLAUDE_PLUGIN_ROOT (a plugin built in place by
// install.sh), and finally relative to this hook binary's own location,
// mirroring install.sh's hooks/ + bin/ sibling layout.
func daemonBinaryPath() string {
	if bin := os.Getenv("LELU_DAEMON_BIN"); bin != "" {
		return bin
	}
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
	if d := os.Getenv("LELU_HOME"); d != "" {
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
