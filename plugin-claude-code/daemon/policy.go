package daemon

import (
	"encoding/json"
	"os"
	"strings"
)

type destructiveRule struct {
	Name            string   `json:"name"`
	Command         string   `json:"command"`
	Subcommand      string   `json:"subcommand,omitempty"`
	RequireFlags    []string `json:"require_flags,omitempty"`
	RequireAnyFlag  []string `json:"require_any_flag,omitempty"`
	LongFlags       []string `json:"long_flags,omitempty"`
	Severity        string   `json:"severity"` // "deny_if_protected" | "ask"
}

type protectedPathRule struct {
	Exact    string `json:"exact,omitempty"`
	Contains string `json:"contains,omitempty"`
}

// PolicySet is the loaded Tier-1 deterministic rule set, plus the Tier-2
// loop-detection config (still deterministic and local, just stateful across
// requests rather than judged from one request alone).
type PolicySet struct {
	Version             string              `json:"version"`
	DestructiveCommands []destructiveRule   `json:"destructive_commands"`
	ProtectedPaths      []protectedPathRule `json:"protected_paths"`
	LoopDetection       LoopConfig          `json:"loop_detection"`
}

// LoadPolicySet reads and parses a policy file (JSON).
func LoadPolicySet(path string) (*PolicySet, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var ps PolicySet
	if err := json.Unmarshal(data, &ps); err != nil {
		return nil, err
	}
	return &ps, nil
}

// Outcome is one of Lelu's decision outcomes for this call.
type Outcome string

const (
	OutcomeAllow Outcome = "allow"
	OutcomeDeny  Outcome = "deny"
	OutcomeAsk   Outcome = "ask"
)

// Decision is the Tier-1 verdict for one analyzed command line.
type Decision struct {
	Outcome Outcome `json:"outcome"`
	Reason  string  `json:"reason,omitempty"`
	Rule    string  `json:"rule,omitempty"`
}

// Evaluate applies the policy set to an already-expanded command Analysis.
// Unparseable commands fail closed to "ask". Unresolvable (Dynamic) content
// only escalates to "ask" when the call it's part of ALSO matches a
// destructive command class — a bare `echo $(date)` or `pgrep ... | wc -l`
// has nothing destructive for the unresolved part to hide inside, so it
// stays a silent allow. `rm -rf "$(...)"` still asks, since here the
// unresolved content could be concealing a protected-path target we can't
// verify. Never deny outright on unresolved content — a false positive there
// would be indistinguishable from a real block with no way for the model to
// self-correct.
func (ps *PolicySet) Evaluate(a Analysis, home string) Decision {
	if a.ParseErr {
		return Decision{Outcome: OutcomeAsk, Reason: "could not parse this command's shell syntax; routing to human review"}
	}

	for _, call := range a.Calls {
		if d, matched := ps.evaluateCall(call, home); matched {
			if d.Outcome != OutcomeAllow {
				return d
			}
		}
	}

	return Decision{Outcome: OutcomeAllow}
}

func (ps *PolicySet) evaluateCall(call CommandCall, home string) (Decision, bool) {
	name, args := effectiveCommand(call)
	if name == "" {
		return Decision{}, false
	}

	flags, longFlags, positional := splitArgs(args)

	for _, rule := range ps.DestructiveCommands {
		if name != rule.Command {
			continue
		}
		if rule.Subcommand != "" && !containsString(positional, rule.Subcommand) {
			continue
		}
		if !flagsSatisfy(rule, flags, longFlags) {
			continue
		}

		if call.Dynamic {
			return Decision{Outcome: OutcomeAsk, Rule: rule.Name, Reason: "matched policy rule " + rule.Name + ", but part of this command contains an unresolvable dynamic subexpression — routing to human review"}, true
		}

		switch rule.Severity {
		case "ask":
			return Decision{Outcome: OutcomeAsk, Rule: rule.Name, Reason: "matched policy rule " + rule.Name + " — routed to human review"}, true
		case "deny_if_protected":
			if ps.anyPathProtected(call.ResolvedPaths, home) {
				return Decision{Outcome: OutcomeDeny, Rule: rule.Name, Reason: "matched policy rule " + rule.Name + " against a protected path"}, true
			}
			return Decision{Outcome: OutcomeAllow}, true
		default:
			return Decision{Outcome: OutcomeAsk, Rule: rule.Name, Reason: "matched policy rule " + rule.Name}, true
		}
	}

	return Decision{}, false
}

// effectiveCommand strips a leading "sudo" so policy still applies to what's
// actually being run.
func effectiveCommand(call CommandCall) (string, []string) {
	if call.Name == "" {
		return "", nil
	}
	if call.Name == "sudo" && len(call.Args) > 1 {
		return baseName(call.Args[1]), call.Args[2:]
	}
	if len(call.Args) == 0 {
		return call.Name, nil
	}
	return call.Name, call.Args[1:]
}

func baseName(s string) string {
	if i := strings.LastIndex(s, "/"); i >= 0 {
		return s[i+1:]
	}
	return s
}

// splitArgs separates short flags (exploding combined ones like "-rf" into
// {'r','f'}), long "--flags", and positional arguments.
func splitArgs(args []string) (shortFlags map[byte]bool, longFlags map[string]bool, positional []string) {
	shortFlags = map[byte]bool{}
	longFlags = map[string]bool{}
	for _, a := range args {
		switch {
		case strings.HasPrefix(a, "--"):
			longFlags[strings.TrimPrefix(a, "--")] = true
		case strings.HasPrefix(a, "-") && len(a) > 1:
			for i := 1; i < len(a); i++ {
				shortFlags[a[i]] = true
			}
		default:
			positional = append(positional, a)
		}
	}
	return
}

func flagsSatisfy(rule destructiveRule, shortFlags map[byte]bool, longFlags map[string]bool) bool {
	longSatisfied := len(rule.LongFlags) > 0
	for _, lf := range rule.LongFlags {
		if !longFlags[lf] {
			longSatisfied = false
			break
		}
	}
	if longSatisfied {
		return true
	}

	if len(rule.RequireFlags) > 0 {
		all := true
		for _, f := range rule.RequireFlags {
			if len(f) != 1 || !shortFlags[f[0]] {
				all = false
				break
			}
		}
		if all {
			return true
		}
	}

	for _, f := range rule.RequireAnyFlag {
		if len(f) == 1 && shortFlags[f[0]] {
			return true
		}
	}

	return false
}

func containsString(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

func (ps *PolicySet) anyPathProtected(paths []string, home string) bool {
	for _, p := range paths {
		for _, rule := range ps.ProtectedPaths {
			if rule.Exact != "" {
				want := rule.Exact
				if want == "$HOME" {
					want = home
				}
				if want != "" && p == want {
					return true
				}
			}
			if rule.Contains != "" && strings.Contains(p, rule.Contains) {
				return true
			}
		}
	}
	return false
}
