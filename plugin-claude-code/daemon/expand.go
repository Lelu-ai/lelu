// Package daemon implements the Lelu Claude Code plugin's local decision engine.
package daemon

import (
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"mvdan.cc/sh/v3/expand"
	"mvdan.cc/sh/v3/syntax"
)

// ErrDynamicContent marks a command segment that cannot be safely resolved
// without executing arbitrary code (command substitution, process substitution,
// arithmetic with side effects). Analysis must never execute these — a command
// containing one is classified Dynamic instead of being expanded.
var errDynamicContent = fmt.Errorf("dynamic content: refused to evaluate")

// CommandCall is one simple command extracted from a (possibly compound,
// piped, or chained) shell line, with its arguments resolved as far as
// static analysis safely allows.
type CommandCall struct {
	Name           string   // resolved argv[0], e.g. "rm"
	Args           []string // resolved argv[1:], with ~, $VARS, globs expanded
	RawArgs        []string // pre-expansion source text, for display/audit
	Dynamic        bool     // true if any arg contains unresolvable dynamic content
	ResolvedPaths  []string // Args that look like filesystem paths, made absolute against cwd
}

// Analysis is the result of expansion-aware analysis of a full command line,
// which may contain multiple simple commands (pipes, &&, ;, subshells).
type Analysis struct {
	Raw      string
	Calls    []CommandCall
	Dynamic  bool // true if ANY call in the line has unresolvable dynamic content
	ParseErr bool // true if the shell syntax itself failed to parse
}

// AnalyzeCommand parses a bash command line and resolves tilde expansion,
// parameter (environment variable) expansion, and filesystem globs against
// env and cwd, WITHOUT executing anything — including command substitutions,
// which are refused and marked Dynamic rather than run.
func AnalyzeCommand(command string, cwd string, env map[string]string) Analysis {
	result := Analysis{Raw: command}

	parser := syntax.NewParser(syntax.Variant(syntax.LangBash))
	file, err := parser.Parse(strings.NewReader(command), "")
	if err != nil {
		result.ParseErr = true
		return result
	}

	cfg := buildExpandConfig(cwd, env)

	syntax.Walk(file, func(node syntax.Node) bool {
		call, ok := node.(*syntax.CallExpr)
		if !ok || len(call.Args) == 0 {
			return true
		}
		result.Calls = append(result.Calls, resolveCall(cfg, cwd, call))
		return true
	})

	for _, c := range result.Calls {
		if c.Dynamic {
			result.Dynamic = true
			break
		}
	}

	return result
}

func buildExpandConfig(cwd string, env map[string]string) *expand.Config {
	pairs := make([]string, 0, len(env))
	for k, v := range env {
		pairs = append(pairs, k+"="+v)
	}
	if _, ok := env["HOME"]; !ok {
		if home, err := os.UserHomeDir(); err == nil {
			pairs = append(pairs, "HOME="+home)
		}
	}

	return &expand.Config{
		Env:      expand.ListEnviron(pairs...),
		GlobStar: true,
		ReadDir2: func(path string) ([]fs.DirEntry, error) {
			if !filepath.IsAbs(path) && cwd != "" {
				path = filepath.Join(cwd, path)
			}
			return os.ReadDir(path)
		},
		CmdSubst: func(w io.Writer, cs *syntax.CmdSubst) error {
			return errDynamicContent
		},
	}
}

func resolveCall(cfg *expand.Config, cwd string, call *syntax.CallExpr) CommandCall {
	cc := CommandCall{}

	for _, word := range call.Args {
		raw := wordSource(word)
		cc.RawArgs = append(cc.RawArgs, raw)

		fields, err := expand.Fields(cfg, word)
		if err != nil {
			cc.Dynamic = true
			cc.Args = append(cc.Args, raw)
			continue
		}
		if len(fields) == 0 {
			cc.Args = append(cc.Args, "")
			continue
		}
		cc.Args = append(cc.Args, fields...)
	}

	if len(cc.Args) > 0 {
		cc.Name = filepath.Base(cc.Args[0])
	}

	for _, a := range cc.Args[minInt(1, len(cc.Args)):] {
		if looksLikePath(a) {
			cc.ResolvedPaths = append(cc.ResolvedPaths, absPath(cwd, a))
		}
	}

	return cc
}

// wordSource reconstructs the original source text of a word for display,
// since expansion may fail and we still want to show the user what we saw.
func wordSource(w *syntax.Word) string {
	printer := syntax.NewPrinter()
	var sb strings.Builder
	_ = printer.Print(&sb, w)
	return sb.String()
}

func looksLikePath(arg string) bool {
	if arg == "" || strings.HasPrefix(arg, "-") {
		return false
	}
	return true
}

func absPath(cwd, p string) string {
	if p == "" {
		return p
	}
	if filepath.IsAbs(p) {
		return filepath.Clean(p)
	}
	if cwd == "" {
		return p
	}
	return filepath.Clean(filepath.Join(cwd, p))
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
