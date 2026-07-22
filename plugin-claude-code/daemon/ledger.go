package daemon

import (
	"encoding/json"
	"os"
	"sync"
	"time"
)

// LedgerEntry is one recorded decision, written regardless of shadow/enforce
// mode — shadow mode controls what Claude Code is TOLD, not what gets logged.
type LedgerEntry struct {
	Timestamp string  `json:"ts"`
	SessionID string  `json:"session_id"`
	Tool      string  `json:"tool"`
	Command   string  `json:"command,omitempty"`
	FilePath  string  `json:"file_path,omitempty"`
	Cwd       string  `json:"cwd,omitempty"`
	Outcome   Outcome `json:"outcome"`
	Rule      string  `json:"rule,omitempty"`
	Reason    string  `json:"reason,omitempty"`
	Shadow    bool    `json:"shadow"`
}

// Ledger is an append-only JSONL audit trail. One process, one writer, so a
// simple mutex is enough — no database server, no CGO, trivially portable.
type Ledger struct {
	mu   sync.Mutex
	file *os.File
}

func OpenLedger(path string) (*Ledger, error) {
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return nil, err
	}
	return &Ledger{file: f}, nil
}

func (l *Ledger) Record(e LedgerEntry) error {
	if e.Timestamp == "" {
		e.Timestamp = time.Now().UTC().Format(time.RFC3339Nano)
	}
	l.mu.Lock()
	defer l.mu.Unlock()

	data, err := json.Marshal(e)
	if err != nil {
		return err
	}
	data = append(data, '\n')
	_, err = l.file.Write(data)
	return err
}

func (l *Ledger) Close() error {
	return l.file.Close()
}
