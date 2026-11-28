package daemon

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseMode(t *testing.T) {
	cases := []struct {
		content    string
		mode       string
		recognized bool
	}{
		{"enforce", ModeEnforce, true},
		{"enforce\n", ModeEnforce, true},
		{"  enforce  \n", ModeEnforce, true},
		{"Enforce", ModeEnforce, true},
		{"ENFORCE\n", ModeEnforce, true},
		{"shadow", ModeShadow, true},
		{"Shadow\n", ModeShadow, true},
		// Anything else runs in shadow mode and is reported as unrecognized.
		{"enforcing", ModeShadow, false},
		{"on", ModeShadow, false},
		{"", ModeShadow, false},
		{"\n", ModeShadow, false},
	}
	for _, tc := range cases {
		m := ParseMode(tc.content)
		if m.Mode != tc.mode || m.Recognized != tc.recognized || !m.Present {
			t.Errorf("ParseMode(%q) = %+v, want mode %q, recognized %v", tc.content, m, tc.mode, tc.recognized)
		}
	}
}

func TestReadMode_MissingFileIsShadow(t *testing.T) {
	m := ReadMode(filepath.Join(t.TempDir(), "mode"))
	if m.Mode != ModeShadow || m.Present || !m.Recognized {
		t.Errorf("missing mode file: got %+v, want shadow, not present, recognized", m)
	}
}

func TestReadMode_ReadsFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "mode")
	if err := os.WriteFile(path, []byte("Enforce\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if m := ReadMode(path); m.Mode != ModeEnforce {
		t.Errorf("got %+v, want enforce", m)
	}
}
