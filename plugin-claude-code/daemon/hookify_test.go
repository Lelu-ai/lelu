package daemon

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The fixtures below are taken verbatim from hookify's own documentation
// (plugins/hookify/commands/hookify.md in anthropics/claude-code) and from
// the self-test embedded in its rule_engine.py, fetched directly from that
// repository — not invented — specifically so these tests prove
// compatibility with the real thing, not with my own guess at its format.

const hookifySimpleRuleFixture = `---
name: warn-dangerous-rm
enabled: true
event: bash
pattern: rm\s+-rf
---

⚠️ **Dangerous rm command detected**

You requested to be warned before using rm -rf.
Please verify the path is correct.
`

const hookifyConditionsRuleFixture = `---
name: sensitive-files
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.env$
  - field: new_text
    operator: contains
    pattern: API_KEY
---

Don't add secrets to .env files.
`

const hookifyBlockRuleFixture = `---
name: block-dangerous-rm
enabled: true
event: bash
pattern: rm\s+-rf
action: block
---

Blocked: rm -rf is not allowed.
`

const hookifyDisabledRuleFixture = `---
name: disabled-rule
enabled: false
event: bash
pattern: anything
---

Should never fire.
`

func TestExtractHookifyFrontmatter_SimplePattern(t *testing.T) {
	fm, message := extractHookifyFrontmatter(hookifySimpleRuleFixture)
	if fm["name"] != "warn-dangerous-rm" {
		t.Errorf("name = %v", fm["name"])
	}
	if fm["enabled"] != true {
		t.Errorf("enabled = %v, want true", fm["enabled"])
	}
	if fm["event"] != "bash" {
		t.Errorf("event = %v", fm["event"])
	}
	if fm["pattern"] != `rm\s+-rf` {
		t.Errorf(`pattern = %v, want rm\s+-rf`, fm["pattern"])
	}
	if message == "" || !strings.Contains(message, "Dangerous rm command detected") {
		t.Errorf("message body not extracted correctly: %q", message)
	}
}

func TestExtractHookifyFrontmatter_ConditionsList(t *testing.T) {
	fm, _ := extractHookifyFrontmatter(hookifyConditionsRuleFixture)
	conds, ok := fm["conditions"].([]any)
	if !ok || len(conds) != 2 {
		t.Fatalf("conditions = %#v, want a 2-item list", fm["conditions"])
	}
	c0, ok := conds[0].(map[string]string)
	if !ok || c0["field"] != "file_path" || c0["operator"] != "regex_match" || c0["pattern"] != `\.env$` {
		t.Errorf("condition[0] = %#v", conds[0])
	}
	c1, ok := conds[1].(map[string]string)
	if !ok || c1["field"] != "new_text" || c1["operator"] != "contains" || c1["pattern"] != "API_KEY" {
		t.Errorf("condition[1] = %#v", conds[1])
	}
}

func TestHookifyRuleFromFrontmatter_SimplePatternInfersFieldFromEvent(t *testing.T) {
	fm, message := extractHookifyFrontmatter(hookifySimpleRuleFixture)
	rule := hookifyRuleFromFrontmatter(fm, message)

	if rule.Name != "warn-dangerous-rm" || !rule.Enabled || rule.Event != "bash" || rule.Action != "warn" {
		t.Fatalf("rule = %+v", rule)
	}
	if len(rule.Conditions) != 1 || rule.Conditions[0].Field != "command" || rule.Conditions[0].Pattern != `rm\s+-rf` {
		t.Fatalf("conditions = %+v, want field=command inferred from event=bash", rule.Conditions)
	}
}

// TestHookify_MatchesRealHookifyExample reproduces rule_engine.py's own
// embedded self-test: the same rule, a matching "rm -rf /tmp/test" command,
// and a non-matching "ls -la" command.
func TestHookify_MatchesRealHookifyExample(t *testing.T) {
	fm, message := extractHookifyFrontmatter(hookifySimpleRuleFixture)
	rule := hookifyRuleFromFrontmatter(fm, message)
	rules := []HookifyRule{rule}

	d, matched := EvaluateHookify(rules, Request{Tool: "Bash", Command: "rm -rf /tmp/test"})
	if !matched || d.Outcome != OutcomeAsk {
		t.Errorf("matching command: matched=%v outcome=%q, want matched=true outcome=ask (warn upgraded to ask)", matched, d.Outcome)
	}

	_, matched2 := EvaluateHookify(rules, Request{Tool: "Bash", Command: "ls -la"})
	if matched2 {
		t.Errorf("non-matching command should not match")
	}
}

func TestHookify_BlockActionMapsToDeny(t *testing.T) {
	fm, message := extractHookifyFrontmatter(hookifyBlockRuleFixture)
	rule := hookifyRuleFromFrontmatter(fm, message)

	d, matched := EvaluateHookify([]HookifyRule{rule}, Request{Tool: "Bash", Command: "rm -rf /"})
	if !matched || d.Outcome != OutcomeDeny {
		t.Errorf("matched=%v outcome=%q, want matched=true outcome=deny", matched, d.Outcome)
	}
}

func TestHookify_ConditionsRequireAllToMatch(t *testing.T) {
	fm, message := extractHookifyFrontmatter(hookifyConditionsRuleFixture)
	rule := hookifyRuleFromFrontmatter(fm, message)
	rules := []HookifyRule{rule}

	// Both conditions satisfied: .env path AND API_KEY in the new content.
	d, matched := EvaluateHookify(rules, Request{
		Tool: "Edit", FilePath: "/project/.env", NewString: "API_KEY=sk-123",
	})
	if !matched || d.Outcome != OutcomeAsk {
		t.Errorf(".env + API_KEY: matched=%v outcome=%q, want matched=true outcome=ask", matched, d.Outcome)
	}

	// Only the path matches, not the content.
	_, matched2 := EvaluateHookify(rules, Request{
		Tool: "Edit", FilePath: "/project/.env", NewString: "PORT=3000",
	})
	if matched2 {
		t.Errorf(".env without API_KEY should not match — conditions are AND, not OR")
	}

	// Only the content matches, not the path.
	_, matched3 := EvaluateHookify(rules, Request{
		Tool: "Edit", FilePath: "/project/config.go", NewString: "API_KEY=sk-123",
	})
	if matched3 {
		t.Errorf("API_KEY in a non-.env file should not match")
	}
}

func TestHookify_DisabledRuleNeverLoaded(t *testing.T) {
	dir := t.TempDir()
	writeHookifyFixture(t, dir, "hookify.disabled.local.md", hookifyDisabledRuleFixture)

	rules := LoadHookifyRules(dir)
	if len(rules) != 0 {
		t.Errorf("disabled rule should not be loaded at all, got %d rules", len(rules))
	}
}

func TestHookify_EventMismatchDoesNotFire(t *testing.T) {
	fm, message := extractHookifyFrontmatter(hookifySimpleRuleFixture) // event: bash
	rule := hookifyRuleFromFrontmatter(fm, message)

	_, matched := EvaluateHookify([]HookifyRule{rule}, Request{
		Tool: "Edit", FilePath: "/tmp/x", NewString: "rm -rf /tmp/test",
	})
	if matched {
		t.Errorf("a bash-event rule must not fire on an Edit request even if the text happens to match")
	}
}

func TestHookify_ToolMatcherOverride(t *testing.T) {
	rule := HookifyRule{
		Name: "edit-or-write-only", Enabled: true, Event: "all", ToolMatcher: "Edit|Write",
		Conditions: []HookifyCondition{{Field: "file_path", Operator: "contains", Pattern: "secret"}},
	}

	_, matchedEdit := EvaluateHookify([]HookifyRule{rule}, Request{Tool: "Edit", FilePath: "secret.txt"})
	if !matchedEdit {
		t.Errorf("Edit should be allowed by tool_matcher Edit|Write")
	}

	_, matchedMultiEdit := EvaluateHookify([]HookifyRule{rule}, Request{Tool: "MultiEdit", FilePath: "secret.txt"})
	if matchedMultiEdit {
		t.Errorf("MultiEdit should be excluded by tool_matcher Edit|Write")
	}
}

func TestHookify_NoConditionsNeverMatches(t *testing.T) {
	rule := HookifyRule{Name: "empty", Enabled: true, Event: "bash", Action: "block"}
	_, matched := EvaluateHookify([]HookifyRule{rule}, Request{Tool: "Bash", Command: "anything at all"})
	if matched {
		t.Errorf("a rule with zero conditions must never match, matching hookify's own _rule_matches")
	}
}

func TestHookify_MultipleMatchingWarnRulesCombineMessages(t *testing.T) {
	r1 := HookifyRule{Name: "r1", Enabled: true, Event: "bash", Action: "warn", Message: "first",
		Conditions: []HookifyCondition{{Field: "command", Operator: "contains", Pattern: "danger"}}}
	r2 := HookifyRule{Name: "r2", Enabled: true, Event: "bash", Action: "warn", Message: "second",
		Conditions: []HookifyCondition{{Field: "command", Operator: "contains", Pattern: "danger"}}}

	d, matched := EvaluateHookify([]HookifyRule{r1, r2}, Request{Tool: "Bash", Command: "danger zone"})
	if !matched || d.Outcome != OutcomeAsk {
		t.Fatalf("matched=%v outcome=%q", matched, d.Outcome)
	}
	if !strings.Contains(d.Reason, "first") || !strings.Contains(d.Reason, "second") {
		t.Errorf("reason should combine both messages, got: %q", d.Reason)
	}
}

func TestHookify_BlockWinsOverWarnWhenBothMatch(t *testing.T) {
	warnRule := HookifyRule{Name: "warn-rule", Enabled: true, Event: "bash", Action: "warn",
		Conditions: []HookifyCondition{{Field: "command", Operator: "contains", Pattern: "rm"}}}
	blockRule := HookifyRule{Name: "block-rule", Enabled: true, Event: "bash", Action: "block",
		Conditions: []HookifyCondition{{Field: "command", Operator: "contains", Pattern: "rm"}}}

	d, matched := EvaluateHookify([]HookifyRule{warnRule, blockRule}, Request{Tool: "Bash", Command: "rm foo"})
	if !matched || d.Outcome != OutcomeDeny {
		t.Errorf("matched=%v outcome=%q, want deny (block wins over warn)", matched, d.Outcome)
	}
}

// TestLoadHookifyRules_RealFileGlob proves the actual file-loading path
// (glob + read + parse), not just the pure string parser, against a real
// .claude/hookify.*.local.md file on disk under a temp project directory.
func TestLoadHookifyRules_RealFileGlob(t *testing.T) {
	dir := t.TempDir()
	writeHookifyFixture(t, dir, "hookify.dangerous-rm.local.md", hookifySimpleRuleFixture)
	writeHookifyFixture(t, dir, "hookify.sensitive-files.local.md", hookifyConditionsRuleFixture)

	rules := LoadHookifyRules(dir)
	if len(rules) != 2 {
		t.Fatalf("expected 2 loaded rules, got %d: %+v", len(rules), rules)
	}

	d, matched := EvaluateHookify(rules, Request{Tool: "Bash", Command: "rm -rf /tmp/x", Cwd: dir})
	if !matched || d.Outcome != OutcomeAsk {
		t.Errorf("loaded rule did not evaluate correctly: matched=%v outcome=%q", matched, d.Outcome)
	}
}

func writeHookifyFixture(t *testing.T, dir, name, content string) {
	t.Helper()
	claudeDir := filepath.Join(dir, ".claude")
	if err := os.MkdirAll(claudeDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(claudeDir, name), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}
