// Package daemonmain runs the Lelu Claude Code plugin's local decision
// engine: one unix socket, one policy set, one audit ledger, per machine.
package daemonmain

import (
	"bufio"
	"encoding/json"
	"errors"
	"log"
	"net"
	"os"
	"path/filepath"
	"sync"

	"github.com/lelu-ai/lelu/plugin-claude-code/daemon"
)

func Main() {
	dataDir := dataDir()
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		log.Fatalf("lelu-daemon: creating data dir: %v", err)
	}

	policyPath := os.Getenv("LELU_POLICY_PATH")
	if policyPath == "" {
		if root := os.Getenv("CLAUDE_PLUGIN_ROOT"); root != "" {
			policyPath = filepath.Join(root, "policies", "defaults.json")
		} else {
			policyPath = filepath.Join("policies", "defaults.json")
		}
	}
	policy, err := daemon.LoadPolicySet(policyPath)
	if err != nil {
		log.Fatalf("lelu-daemon: loading policy set from %s: %v", policyPath, err)
	}
	loadLocalRules(policy, filepath.Join(dataDir, daemon.LocalPolicyFile))
	// Guard the data directory wherever it is: the default ~/.lelu is in the
	// default policy, but LELU_DATA_DIR can point anywhere.
	if abs, err := filepath.Abs(dataDir); err == nil {
		policy.GuardPath(abs)
	}

	ledger, err := daemon.OpenLedger(filepath.Join(dataDir, "ledger.jsonl"))
	if err != nil {
		log.Fatalf("lelu-daemon: opening ledger: %v", err)
	}
	defer ledger.Close()

	home, err := os.UserHomeDir()
	if err != nil {
		log.Fatalf("lelu-daemon: resolving home directory: %v", err)
	}

	modePath := filepath.Join(dataDir, "mode")
	engine := &daemon.Engine{
		Policy:     policy,
		Ledger:     ledger,
		Loop:       daemon.NewLoopTracker(),
		Budget:     daemon.NewBudgetTracker(),
		Home:       home,
		ShadowMode: shadowModeReader(modePath),
	}

	sockPath := filepath.Join(dataDir, "daemon.sock")
	os.Remove(sockPath) // clear a stale socket from a previous crashed run

	listener, err := net.Listen("unix", sockPath)
	if err != nil {
		log.Fatalf("lelu-daemon: failed to listen on %s: %v", sockPath, err)
	}
	defer listener.Close()

	log.Printf("lelu-daemon: listening on %s (policy=%s, mode file=%s)", sockPath, policyPath, modePath)
	serve(listener, engine)
}

// loadLocalRules adds the user's own rules from path to policy. A missing
// file is normal. A file that does not parse is logged and skipped rather
// than stopping the daemon: a typo in one added rule must not switch off the
// default rules too.
func loadLocalRules(policy *daemon.PolicySet, path string) {
	local, err := daemon.LoadPolicySet(path)
	if errors.Is(err, os.ErrNotExist) {
		return
	}
	if err != nil {
		log.Printf("lelu-daemon: ignoring local rules in %s: %v", path, err)
		return
	}
	policy.Merge(local)
	log.Printf("lelu-daemon: loaded local rules from %s (%d destructive commands, %d protected paths, %d sensitive paths)",
		path, len(local.DestructiveCommands), len(local.ProtectedPaths), len(local.SensitivePaths))
}

func serve(listener net.Listener, engine *daemon.Engine) {
	for {
		conn, err := listener.Accept()
		if err != nil {
			log.Printf("lelu-daemon: accept error: %v", err)
			continue
		}
		go handleConn(conn, engine)
	}
}

func handleConn(conn net.Conn, engine *daemon.Engine) {
	defer conn.Close()

	// A panic in one request must not take the daemon down: the hook reads a
	// dead daemon as "unreachable" and lets the call through unchecked, and the
	// next call too if the respawn isn't up yet. Answer "ask" instead.
	defer func() {
		if r := recover(); r != nil {
			log.Printf("lelu-daemon: recovered panic while handling request: %v", r)
			resp := daemon.Response{Outcome: daemon.OutcomeAsk, Reason: "internal error while checking this action; routing to human review"}
			if engine.ShadowMode != nil && engine.ShadowMode() {
				resp = daemon.Response{Outcome: daemon.OutcomeAllow, Shadow: true, Reason: "[shadow mode] would have been ask: " + resp.Reason}
			}
			writeResponse(conn, resp)
		}
	}()

	scanner := bufio.NewScanner(conn)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	if !scanner.Scan() {
		return
	}

	var req daemon.Request
	if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
		resp := daemon.Response{Outcome: daemon.OutcomeAsk, Reason: "malformed request JSON: " + err.Error()}
		writeResponse(conn, resp)
		return
	}

	resp := engine.Decide(req)
	writeResponse(conn, resp)
}

func writeResponse(conn net.Conn, resp daemon.Response) {
	data, err := json.Marshal(resp)
	if err != nil {
		return
	}
	data = append(data, '\n')
	_, _ = conn.Write(data)
}

func dataDir() string {
	if d := os.Getenv("LELU_DATA_DIR"); d != "" {
		return d
	}
	if d := os.Getenv("LELU_HOME"); d != "" {
		return d
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return ".lelu-claude-plugin"
	}
	return filepath.Join(home, ".lelu", "claude-plugin")
}

// shadowModeReader reads the mode file on every request, so /lelu:enforce
// and /lelu:shadow take effect without a restart. No mode file means shadow
// mode, the default. A value other than "enforce" or "shadow" (in any case)
// also means shadow mode; it is logged once each time it changes, and the
// session start message and /lelu:status report it.
func shadowModeReader(modePath string) func() bool {
	var mu sync.Mutex
	lastWarned := ""
	return func() bool {
		m := daemon.ReadMode(modePath)
		if !m.Recognized {
			mu.Lock()
			if m.Value != lastWarned {
				lastWarned = m.Value
				log.Printf("lelu-daemon: mode file %s holds %q, which is not \"enforce\" or \"shadow\"; running in shadow mode", modePath, m.Value)
			}
			mu.Unlock()
		}
		return m.Mode != daemon.ModeEnforce
	}
}
