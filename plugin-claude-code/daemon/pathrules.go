package daemon

import (
	"path"
	"path/filepath"
	"strings"
)

// protectedPathRule is one entry of protected_paths, sensitive_paths or
// guarded_paths.
type protectedPathRule struct {
	Exact string `json:"exact,omitempty"`
	// Name matches whole path components, never part of one: a file or
	// folder name such as ".env" or ".ssh", or several in a row such as
	// ".aws/credentials". Each part may use path.Match wildcards
	// (".env.*", "id_rsa*"). ".env" matches /p/.env, not /p/app.env.ts.
	Name string `json:"name,omitempty"`
	// Under matches a folder and everything inside it, e.g. "$HOME/.lelu".
	Under string `json:"under,omitempty"`
	// Contains matches the text anywhere in the path. It is kept for rules
	// users add themselves; the default rules use Name, since a substring
	// also hits unrelated files (".env" is in "app.environment.ts").
	Contains string `json:"contains,omitempty"`
	// Suffix matches the end of the path.
	Suffix string `json:"suffix,omitempty"`
	// Except exempts an otherwise-matching path. For a Name rule it lists
	// names of the matched file or folder, e.g. ".env.example", a template
	// that is usually committed on purpose. For the other forms it lists
	// substrings of the path.
	Except []string `json:"except,omitempty"`
}

// matches reports whether path p hits this rule. home resolves "$HOME".
// Wildcards left in p (an unexpanded glob such as ".env*") count as a match
// when they could match a name the rule covers.
func (r protectedPathRule) matches(p, home string) bool {
	return r.match(p, home, false)
}

// matchesSearchRoot is matches for a folder that a search reads everything
// inside of: it also matches a folder that holds a file the rule names, such
// as ~/.aws for ".aws/credentials".
func (r protectedPathRule) matchesSearchRoot(p, home string) bool {
	return r.match(p, home, true)
}

func (r protectedPathRule) match(p, home string, searchRoot bool) bool {
	if r.Name != "" && r.nameMatches(p, searchRoot) {
		return true
	}
	if r.Under != "" {
		if want := resolveHome(r.Under, home); want != "" {
			want = filepath.Clean(want)
			if p == want || strings.HasPrefix(p, strings.TrimSuffix(want, "/")+"/") {
				return true
			}
		}
	}
	if r.Name == "" {
		for _, ex := range r.Except {
			if ex != "" && strings.Contains(p, ex) {
				return false
			}
		}
	}
	if r.Exact != "" {
		if want := resolveHome(r.Exact, home); want != "" && p == want {
			return true
		}
	}
	if r.Contains != "" && strings.Contains(p, r.Contains) {
		return true
	}
	return r.Suffix != "" && strings.HasSuffix(p, r.Suffix)
}

// resolveHome replaces a leading "$HOME" with home. It returns "" when the
// rule needs a home directory and none is known.
func resolveHome(s, home string) string {
	if s == "$HOME" || strings.HasPrefix(s, "$HOME/") {
		if home == "" {
			return ""
		}
		return home + strings.TrimPrefix(s, "$HOME")
	}
	return s
}

// nameMatches reports whether consecutive components of p match the rule's
// Name parts.
func (r protectedPathRule) nameMatches(p string, searchRoot bool) bool {
	want := pathParts(r.Name)
	if len(want) == 0 {
		return false
	}
	parts := pathParts(p)
	for i := 0; i+len(want) <= len(parts); i++ {
		if partsMatch(parts[i:i+len(want)], want, r.Except) {
			return true
		}
	}
	if searchRoot {
		// A folder whose last components begin the rule, e.g. ~/.aws for
		// ".aws/credentials": searching it reads the file.
		for k := len(want) - 1; k >= 1; k-- {
			if k <= len(parts) && partsMatch(parts[len(parts)-k:], want[:k], nil) {
				return true
			}
		}
	}
	return false
}

// pathParts splits a path into components. It drops "**", which matches
// zero or more folders in a glob, so what is left is one path the glob
// matches.
func pathParts(p string) []string {
	var parts []string
	for _, c := range strings.Split(filepath.ToSlash(p), "/") {
		if c != "" && c != "." && c != "**" {
			parts = append(parts, c)
		}
	}
	return parts
}

// partsMatch reports whether each component in got matches the rule part at
// the same position in want. except applies to the last component.
func partsMatch(got, want, except []string) bool {
	for j := range want {
		var ex []string
		if j == len(want)-1 {
			ex = except
		}
		if !componentMatches(got[j], want[j], j == 0, ex) {
			return false
		}
	}
	return true
}

// componentMatches reports whether the path component got, which may hold
// wildcards, matches or could match the rule part want.
func componentMatches(got, want string, first bool, except []string) bool {
	if ok, _ := path.Match(want, got); ok && !nameExcepted(got, except) {
		return true
	}
	if !strings.ContainsAny(got, "*?[") {
		return false
	}
	// A bare wildcard such as "*" or "*.*" says nothing about which file it
	// is after, and counting it would flag every search. Later in a rule
	// (the "*" in ".aws/*") the folder before it already does.
	if first && strings.Trim(got, "*?.") == "" {
		return false
	}
	for _, sample := range nameSamples(want) {
		// As in the shell, a leading wildcard does not match a dot file.
		if strings.HasPrefix(sample, ".") && strings.ContainsAny(got[:1], "*?[") {
			continue
		}
		if ok, _ := path.Match(got, sample); ok && !nameExcepted(sample, except) {
			return true
		}
	}
	return false
}

// nameSamples returns names the rule part want matches, so that a glob can
// be tested against them.
func nameSamples(want string) []string {
	if !strings.ContainsAny(want, "*?") {
		return []string{want}
	}
	short := strings.ReplaceAll(strings.ReplaceAll(want, "*", ""), "?", "x")
	long := strings.ReplaceAll(strings.ReplaceAll(want, "*", "local"), "?", "x")
	return []string{short, long}
}

func nameExcepted(name string, except []string) bool {
	for _, ex := range except {
		if ok, _ := path.Match(ex, name); ok {
			return true
		}
	}
	return false
}

// expandBraces expands {a,b} alternatives in a glob, as the Glob and Grep
// tools do, so "**/.{env,netrc}" is checked as "**/.env" and "**/.netrc".
func expandBraces(s string) []string {
	const limit = 64
	open := strings.IndexByte(s, '{')
	if open < 0 {
		return []string{s}
	}
	depth, end := 0, -1
	var commas []int
scan:
	for i := open; i < len(s); i++ {
		switch s[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				end = i
				break scan
			}
		case ',':
			if depth == 1 {
				commas = append(commas, i)
			}
		}
	}
	if end < 0 || len(commas) == 0 {
		return []string{s}
	}
	var out []string
	start := open + 1
	for _, c := range append(commas, end) {
		for _, e := range expandBraces(s[:open] + s[start:c] + s[end+1:]) {
			if len(out) == limit {
				return out
			}
			out = append(out, e)
		}
		start = c + 1
	}
	return out
}

// searchTouchesSensitive reports a sensitive path that a Grep or Glob call
// may read: its search root (root, or cwd when root is empty), its glob, or
// the glob inside the root.
func (ps *PolicySet) searchTouchesSensitive(root, glob, cwd, home string) (string, bool) {
	root = expandTilde(root, home)
	if root == "" {
		root = cwd
	} else if !filepath.IsAbs(root) && cwd != "" {
		root = filepath.Join(cwd, root)
	}
	if root != "" {
		root = filepath.Clean(root)
		for _, rule := range ps.SensitivePaths {
			if rule.matchesSearchRoot(root, home) {
				return root, true
			}
		}
	}
	if glob == "" {
		return "", false
	}
	for _, g := range expandBraces(glob) {
		g = expandTilde(g, home)
		candidates := []string{g}
		if root != "" && !filepath.IsAbs(g) {
			candidates = append(candidates, root+"/"+g)
		}
		for _, c := range candidates {
			if ps.pathIsSensitive(c, home) {
				return c, true
			}
		}
	}
	return "", false
}

func expandTilde(p, home string) string {
	if home != "" && (p == "~" || strings.HasPrefix(p, "~/")) {
		return home + strings.TrimPrefix(p, "~")
	}
	return p
}
