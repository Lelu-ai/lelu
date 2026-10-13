package queue

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func openTestDB(t *testing.T, path string) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", path+"?_journal_mode=WAL")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

// Reviews must survive an engine restart without Redis: resolved items keep
// their note, pending ones stay listed, and a spent approval stays spent.
func TestSQLiteQueue_SurvivesRestart(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "lelu.db")

	q1, err := NewSQLite(openTestDB(t, path))
	if err != nil {
		t.Fatal(err)
	}
	resolvedID, err := q1.Enqueue(ctx, "", "agent", "send_email", nil, 0.9, "needs sign-off", "", "fp-1")
	if err != nil {
		t.Fatal(err)
	}
	pendingID, err := q1.Enqueue(ctx, "", "agent", "send_invoice", nil, 0.9, "needs sign-off", "", "fp-2")
	if err != nil {
		t.Fatal(err)
	}
	if err := q1.Approve(ctx, resolvedID, "alice", "ok for tonight"); err != nil {
		t.Fatal(err)
	}
	if res, err := q1.Redeem(ctx, resolvedID, "fp-1", time.Hour); err != nil || !res.Allowed {
		t.Fatalf("first redeem: %+v %v", res, err)
	}

	// "Restart": a fresh queue over a fresh connection to the same file.
	q2, err := NewSQLite(openTestDB(t, path))
	if err != nil {
		t.Fatal(err)
	}
	got, err := q2.Get(ctx, resolvedID)
	if err != nil {
		t.Fatalf("resolved review lost on restart: %v", err)
	}
	if got.Status != StatusApproved || got.ResolvedBy != "alice" || got.ResolutionNote != "ok for tonight" {
		t.Errorf("resolved review not restored intact: %+v", got)
	}
	if res, _ := q2.Redeem(ctx, resolvedID, "fp-1", time.Hour); res.Allowed {
		t.Error("an approval redeemed before the restart must stay spent after it")
	}
	page, err := q2.ListPendingPage(ctx, 50, 0)
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 1 || len(page.Items) != 1 || page.Items[0].ID != pendingID {
		t.Errorf("pending review not restored: %+v", page)
	}
	if err := q2.Deny(ctx, pendingID, "bob", "no"); err != nil {
		t.Errorf("pending review restored but not resolvable: %v", err)
	}
}

func TestSQLiteQueue_DropsResolvedPastRetention(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "lelu.db")
	db := openTestDB(t, path)
	q1, err := NewSQLite(db)
	if err != nil {
		t.Fatal(err)
	}
	id, _ := q1.Enqueue(ctx, "", "agent", "send_email", nil, 0.9, "r", "", "fp")
	if err := q1.Deny(ctx, id, "alice", ""); err != nil {
		t.Fatal(err)
	}
	// Age the stored resolution past retention.
	q1.inmem.mu.Lock()
	old := time.Now().Add(-ResolvedRetention - time.Hour)
	q1.inmem.items[id].ResolvedAt = &old
	if err := q1.inmem.persist(q1.inmem.items[id]); err != nil {
		t.Fatal(err)
	}
	q1.inmem.mu.Unlock()

	q2, err := NewSQLite(openTestDB(t, path))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := q2.Get(ctx, id); err == nil {
		t.Error("a review resolved past ResolvedRetention should be pruned on load")
	}
}
