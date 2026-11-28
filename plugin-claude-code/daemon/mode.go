package daemon

import (
	"errors"
	"os"
	"strings"
)

// The values the mode file can hold.
const (
	ModeShadow  = "shadow"
	ModeEnforce = "enforce"
)

// ModeFile is the mode file's state.
type ModeFile struct {
	// Mode is the mode Lelu runs in: ModeEnforce or ModeShadow.
	Mode string
	// Present is false when there is no mode file, which means shadow mode,
	// the default.
	Present bool
	// Recognized is false when the file holds something other than
	// "enforce" or "shadow", including nothing at all. Lelu then runs in
	// shadow mode and says so, rather than guessing what was meant.
	Recognized bool
	// Value is the file's content, for reporting an unrecognized value.
	Value string
}

// ParseMode reads a mode file's content. Case and whitespace are ignored,
// so "Enforce\n" means enforce. hooks/lelu-hook.sh reads the file the same
// way.
func ParseMode(content string) ModeFile {
	m := ModeFile{Present: true, Value: content, Mode: ModeShadow}
	switch strings.ToLower(strings.Join(strings.Fields(content), "")) {
	case ModeEnforce:
		m.Mode, m.Recognized = ModeEnforce, true
	case ModeShadow:
		m.Recognized = true
	}
	return m
}

// ReadMode reads the mode file at path. A missing file is shadow mode.
func ReadMode(path string) ModeFile {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return ModeFile{Mode: ModeShadow, Recognized: true}
	}
	if err != nil {
		return ModeFile{Mode: ModeShadow, Present: true}
	}
	return ParseMode(string(data))
}
