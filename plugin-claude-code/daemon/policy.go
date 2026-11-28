package daemon

import (
	"encoding/json"
	"os"
	"strings"
)

type destructiveRule struct {
	Name           string   `json:"name"`
	Command        string   `json:"command"`
	Subcommand     string   `json:"subcommand,omitempty"`
	RequireFlags   []string `json:"require_flags,omitempty"`
	RequireAnyFlag []string `json:"require_any_flag,omitempty"`
	LongFlags      []string `json:"long_flags,omitempty"`
	Severity       string   `json:"severity"` // "deny_if_protected" | "ask"
}

// remoteScriptRule flags a download piped straight into an interpreter
// (`curl … | sh`): the code that runs is whatever the server sends.
type remoteScriptRule struct {
	Enabled      bool     `json:"enabled"`
	Downloaders  []string `json:"downloaders"`
	Interpreters []string `json:"interpreters"`
}

// PolicySet is the loaded Tier-1 deterministic rule set, plus the Tier-2
// loop-detection config (still deterministic and local, just stateful across
// requests rather than judged from one request alone).
type PolicySet struct {
	Version             string              `json:"version"`
	DestructiveCommands []destructiveRule   `json:"destructive_commands"`
	ProtectedPaths      []protectedPathRule `json:"protected_paths"`
	// SensitivePaths are credential, key and env-file locations. Any Bash
	// command naming one as an argument or redirect target — reading,
	// copying, appending — is routed to human review.
	SensitivePaths []protectedPathRule `json:"sensitive_paths,omitempty"`
	// GuardedPaths are Lelu's own files and Claude Code's plugin and
	// settings files. Changing one can switch Lelu off or loosen it, so a
	// change through a file tool or a shell command is routed to human
	// review. Reading them is not.
	GuardedPaths     []protectedPathRule `json:"guarded_paths,omitempty"`
	RemoteScriptPipe remoteScriptRule    `json:"remote_script_pipe"`
	// Tools covers every tool other than Bash, the file-editing tools and
	// MCP tools: which need no check of their own, and where WebFetch may go.
	Tools         ToolPolicy          `json:"tools"`
	LoopDetection LoopConfig          `json:"loop_detection"`
	SessionBudget SessionBudgetConfig `json:"session_budget"`
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

// GuardPath adds dir to the guarded paths. The daemon calls it with its data
// directory, so a LELU_DATA_DIR outside ~/.lelu is guarded too.
func (ps *PolicySet) GuardPath(dir string) {
	if dir == "" {
		return
	}
	ps.GuardedPaths = append(ps.GuardedPaths, protectedPathRule{Under: dir})
}

// PathIsGuarded reports whether path matches a guarded-path rule.
func (ps *PolicySet) PathIsGuarded(path, home string) bool {
	for _, rule := range ps.GuardedPaths {
		if rule.matches(path, home) {
			return true
		}
	}
	return false
}

// readOnlyCommands only read the paths they are given. Naming a guarded
// path in one of them is not a change, so /lelu:status and a plain
// `cat` of the ledger stay quiet. Anything not listed (rm, mv, cp, sed,
// tee, chmod, find, an editor, a script) counts as a possible change.
var readOnlyCommands = map[string]bool{
	"cat": true, "head": true, "tail": true, "less": true, "more": true,
	"grep": true, "egrep": true, "fgrep": true, "rg": true, "ls": true,
	"wc": true, "jq": true, "stat": true, "file": true, "diff": true,
	"cmp": true, "sha256sum": true, "shasum": true, "md5sum": true,
	"realpath": true, "readlink": true, "du": true, "tree": true,
}

// guardedPathIn reports a guarded path this call may change: any redirect
// to one, or one named as an argument of a command that is not read-only.
func (ps *PolicySet) guardedPathIn(call CommandCall, home string) (string, bool) {
	for _, p := range call.RedirectPaths {
		if ps.PathIsGuarded(p, home) {
			return p, true
		}
	}
	name, _ := effectiveCommand(call)
	if readOnlyCommands[baseName(name)] {
		return "", false
	}
	for _, p := range call.ResolvedPaths {
		if ps.PathIsGuarded(p, home) {
			return p, true
		}
	}
	return "", false
}

// ToolPolicy says how tools without a rule of their own are handled. Any
// tool that is neither handled by a specific rule nor listed in Allow is
// routed to human review, so a tool Claude Code adds later is not waved
// through unchecked.
type ToolPolicy struct {
	// Allow lists tools that need no check: tools that only read or plan,
	// and Task/Agent, whose sub-agents' own tool calls come through this hook
	// too.
	Allow []string `json:"allow"`
	// WebFetchAllowedHosts lists hosts WebFetch may fetch from without
	// review. A host also allows its subdomains.
	WebFetchAllowedHosts []string `json:"web_fetch_allowed_hosts"`
}

// LocalPolicyFile holds the user's own rules (the ones /lelu adds). It lives
// in the data directory, not the plugin folder: Claude Code replaces the
// plugin folder on every update, which would erase rules kept there.
const LocalPolicyFile = "policy.local.json"

// Merge appends other's lists to ps: rules, plus tools and web-fetch hosts
// the user trusts. Loop detection, the session budget and the remote-script
// check keep the values from ps, and no default rule can be removed, so a
// local file cannot switch the defaults off.
func (ps *PolicySet) Merge(other *PolicySet) {
	ps.DestructiveCommands = append(ps.DestructiveCommands, other.DestructiveCommands...)
	ps.ProtectedPaths = append(ps.ProtectedPaths, other.ProtectedPaths...)
	ps.SensitivePaths = append(ps.SensitivePaths, other.SensitivePaths...)
	ps.GuardedPaths = append(ps.GuardedPaths, other.GuardedPaths...)
	ps.Tools.Allow = append(ps.Tools.Allow, other.Tools.Allow...)
	ps.Tools.WebFetchAllowedHosts = append(ps.Tools.WebFetchAllowedHosts, other.Tools.WebFetchAllowedHosts...)
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
	// SelfProtect is set when the command may change Lelu's own files,
	// even if a stricter rule decided the outcome. Shadow mode still asks
	// for these.
	SelfProtect bool `json:"-"`
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

	// The strictest outcome across every call and check wins, so an "ask"
	// earlier in a line can't mask a "deny" later in it.
	best := Decision{Outcome: OutcomeAllow}
	consider := func(d Decision) {
		if severityRank(d.Outcome) > severityRank(best.Outcome) {
			best = d
		}
	}

	selfProtect := false
	for _, call := range a.Calls {
		if d, matched := ps.evaluateCall(call, home); matched {
			consider(d)
		}
		if p, ok := ps.guardedPathIn(call, home); ok {
			selfProtect = true
			consider(Decision{Outcome: OutcomeAsk, Rule: "self-protection",
				Reason: "this command may change Lelu's own files or Claude Code's plugin or settings files (" + p + "), which could switch Lelu off — routed to human review"})
		}
		if p, ok := ps.sensitivePathIn(call, home); ok {
			consider(Decision{Outcome: OutcomeAsk, Rule: "sensitive-path",
				Reason: "this command touches a credential, key or env file (" + p + ") — routed to human review"})
		}
	}
	if ps.pipesRemoteScript(a) {
		consider(Decision{Outcome: OutcomeAsk, Rule: "remote-script-pipe",
			Reason: "this command pipes a download straight into an interpreter, so the code that runs is whatever the server sends — routed to human review"})
	}

	best.SelfProtect = selfProtect
	return best
}

func (ps *PolicySet) sensitivePathIn(call CommandCall, home string) (string, bool) {
	for _, list := range [][]string{call.ResolvedPaths, call.RedirectPaths} {
		for _, p := range list {
			for _, rule := range ps.SensitivePaths {
				if rule.matches(p, home) {
					return p, true
				}
			}
		}
	}
	return "", false
}

// pipesRemoteScript reports a downloader and an interpreter reading its
// program from stdin (no script argument, or -s, or -c with unresolvable
// content) in the same command line.
func (ps *PolicySet) pipesRemoteScript(a Analysis) bool {
	r := ps.RemoteScriptPipe
	if !r.Enabled {
		return false
	}
	downloader, stdinInterpreter := false, false
	for _, call := range a.Calls {
		name, args := effectiveCommand(call)
		if containsString(r.Downloaders, name) {
			downloader = true
		}
		if containsString(r.Interpreters, name) {
			short, _, positional := splitArgs(args)
			if len(positional) == 0 || short['s'] || (short['c'] && call.Dynamic) {
				stdinInterpreter = true
			}
		}
	}
	return downloader && stdinInterpreter
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
			// --force-with-lease=main is the flag "force-with-lease".
			name := strings.TrimPrefix(a, "--")
			if i := strings.IndexByte(name, '='); i >= 0 {
				name = name[:i]
			}
			longFlags[name] = true
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
			if rule.matches(p, home) {
				return true
			}
		}
	}
	return false
}
