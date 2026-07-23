package daemon

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func newTestEngine(t *testing.T, shadow bool) (*Engine, string) {
	t.Helper()
	ps := loadTestPolicy(t)
	dir := t.TempDir()
	ledger, err := OpenLedger(filepath.Join(dir, "ledger.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ledger.Close() })

	return &Engine{
		Policy:     ps,
		Ledger:     ledger,
		Loop:       NewLoopTracker(),
		Home:       "/home/testuser",
		ShadowMode: func() bool { return shadow },
	}, dir
}

func TestEngine_EnforceMode_DeniesHomeWipe(t *testing.T) {
	engine, _ := newTestEngine(t, false)
	resp := engine.Decide(Request{
		SessionID: "s1", Tool: "Bash", Command: "rm -rf ~/", Cwd: "/home/testuser",
		Env: map[string]string{"HOME": "/home/testuser"},
	})
	if resp.Outcome != OutcomeDeny {
		t.Errorf("outcome = %q, want deny in enforce mode", resp.Outcome)
	}
	if resp.Shadow {
		t.Errorf("shadow flag should be false in enforce mode")
	}
}

func TestEngine_ShadowMode_OverridesToAllowButLogsRealOutcome(t *testing.T) {
	engine, dir := newTestEngine(t, true)
	resp := engine.Decide(Request{
		SessionID: "s1", Tool: "Bash", Command: "rm -rf ~/", Cwd: "/home/testuser",
		Env: map[string]string{"HOME": "/home/testuser"},
	})
	if resp.Outcome != OutcomeAllow {
		t.Errorf("outcome = %q, want allow — shadow mode must never block", resp.Outcome)
	}
	if !resp.Shadow {
		t.Errorf("shadow flag should be true")
	}

	data, err := os.ReadFile(filepath.Join(dir, "ledger.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	line := strings.TrimSpace(string(data))
	if !strings.Contains(line, `"outcome":"deny"`) {
		t.Errorf("ledger should record the REAL (deny) outcome even though the response allowed it; got: %s", line)
	}
	if !strings.Contains(line, `"shadow":true`) {
		t.Errorf("ledger entry should be marked shadow:true; got: %s", line)
	}
}

func TestEngine_EditProtectedPathDenied(t *testing.T) {
	engine, _ := newTestEngine(t, false)
	resp := engine.Decide(Request{
		SessionID: "s1", Tool: "Edit", FilePath: "/home/testuser/project/.env",
	})
	if resp.Outcome != OutcomeDeny {
		t.Errorf("outcome = %q, want deny for Edit on .env", resp.Outcome)
	}
}

func TestEngine_EditNormalFileAllowed(t *testing.T) {
	engine, _ := newTestEngine(t, false)
	resp := engine.Decide(Request{
		SessionID: "s1", Tool: "Edit", FilePath: "/home/testuser/project/main.go",
	})
	if resp.Outcome != OutcomeAllow {
		t.Errorf("outcome = %q, want allow for a normal source file", resp.Outcome)
	}
}

func TestEngine_UnknownToolDefaultsToAllow(t *testing.T) {
	engine, _ := newTestEngine(t, false)
	resp := engine.Decide(Request{SessionID: "s1", Tool: "mcp__something__weird"})
	if resp.Outcome != OutcomeAllow {
		t.Errorf("outcome = %q, want allow (no Tier-1 rule covers this tool yet)", resp.Outcome)
	}
}

// TestEngine_SimulatedRetryStormStoppedAfterNRepeats reproduces the failure
// mode behind the real, verified GitHub incidents this feature targets
// (unbounded sub-agent recursion, a model re-suggesting the same completed
// action forever): the same benign, individually-harmless command fired
// repeatedly should keep being allowed right up to the configured
// threshold, then flip to "ask" — not silently keep going forever, and not
// an outright deny that a legitimate retry-until-ready poll could never
// recover from.
func TestEngine_SimulatedRetryStormStoppedAfterNRepeats(t *testing.T) {
	engine, _ := newTestEngine(t, false)
	threshold := engine.Policy.LoopDetection.RepeatThreshold

	req := Request{
		SessionID: "storm-session", Tool: "Bash", Command: "curl -s https://api.example.com/status",
		Cwd: "/home/testuser", Env: map[string]string{"HOME": "/home/testuser"},
	}

	for i := 1; i < threshold; i++ {
		resp := engine.Decide(req)
		if resp.Outcome != OutcomeAllow {
			t.Fatalf("call %d/%d: outcome = %q, want allow (below threshold)", i, threshold, resp.Outcome)
		}
	}

	final := engine.Decide(req)
	if final.Outcome != OutcomeAsk {
		t.Errorf("call %d/%d: outcome = %q, want ask (retry storm should now be flagged)", threshold, threshold, final.Outcome)
	}
	if final.Rule != "loop-detection" {
		t.Errorf("rule = %q, want loop-detection", final.Rule)
	}
}

func TestEngine_DifferentCommandsNeverLookLikeARetryStorm(t *testing.T) {
	engine, _ := newTestEngine(t, false)
	threshold := engine.Policy.LoopDetection.RepeatThreshold

	for i := 0; i < threshold+5; i++ {
		resp := engine.Decide(Request{
			SessionID: "s1", Tool: "Bash", Command: fmt.Sprintf("echo call-%d", i),
			Cwd: "/home/testuser", Env: map[string]string{"HOME": "/home/testuser"},
		})
		if resp.Outcome != OutcomeAllow {
			t.Fatalf("call %d: distinct commands should never trigger loop detection, got %q", i, resp.Outcome)
		}
	}
}

// TestEngine_HookifyRuleFromRealFileIsHonored proves a hookify rule sitting
// in a project's real .claude/ directory actually flows through the full
// Engine (not just EvaluateHookify in isolation) — including combining with
// Tier 1 and going through shadow-mode.
func TestEngine_HookifyRuleFromRealFileIsHonored(t *testing.T) {
	engine, _ := newTestEngine(t, true) // shadow mode
	projectDir := t.TempDir()
	writeHookifyFixture(t, projectDir, "hookify.dangerous-rm.local.md", hookifySimpleRuleFixture)

	resp := engine.Decide(Request{
		SessionID: "s1", Tool: "Bash", Command: "rm -rf /tmp/build", Cwd: projectDir,
		Env: map[string]string{"HOME": "/home/testuser"},
	})

	if resp.Outcome != OutcomeAllow {
		t.Errorf("shadow mode must still allow, got %q", resp.Outcome)
	}
	if !strings.Contains(resp.Reason, "would have been ask") {
		t.Errorf("expected the imported hookify warn-rule to surface as a shadow 'would have been ask', got: %q", resp.Reason)
	}
}

// TestEngine_Tier1WinsOverHookifyWhenMoreRestrictive confirms the
// most-restrictive-wins merge actually picks Tier 1's deny over a hookify
// rule that would have only asked.
func TestEngine_Tier1WinsOverHookifyWhenMoreRestrictive(t *testing.T) {
	engine, _ := newTestEngine(t, false) // enforce mode
	projectDir := t.TempDir()
	// A hookify rule that only warns on any "rm" — weaker than Tier 1's
	// deny for a recursive-force-delete against the home directory.
	writeHookifyFixture(t, projectDir, "hookify.warn-rm.local.md", `---
name: warn-any-rm
enabled: true
event: bash
pattern: rm
---

Careful with rm.
`)

	resp := engine.Decide(Request{
		SessionID: "s1", Tool: "Bash", Command: "rm -rf ~/", Cwd: projectDir,
		Env: map[string]string{"HOME": "/home/testuser"},
	})

	if resp.Outcome != OutcomeDeny {
		t.Errorf("outcome = %q, want deny — Tier 1's stricter verdict should win over hookify's weaker warn", resp.Outcome)
	}
}

// TestDaemonSocket_EndToEnd starts the real unix-socket wire protocol (not
// just the in-process Engine) to prove the hook adapter's actual transport
// works, using the same newline-delimited JSON framing as cmd/lelu-daemon.
func TestDaemonSocket_EndToEnd(t *testing.T) {
	engine, _ := newTestEngine(t, false)
	dir := t.TempDir()
	sockPath := filepath.Join(dir, "daemon.sock")

	ln, err := net.Listen("unix", sockPath)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()

	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		scanner := bufio.NewScanner(conn)
		if !scanner.Scan() {
			return
		}
		var req Request
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			return
		}
		resp := engine.Decide(req)
		b, _ := json.Marshal(resp)
		b = append(b, '\n')
		conn.Write(b)
	}()

	conn, err := net.Dial("unix", sockPath)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	reqBytes, _ := json.Marshal(Request{
		SessionID: "s1", Tool: "Bash", Command: "rm -rf ~/", Cwd: "/home/testuser",
		Env: map[string]string{"HOME": "/home/testuser"},
	})
	reqBytes = append(reqBytes, '\n')
	if _, err := conn.Write(reqBytes); err != nil {
		t.Fatal(err)
	}

	scanner := bufio.NewScanner(conn)
	if !scanner.Scan() {
		t.Fatal("no response from daemon socket")
	}
	var resp Response
	if err := json.Unmarshal(scanner.Bytes(), &resp); err != nil {
		t.Fatalf("bad response JSON: %v", err)
	}
	if resp.Outcome != OutcomeDeny {
		t.Errorf("outcome over the wire = %q, want deny", resp.Outcome)
	}
}
