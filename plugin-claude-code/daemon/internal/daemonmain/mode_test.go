package daemonmain

import (
	"os"
	"path/filepath"
	"testing"
)

func TestShadowModeReader(t *testing.T) {
	cases := []struct {
		name    string
		content *string
		shadow  bool
	}{
		{"no mode file", nil, true},
		{"enforce", ptr("enforce"), false},
		{"capitalized", ptr("Enforce\n"), false},
		{"upper case with spaces", ptr("  ENFORCE \n"), false},
		{"shadow", ptr("shadow"), true},
		{"unrecognized value", ptr("enforcing"), true},
		{"empty file", ptr(""), true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "mode")
			if tc.content != nil {
				if err := os.WriteFile(path, []byte(*tc.content), 0o600); err != nil {
					t.Fatal(err)
				}
			}
			if got := shadowModeReader(path)(); got != tc.shadow {
				t.Errorf("shadow = %v, want %v", got, tc.shadow)
			}
		})
	}
}

func ptr(s string) *string { return &s }
