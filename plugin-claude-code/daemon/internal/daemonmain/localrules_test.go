package daemonmain

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/lelu-ai/lelu/plugin-claude-code/daemon"
)

func TestLoadLocalRules(t *testing.T) {
	cases := []struct {
		name    string
		content *string // nil means no file
		want    int     // protected paths after loading
	}{
		{name: "missing file keeps defaults", content: nil, want: 1},
		{name: "valid file adds its rules", content: strPtr(`{"protected_paths":[{"contains":"prod-db"}]}`), want: 2},
		{name: "malformed file is skipped", content: strPtr(`{"protected_paths":[`), want: 1},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), daemon.LocalPolicyFile)
			if tc.content != nil {
				if err := os.WriteFile(path, []byte(*tc.content), 0o600); err != nil {
					t.Fatal(err)
				}
			}
			policy, err := daemon.LoadPolicySet(writeDefaults(t))
			if err != nil {
				t.Fatal(err)
			}
			loadLocalRules(policy, path)
			if got := len(policy.ProtectedPaths); got != tc.want {
				t.Errorf("protected paths = %d, want %d", got, tc.want)
			}
		})
	}
}

func writeDefaults(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "defaults.json")
	if err := os.WriteFile(path, []byte(`{"protected_paths":[{"exact":"$HOME"}]}`), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func strPtr(s string) *string { return &s }
