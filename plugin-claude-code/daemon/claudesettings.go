package daemon

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// claudeAllowsWebFetch reports whether the user has already allowed WebFetch
// to host in Claude Code's own permission rules, as "WebFetch(domain:host)"
// or "WebFetch(domain:*.parent)", in ~/.claude/settings.json or in
// .claude/settings.json or .claude/settings.local.json in cwd or any parent
// directory. Lelu then doesn't ask again for a domain the user already
// trusts. These files are guarded paths, so the agent cannot add a domain
// without the user approving that change.
func claudeAllowsWebFetch(host, cwd, home string) bool {
	if host == "" {
		return false
	}
	for _, path := range claudeSettingsFiles(cwd, home) {
		for _, rule := range allowRules(path) {
			domain, ok := strings.CutPrefix(rule, "WebFetch(domain:")
			if !ok || !strings.HasSuffix(domain, ")") {
				continue
			}
			domain = strings.ToLower(strings.TrimSuffix(domain, ")"))
			if domain == host {
				return true
			}
			if parent, ok := strings.CutPrefix(domain, "*."); ok && strings.HasSuffix(host, "."+parent) {
				return true
			}
		}
	}
	return false
}

func claudeSettingsFiles(cwd, home string) []string {
	var files []string
	if home != "" {
		files = append(files, filepath.Join(home, ".claude", "settings.json"))
	}
	if cwd == "" || !filepath.IsAbs(cwd) {
		return files
	}
	for dir := filepath.Clean(cwd); ; dir = filepath.Dir(dir) {
		files = append(files,
			filepath.Join(dir, ".claude", "settings.json"),
			filepath.Join(dir, ".claude", "settings.local.json"))
		if parent := filepath.Dir(dir); parent == dir {
			break
		}
	}
	return files
}

// allowRules returns permissions.allow from a Claude Code settings file, or
// nothing if the file is missing or does not parse.
func allowRules(path string) []string {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var s struct {
		Permissions struct {
			Allow []string `json:"allow"`
		} `json:"permissions"`
	}
	if json.Unmarshal(data, &s) != nil {
		return nil
	}
	return s.Permissions.Allow
}
