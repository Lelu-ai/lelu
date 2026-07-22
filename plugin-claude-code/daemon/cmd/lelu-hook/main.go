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
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/lelu-ai/lelu/plugin-claude-code/daemon"
)

const dialTimeout = 300 * time.Millisecond
const roundTripTimeout = 2 * time.Second

// hookInput mirrors Claude Code's PreToolUse stdin schema.
type hookInput struct {
	SessionID string `json:"session_id"`
	Cwd       string `json:"cwd"`
	ToolName  string `json:"tool_name"`
	ToolInput struct {
		Command  string `json:"command"`
		FilePath string `json:"file_path"`
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

func askDaemon(req daemon.Request) (daemon.Response, error) {
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

func socketPath() string {
	if d := os.Getenv("LELU_DATA_DIR"); d != "" {
		return filepath.Join(d, "daemon.sock")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".lelu-claude-plugin", "daemon.sock")
	}
	return filepath.Join(home, ".lelu", "claude-plugin", "daemon.sock")
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
