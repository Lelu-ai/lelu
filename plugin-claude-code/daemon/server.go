package daemon

import (
	"fmt"
	"strings"
	"time"
)

// Request is the decoded PreToolUse payload the hook adapter forwards.
type Request struct {
	SessionID      string            `json:"session_id"`
	Tool           string            `json:"tool"`
	Command        string            `json:"command,omitempty"`   // Bash
	FilePath       string            `json:"file_path,omitempty"` // Edit/Write
	NewString      string            `json:"new_string,omitempty"` // Edit
	OldString      string            `json:"old_string,omitempty"` // Edit
	Content        string            `json:"content,omitempty"`    // Write
	Cwd            string            `json:"cwd"`
	TranscriptPath string            `json:"transcript_path,omitempty"`
	Env            map[string]string `json:"env,omitempty"`
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
	Loop   *LoopTracker
	Budget *BudgetTracker
	Home   string

	// ShadowMode returns whether decisions should be logged but not enforced.
	// A func rather than a bool field so callers can back it with a file
	// that /lelu enforce flips without restarting the daemon.
	ShadowMode func() bool
}

func (e *Engine) Decide(req Request) Response {
	shadow := e.ShadowMode()
	real := e.decideReal(req)

	// Loop detection and session-budget checks both run on top of an
	// otherwise-clean allow, not instead of Tier 1/hookify — if either
	// already denied or asked, that stands on its own merits.
	if real.Outcome == OutcomeAllow && e.Loop != nil {
		if isLoop, count := e.Loop.Check(e.Policy.LoopDetection, req.SessionID, LoopKey(req), time.Now()); isLoop {
			real = Response{
				Outcome: OutcomeAsk,
				Rule:    "loop-detection",
				Reason: fmt.Sprintf("this exact action has repeated %d times in this session within the last %ds — possible runaway loop, routing to human review",
					count, e.Policy.LoopDetection.WindowSeconds),
			}
		}
	}
	if real.Outcome == OutcomeAllow && e.Budget != nil {
		if exceeded, elapsed := e.Budget.EvaluateSessionBudget(e.Policy.SessionBudget, req.SessionID, req.TranscriptPath, time.Now()); exceeded {
			real = Response{
				Outcome: OutcomeAsk,
				Rule:    "session-budget",
				Reason: fmt.Sprintf("this session has been running for %s, past the %s budget — confirm this is still an intended long-running task",
					elapsed.Round(time.Minute), (time.Duration(e.Policy.SessionBudget.MaxDurationSecs) * time.Second)),
			}
		}
	}

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

// decideReal combines Tier 1 (this plugin's own deterministic rules) with
// any imported hookify rules, taking whichever is more restrictive —
// consistent with the rest of Lelu, where the strictest applicable layer
// always wins rather than the first or last one evaluated.
func (e *Engine) decideReal(req Request) Response {
	tier1 := e.decideTier1(req)
	hookify := e.decideHookify(req)

	if severityRank(hookify.Outcome) > severityRank(tier1.Outcome) {
		return hookify
	}
	return tier1
}

func (e *Engine) decideTier1(req Request) Response {
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

// decideHookify evaluates any imported hookify rules found under the
// request's own working directory — see hookify.go for why these are
// loaded fresh per request rather than cached.
func (e *Engine) decideHookify(req Request) Response {
	rules := LoadHookifyRules(req.Cwd)
	if len(rules) == 0 {
		return Response{Outcome: OutcomeAllow}
	}
	d, matched := EvaluateHookify(rules, req)
	if !matched {
		return Response{Outcome: OutcomeAllow}
	}
	return Response{Outcome: d.Outcome, Reason: d.Reason, Rule: d.Rule}
}

func severityRank(o Outcome) int {
	switch o {
	case OutcomeDeny:
		return 2
	case OutcomeAsk:
		return 1
	default:
		return 0
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
