package daemon

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// This file imports rules from hookify — Anthropic's own official regex-rule
// plugin, bundled with Claude Code (github.com/anthropics/claude-code,
// plugins/hookify/). The parser and matching semantics below are a
// deliberate line-for-line port of hookify's own
// plugins/hookify/core/config_loader.py and rule_engine.py, fetched and read
// directly from that repository — not guessed — so that a hookify user's
// existing .claude/hookify.*.local.md files behave identically once
// imported, with zero edits required.
//
// One deliberate behavior change: hookify's own "warn" action silently shows
// a message and allows the operation, with no way to actually intervene.
// Imported "warn" rules map to Lelu's OutcomeAsk instead — the middle
// outcome hookify itself doesn't have — so a migrating hookify user gets
// strictly more than they had: a real pause for review instead of a notice
// after the fact, plus everything logged to the audit ledger. "block" maps
// to OutcomeDeny, the direct equivalent.

// HookifyCondition is one field/operator/pattern check, matching
// hookify's core.config_loader.Condition.
type HookifyCondition struct {
	Field    string
	Operator string
	Pattern  string
}

// HookifyRule mirrors hookify's core.config_loader.Rule.
type HookifyRule struct {
	Name        string
	Enabled     bool
	Event       string // "bash" | "file" | "stop" | "prompt" | "all"
	Conditions  []HookifyCondition
	Action      string // "warn" | "block"
	ToolMatcher string
	Message     string
	SourceFile  string
}

// LoadHookifyRules globs and parses .claude/hookify.*.local.md under cwd —
// the exact path hookify itself reads from (relative to the project's
// working directory, never the plugin's own directory). Rules are reloaded
// fresh on every call rather than cached, matching hookify's own
// load_rules(), which does the same — this is what lets hookify (and now
// Lelu) promise "rules are active immediately, no restart needed."
func LoadHookifyRules(cwd string) []HookifyRule {
	if cwd == "" {
		return nil
	}
	matches, err := filepath.Glob(filepath.Join(cwd, ".claude", "hookify.*.local.md"))
	if err != nil {
		return nil
	}

	var rules []HookifyRule
	for _, path := range matches {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		fm, message := extractHookifyFrontmatter(string(data))
		if fm == nil {
			continue
		}
		rule := hookifyRuleFromFrontmatter(fm, message)
		rule.SourceFile = path
		if rule.Enabled {
			rules = append(rules, rule)
		}
	}
	return rules
}

// EvaluateHookify checks imported hookify rules against a request. Matching
// blocking rules always win over warning rules, mirroring rule_engine.py's
// own priority; if several rules of the same severity match, their messages
// are combined into one decision.
func EvaluateHookify(rules []HookifyRule, req Request) (Decision, bool) {
	event := hookifyEventForTool(req.Tool)
	if event == "" || len(rules) == 0 {
		return Decision{}, false
	}

	var blocked, warned []HookifyRule
	for _, rule := range rules {
		if rule.Event != "all" && rule.Event != event {
			continue
		}
		if rule.ToolMatcher != "" && !hookifyToolMatches(rule.ToolMatcher, req.Tool) {
			continue
		}
		// A rule with no conditions never matches — hookify requires at
		// least one, treating a condition-less rule as invalid rather than
		// universally true.
		if len(rule.Conditions) == 0 {
			continue
		}
		if hookifyAllConditionsMatch(rule.Conditions, req) {
			if rule.Action == "block" {
				blocked = append(blocked, rule)
			} else {
				warned = append(warned, rule)
			}
		}
	}

	if len(blocked) > 0 {
		return hookifyCombinedDecision(OutcomeDeny, blocked), true
	}
	if len(warned) > 0 {
		return hookifyCombinedDecision(OutcomeAsk, warned), true
	}
	return Decision{}, false
}

func hookifyEventForTool(tool string) string {
	switch tool {
	case "Bash":
		return "bash"
	case "Edit", "Write", "MultiEdit":
		return "file"
	default:
		return ""
	}
}

func hookifyToolMatches(matcher, tool string) bool {
	if matcher == "*" {
		return true
	}
	for _, p := range strings.Split(matcher, "|") {
		if p == tool {
			return true
		}
	}
	return false
}

func hookifyCombinedDecision(outcome Outcome, rules []HookifyRule) Decision {
	names := make([]string, 0, len(rules))
	messages := make([]string, 0, len(rules))
	for _, r := range rules {
		names = append(names, r.Name)
		if r.Message != "" {
			messages = append(messages, "["+r.Name+"] "+r.Message)
		}
	}
	return Decision{
		Outcome: outcome,
		Rule:    "hookify:" + strings.Join(names, ","),
		Reason:  strings.Join(messages, " | "),
	}
}

func hookifyAllConditionsMatch(conditions []HookifyCondition, req Request) bool {
	for _, c := range conditions {
		value, ok := extractHookifyField(c.Field, req)
		if !ok {
			return false
		}
		if !matchHookifyOperator(c.Operator, c.Pattern, value) {
			return false
		}
	}
	return true
}

// extractHookifyField is a direct port of rule_engine.py's _extract_field,
// restricted to PreToolUse fields (Bash/Edit/Write) since this plugin
// doesn't implement Stop or UserPromptSubmit hooks. MultiEdit and arbitrary
// custom tool_input fields on other (e.g. MCP) tools are intentionally not
// supported — a real but honest scope boundary, not an oversight.
func extractHookifyField(field string, req Request) (string, bool) {
	if field == "command" {
		if req.Tool == "Bash" {
			return req.Command, true
		}
		return "", false
	}
	if req.Tool == "Edit" || req.Tool == "Write" {
		switch field {
		case "content":
			if req.Content != "" {
				return req.Content, true
			}
			return req.NewString, true
		case "new_text", "new_string":
			return req.NewString, true
		case "old_text", "old_string":
			return req.OldString, true
		case "file_path":
			return req.FilePath, true
		}
	}
	return "", false
}

func matchHookifyOperator(operator, pattern, value string) bool {
	switch operator {
	case "regex_match":
		re, err := regexp.Compile("(?i)" + pattern)
		if err != nil {
			return false
		}
		return re.MatchString(value)
	case "contains":
		return strings.Contains(value, pattern)
	case "not_contains":
		return !strings.Contains(value, pattern)
	case "equals":
		return value == pattern
	case "starts_with":
		return strings.HasPrefix(value, pattern)
	case "ends_with":
		return strings.HasSuffix(value, pattern)
	default:
		return false
	}
}

func hookifyRuleFromFrontmatter(fm map[string]any, message string) HookifyRule {
	r := HookifyRule{
		Name:    hfString(fm, "name", "unnamed"),
		Enabled: hfBool(fm, "enabled", true),
		Event:   hfString(fm, "event", "all"),
		Action:  hfString(fm, "action", "warn"),
		Message: strings.TrimSpace(message),
	}
	r.ToolMatcher = hfString(fm, "tool_matcher", "")

	if raw, ok := fm["conditions"].([]any); ok {
		for _, item := range raw {
			if dict, ok := item.(map[string]string); ok {
				op := dict["operator"]
				if op == "" {
					op = "regex_match"
				}
				r.Conditions = append(r.Conditions, HookifyCondition{
					Field:    dict["field"],
					Operator: op,
					Pattern:  dict["pattern"],
				})
			}
		}
	}

	// Legacy simple `pattern` field: infer the target field from `event`,
	// exactly as config_loader.py's Rule.from_dict does.
	if len(r.Conditions) == 0 {
		if pattern := hfString(fm, "pattern", ""); pattern != "" {
			field := "content"
			switch r.Event {
			case "bash":
				field = "command"
			case "file":
				field = "new_text"
			}
			r.Conditions = []HookifyCondition{{Field: field, Operator: "regex_match", Pattern: pattern}}
		}
	}

	return r
}

func hfString(fm map[string]any, key, def string) string {
	if v, ok := fm[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return def
}

func hfBool(fm map[string]any, key string, def bool) bool {
	if v, ok := fm[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return def
}

// extractHookifyFrontmatter is a deliberate, faithful port of hookify's own
// hand-rolled parser (config_loader.py's extract_frontmatter) rather than a
// generic YAML library — it needs to parse exactly the subset of YAML
// hookify itself generates and reads, including its own quirks (like
// inline "- field: x, operator: y" dicts), not a stricter or looser
// superset that could silently diverge on some existing user's rule file.
func extractHookifyFrontmatter(content string) (map[string]any, string) {
	if !strings.HasPrefix(content, "---") {
		return nil, content
	}
	parts := strings.SplitN(content, "---", 3)
	if len(parts) < 3 {
		return nil, content
	}
	message := strings.TrimSpace(parts[2])

	frontmatter := map[string]any{}
	var currentKey string
	var currentList []any
	currentDict := map[string]string{}
	inList := false
	inDictItem := false

	flush := func() {
		if inList && currentKey != "" {
			if inDictItem && len(currentDict) > 0 {
				currentList = append(currentList, currentDict)
			}
			frontmatter[currentKey] = currentList
		}
		inList = false
		inDictItem = false
		currentList = nil
		currentDict = map[string]string{}
	}

	for _, line := range strings.Split(parts[1], "\n") {
		stripped := strings.TrimSpace(line)
		if stripped == "" || strings.HasPrefix(stripped, "#") {
			continue
		}
		indent := len(line) - len(strings.TrimLeft(line, " \t"))

		switch {
		case indent == 0 && strings.Contains(line, ":") && !strings.HasPrefix(stripped, "-"):
			flush()
			key, value, _ := strings.Cut(line, ":")
			key = strings.TrimSpace(key)
			value = hfUnquote(strings.TrimSpace(value))
			if value == "" {
				currentKey = key
				inList = true
			} else if strings.EqualFold(value, "true") {
				frontmatter[key] = true
			} else if strings.EqualFold(value, "false") {
				frontmatter[key] = false
			} else {
				frontmatter[key] = value
			}

		case strings.HasPrefix(stripped, "-") && inList:
			if inDictItem && len(currentDict) > 0 {
				currentList = append(currentList, currentDict)
				currentDict = map[string]string{}
			}
			itemText := strings.TrimSpace(strings.TrimPrefix(stripped, "-"))
			switch {
			case strings.Contains(itemText, ":") && strings.Contains(itemText, ","):
				dict := map[string]string{}
				for _, part := range strings.Split(itemText, ",") {
					if k, v, ok := strings.Cut(part, ":"); ok {
						dict[strings.TrimSpace(k)] = hfUnquote(strings.TrimSpace(v))
					}
				}
				currentList = append(currentList, dict)
				inDictItem = false
			case strings.Contains(itemText, ":"):
				k, v, _ := strings.Cut(itemText, ":")
				currentDict = map[string]string{strings.TrimSpace(k): hfUnquote(strings.TrimSpace(v))}
				inDictItem = true
			default:
				currentList = append(currentList, hfUnquote(itemText))
				inDictItem = false
			}

		case indent > 2 && inDictItem && strings.Contains(line, ":"):
			k, v, _ := strings.Cut(stripped, ":")
			currentDict[strings.TrimSpace(k)] = hfUnquote(strings.TrimSpace(v))
		}
	}
	flush()

	return frontmatter, message
}

func hfUnquote(s string) string {
	s = strings.TrimPrefix(s, `"`)
	s = strings.TrimSuffix(s, `"`)
	s = strings.TrimPrefix(s, "'")
	s = strings.TrimSuffix(s, "'")
	return s
}
