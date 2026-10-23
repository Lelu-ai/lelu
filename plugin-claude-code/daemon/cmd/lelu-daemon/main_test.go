package main

import (
	"bufio"
	"encoding/json"
	"net"
	"testing"
	"time"

	"github.com/lelu-ai/lelu/plugin-claude-code/daemon"
)

// roundTrip sends one request through handleConn over an in-memory pipe and
// returns the decoded response.
func roundTrip(t *testing.T, engine *daemon.Engine, req daemon.Request) daemon.Response {
	t.Helper()
	client, server := net.Pipe()
	defer client.Close()
	go handleConn(server, engine)

	_ = client.SetDeadline(time.Now().Add(5 * time.Second))
	data, _ := json.Marshal(req)
	if _, err := client.Write(append(data, '\n')); err != nil {
		t.Fatalf("write request: %v", err)
	}
	scanner := bufio.NewScanner(client)
	if !scanner.Scan() {
		t.Fatalf("no response from handleConn (err=%v) — a panic must still produce a decision", scanner.Err())
	}
	var resp daemon.Response
	if err := json.Unmarshal(scanner.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return resp
}

// A nil policy set panics inside Decide — standing in for any bug that would
// otherwise crash the daemon and leave the hook to let the call through.
func panickingEngine(shadow bool) *daemon.Engine {
	return &daemon.Engine{ShadowMode: func() bool { return shadow }}
}

func TestHandleConn_PanicAnswersAskInsteadOfCrashing(t *testing.T) {
	resp := roundTrip(t, panickingEngine(false), daemon.Request{Tool: "Bash", Command: "ls", Cwd: "/tmp"})
	if resp.Outcome != daemon.OutcomeAsk {
		t.Errorf("outcome = %q, want ask; response=%+v", resp.Outcome, resp)
	}
}

func TestHandleConn_PanicInShadowModeStaysNonBlocking(t *testing.T) {
	resp := roundTrip(t, panickingEngine(true), daemon.Request{Tool: "Bash", Command: "ls", Cwd: "/tmp"})
	if resp.Outcome != daemon.OutcomeAllow || !resp.Shadow {
		t.Errorf("shadow mode must not block: got outcome=%q shadow=%v; response=%+v", resp.Outcome, resp.Shadow, resp)
	}
}
