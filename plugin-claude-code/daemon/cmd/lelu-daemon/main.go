// Command lelu-daemon runs the Lelu Claude Code plugin's local decision
// engine: one unix socket, one policy set, one audit ledger, per machine.
package main

import (
	"bufio"
	"encoding/json"
	"log"
	"net"
	"os"
	"path/filepath"
	"strings"

	"github.com/lelu-ai/lelu/plugin-claude-code/daemon"
)

func main() {
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
		log.Fatalf("lelu-daemon: listening on %s: %v", sockPath, err)
	}
	defer listener.Close()

	log.Printf("lelu-daemon: listening on %s (policy=%s, mode file=%s)", sockPath, policyPath, modePath)
	serve(listener, engine)
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
	home, err := os.UserHomeDir()
	if err != nil {
		return ".lelu-claude-plugin"
	}
	return filepath.Join(home, ".lelu", "claude-plugin")
}

func shadowModeReader(modePath string) func() bool {
	return func() bool {
		data, err := os.ReadFile(modePath)
		if err != nil {
			return true // no mode file yet => default to shadow, the safe default
		}
		return strings.TrimSpace(string(data)) != "enforce"
	}
}
