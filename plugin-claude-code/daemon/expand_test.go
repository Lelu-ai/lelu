package daemon

import (
	"os"
	"path/filepath"
	"slices"
	"testing"
)

func testEnv(home string) map[string]string {
	return map[string]string{"HOME": home}
}

func TestAnalyzeCommand_TildeExpansion(t *testing.T) {
	cases := []struct {
		name string
		cmd  string
		want string
	}{
		{"trailing slash", "rm -rf ~/", "/home/testuser"},
		{"bare tilde", "rm -rf ~", "/home/testuser"},
		{"dollar home", "rm -rf $HOME", "/home/testuser"},
		{"braced home", "rm -rf ${HOME}/", "/home/testuser"},
		{"quoted home", `rm -rf "$HOME"`, "/home/testuser"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := AnalyzeCommand(tc.cmd, "/home/testuser/project", testEnv("/home/testuser"))
			if a.ParseErr {
				t.Fatalf("unexpected parse error for %q", tc.cmd)
			}
			if len(a.Calls) != 1 {
				t.Fatalf("expected 1 call, got %d", len(a.Calls))
			}
			if !slices.Contains(a.Calls[0].ResolvedPaths, tc.want) {
				t.Errorf("cmd %q: resolved paths = %v, want to contain %q", tc.cmd, a.Calls[0].ResolvedPaths, tc.want)
			}
		})
	}
}

func TestAnalyzeCommand_RelativePathAgainstCwd(t *testing.T) {
	a := AnalyzeCommand("rm -rf .", "/home/testuser", testEnv("/home/testuser"))
	if len(a.Calls) != 1 {
		t.Fatalf("expected 1 call, got %d", len(a.Calls))
	}
	if !slices.Contains(a.Calls[0].ResolvedPaths, "/home/testuser") {
		t.Errorf("resolved paths = %v, want to contain /home/testuser", a.Calls[0].ResolvedPaths)
	}
}

func TestAnalyzeCommand_BenignSubdirectoryNotHome(t *testing.T) {
	a := AnalyzeCommand("rm -rf node_modules", "/home/testuser/project", testEnv("/home/testuser"))
	want := "/home/testuser/project/node_modules"
	if !slices.Contains(a.Calls[0].ResolvedPaths, want) {
		t.Errorf("resolved paths = %v, want to contain %q", a.Calls[0].ResolvedPaths, want)
	}
	if slices.Contains(a.Calls[0].ResolvedPaths, "/home/testuser") {
		t.Errorf("must not resolve to bare home dir: %v", a.Calls[0].ResolvedPaths)
	}
}

func TestAnalyzeCommand_AbsolutePathUnaffected(t *testing.T) {
	a := AnalyzeCommand("rm -rf /home/testuser/project/build", "/home/testuser/project", testEnv("/home/testuser"))
	want := "/home/testuser/project/build"
	if !slices.Contains(a.Calls[0].ResolvedPaths, want) {
		t.Errorf("resolved paths = %v, want to contain %q", a.Calls[0].ResolvedPaths, want)
	}
}

func TestAnalyzeCommand_ChainedCommandsBothAnalyzed(t *testing.T) {
	a := AnalyzeCommand("cd /tmp && rm -rf ~/", "/home/testuser", testEnv("/home/testuser"))
	if len(a.Calls) != 2 {
		t.Fatalf("expected 2 calls (cd, rm), got %d: %+v", len(a.Calls), a.Calls)
	}
	if a.Calls[0].Name != "cd" || a.Calls[1].Name != "rm" {
		t.Fatalf("unexpected call names: %q, %q", a.Calls[0].Name, a.Calls[1].Name)
	}
	if !slices.Contains(a.Calls[1].ResolvedPaths, "/home/testuser") {
		t.Errorf("rm call resolved paths = %v, want to contain /home/testuser", a.Calls[1].ResolvedPaths)
	}
}

func TestAnalyzeCommand_SudoPrefixStillExpandsArgs(t *testing.T) {
	a := AnalyzeCommand("sudo rm -rf ~/", "/home/testuser", testEnv("/home/testuser"))
	if a.Calls[0].Name != "sudo" {
		t.Fatalf("expected Name=sudo, got %q", a.Calls[0].Name)
	}
	if !slices.Contains(a.Calls[0].ResolvedPaths, "/home/testuser") {
		t.Errorf("resolved paths = %v, want to contain /home/testuser even under sudo", a.Calls[0].ResolvedPaths)
	}
}

func TestAnalyzeCommand_GlobExpandsAgainstRealFilesystem(t *testing.T) {
	dir := t.TempDir()
	for _, f := range []string{"proj-a", "proj-b", "other"} {
		if err := os.Mkdir(filepath.Join(dir, f), 0o755); err != nil {
			t.Fatal(err)
		}
	}

	a := AnalyzeCommand("rm -rf proj*", dir, testEnv("/home/testuser"))
	if len(a.Calls) != 1 {
		t.Fatalf("expected 1 call, got %d", len(a.Calls))
	}
	got := a.Calls[0].ResolvedPaths
	wantA := filepath.Join(dir, "proj-a")
	wantB := filepath.Join(dir, "proj-b")
	if !slices.Contains(got, wantA) || !slices.Contains(got, wantB) {
		t.Errorf("resolved paths = %v, want to contain %q and %q", got, wantA, wantB)
	}
	if slices.Contains(got, filepath.Join(dir, "other")) {
		t.Errorf("glob over-matched: resolved paths = %v", got)
	}
}

// TestAnalyzeCommand_CommandSubstitutionNeverExecutes is the safety-critical
// test: a command substitution must be classified Dynamic and MUST NOT be
// executed during analysis. We assert this by using a payload that would
// leave forensic evidence (a marker file) if it were ever actually run, and
// confirming that evidence never appears.
func TestAnalyzeCommand_CommandSubstitutionNeverExecutes(t *testing.T) {
	dir := t.TempDir()
	marker := filepath.Join(dir, "PWNED")
	cmd := `rm -rf "$(touch ` + marker + ` && echo pwned)"`

	a := AnalyzeCommand(cmd, dir, testEnv("/home/testuser"))

	if _, err := os.Stat(marker); err == nil {
		t.Fatalf("SAFETY VIOLATION: command substitution was executed, marker file created at %s", marker)
	}
	if !a.Dynamic {
		t.Errorf("expected command with $(...) to be classified Dynamic, got Dynamic=false")
	}
}

func TestAnalyzeCommand_BenignCommandNotFlaggedDynamic(t *testing.T) {
	a := AnalyzeCommand("echo hello", "/tmp", testEnv("/home/testuser"))
	if a.Dynamic {
		t.Errorf("plain echo should not be Dynamic")
	}
	if a.Calls[0].Name != "echo" {
		t.Errorf("expected Name=echo, got %q", a.Calls[0].Name)
	}
}

func TestAnalyzeCommand_UnparseableSyntaxMarked(t *testing.T) {
	a := AnalyzeCommand("rm -rf ((( unterminated", "/tmp", testEnv("/home/testuser"))
	if !a.ParseErr {
		t.Errorf("expected ParseErr for malformed shell syntax")
	}
}
