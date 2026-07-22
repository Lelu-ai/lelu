package daemon

import (
	"strings"
)

// Request is the decoded PreToolUse payload the hook adapter forwards.
type Request struct {
	SessionID string            `json:"session_id"`
	Tool      string            `json:"tool"`
	Command   string            `json:"command,omitempty"`   // Bash
	FilePath  string            `json:"file_path,omitempty"` // Edit/Write
	Cwd       string            `json:"cwd"`
	Env       map[string]string `json:"env,omitempty"`
}

// Response is what goes back to the hook adapter, which translates it into
// Claude Code's permissionDecision JSON.
type Response struct {
	Outcome Outcome `json:"outcome"`
	Reason  string  `json:"reason,omitempty"`
	Rule    string  `json:"rule,omitempty"`
	Shadow  bool    `json:"shadow"`
}

// Engine ties policy evaluation, the audit ledger, and shadow-mode state
// together into the single decision path every request goes through.
type Engine struct {
	Policy *PolicySet
	Ledger *Ledger
	Home   string

	// ShadowMode returns whether decisions should be logged but not enforced.
	// A func rather than a bool field so callers can back it with a file
	// that /lelu enforce flips without restarting the daemon.
	ShadowMode func() bool
}

func (e *Engine) Decide(req Request) Response {
	shadow := e.ShadowMode()
	real := e.decideReal(req)

	_ = e.Ledger.Record(LedgerEntry{
		SessionID: req.SessionID,
		Tool:      req.Tool,
		Command:   req.Command,
		FilePath:  req.FilePath,
		Cwd:       req.Cwd,
		Outcome:   real.Outcome,
		Rule:      real.Rule,
		Reason:    real.Reason,
		Shadow:    shadow,
	})

	if shadow && real.Outcome != OutcomeAllow {
		return Response{Outcome: OutcomeAllow, Shadow: true, Rule: real.Rule, Reason: "[shadow mode] would have been " + string(real.Outcome) + ": " + real.Reason}
	}
	real.Shadow = shadow
	return real
}

func (e *Engine) decideReal(req Request) Response {
	switch req.Tool {
	case "Bash":
		a := AnalyzeCommand(req.Command, req.Cwd, req.Env)
		d := e.Policy.Evaluate(a, e.effectiveHome(req))
		return Response{Outcome: d.Outcome, Reason: d.Reason, Rule: d.Rule}

	case "Edit", "Write":
		if e.Policy.pathIsProtectedContains(req.FilePath) {
			return Response{Outcome: OutcomeDeny, Reason: "target path matches a protected-path rule", Rule: "protected-path"}
		}
		return Response{Outcome: OutcomeAllow}

	default:
		return Response{Outcome: OutcomeAllow}
	}
}

// effectiveHome prefers the requesting session's own $HOME (as reported by
// the hook adapter's environment) over the daemon process's own home
// directory — they're usually the same user, but the request's view of the
// world is the more correct one to evaluate against, and relying on the
// daemon's own os.UserHomeDir() here previously caused every request to be
// checked against the wrong home directory whenever the two diverged.
func (e *Engine) effectiveHome(req Request) string {
	if h, ok := req.Env["HOME"]; ok && h != "" {
		return h
	}
	return e.Home
}

// pathIsProtectedContains checks only the "contains" protected-path rules,
// since Edit/Write already carry a concrete file path with no shell
// expansion involved — an exact "$HOME" rule wouldn't be meaningful here.
func (ps *PolicySet) pathIsProtectedContains(path string) bool {
	for _, rule := range ps.ProtectedPaths {
		if rule.Contains != "" && strings.Contains(path, rule.Contains) {
			return true
		}
	}
	return false
}
