// Command lelu is the hook adapter and the daemon in one binary, so the
// plugin downloads a single file. It runs as whichever it is called:
//
//	lelu-hook (a link to this binary), or "lelu hook"     → PreToolUse adapter
//	lelu-daemon (a link to this binary), or "lelu daemon" → decision engine
//
// hooks/lelu-hook.sh creates the two links next to the binary. lelu-hook
// starts the daemon through the lelu-daemon link, so the daemon process is
// named lelu-daemon, as with separate binaries.
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/lelu-ai/lelu/plugin-claude-code/daemon/internal/daemonmain"
	"github.com/lelu-ai/lelu/plugin-claude-code/daemon/internal/hook"
)

func main() {
	switch role(os.Args) {
	case "hook":
		hook.Main()
	case "daemon":
		daemonmain.Main()
	default:
		fmt.Fprintln(os.Stderr, "usage: lelu hook | lelu daemon (or run it as lelu-hook / lelu-daemon)")
		os.Exit(2)
	}
}

// role picks hook or daemon from the name the binary was run as, then from
// the first argument.
func role(args []string) string {
	switch filepath.Base(args[0]) {
	case "lelu-hook":
		return "hook"
	case "lelu-daemon":
		return "daemon"
	}
	if len(args) > 1 && (args[1] == "hook" || args[1] == "daemon") {
		return args[1]
	}
	return ""
}
