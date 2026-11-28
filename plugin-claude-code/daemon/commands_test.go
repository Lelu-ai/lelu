package daemon

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// modeCommand returns the bash command a mode slash command tells the model
// to run, from the ```bash block in commands/<name>.md.
func modeCommand(t *testing.T, name string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("..", "commands", name+".md"))
	if err != nil {
		t.Fatal(err)
	}
	_, rest, ok := strings.Cut(string(data), "```bash\n")
	if !ok {
		t.Fatalf("commands/%s.md has no bash block", name)
	}
	cmd, _, ok := strings.Cut(rest, "\n```")
	if !ok {
		t.Fatalf("commands/%s.md: unterminated bash block", name)
	}
	return cmd
}

// /lelu:enforce and /lelu:shadow write the mode file with a fixed command.
// It writes the right value, and it is a change to Lelu's own files, so it
// asks in either mode.
func TestModeCommands(t *testing.T) {
	for _, mode := range []string{ModeEnforce, ModeShadow} {
		t.Run(mode, func(t *testing.T) {
			cmd := modeCommand(t, mode)

			dataDir := filepath.Join(t.TempDir(), "data")
			run := exec.Command("sh", "-c", cmd)
			run.Env = append(os.Environ(), "LELU_DATA_DIR="+dataDir)
			out, err := run.Output()
			if err != nil {
				t.Fatalf("running the command: %v", err)
			}
			if string(out) != mode {
				t.Errorf("command printed %q, want %q", out, mode)
			}
			if m := ReadMode(filepath.Join(dataDir, "mode")); m.Mode != mode || !m.Recognized {
				t.Errorf("mode file read as %+v, want %s", m, mode)
			}

			for _, shadow := range []bool{true, false} {
				engine, _ := newTestEngine(t, shadow)
				resp := engine.Decide(Request{SessionID: "s", Tool: "Bash", Command: cmd, Cwd: "/home/testuser/project",
					Env: map[string]string{"HOME": "/home/testuser"}})
				if resp.Outcome != OutcomeAsk || resp.Rule != "self-protection" {
					t.Errorf("shadow=%v: outcome %q rule %q, want a self-protection ask", shadow, resp.Outcome, resp.Rule)
				}
			}
		})
	}
}
