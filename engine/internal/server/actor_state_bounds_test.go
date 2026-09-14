package server

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestActorStatsDistinctActorsStayBounded(t *testing.T) {
	stats := newActorStatsWithCapacity(8, 4)

	for i := 0; i < 100; i++ {
		outcome := outcomeAllow
		if i%3 == 0 {
			outcome = outcomeDeny
		}

		stats.record(fmt.Sprintf("actor-%d", i), outcome)
	}

	if got := len(stats.entries); got > 8 {
		t.Fatalf("hot actor cache size = %d, want <= 8", got)
	}

	if got := len(stats.trusted); got > 4 {
		t.Fatalf("trusted actor cache size = %d, want <= 4", got)
	}
}

func TestActorStatsEvictedBadActorDoesNotResetToOne(t *testing.T) {
	stats := newActorStatsWithCapacity(2, 2)

	stats.record("bad", outcomeDeny)
	stats.record("other-bad", outcomeDeny)

	// With no clean eviction candidate, fall back to evicting the true oldest
	// entry. The evicted bad actor must still not regain reliability 1.0.
	stats.record("incoming", outcomeDeny)

	if _, ok := stats.entries[actorKey("bad")]; ok {
		t.Fatal("bad actor unexpectedly remained in hot cache")
	}

	if got := stats.reliability("bad"); got != conservativeUnknownReliability {
		t.Fatalf(
			"evicted bad actor reliability = %.3f, want %.3f",
			got,
			conservativeUnknownReliability,
		)
	}

	// One successful request after eviction must not immediately restore 1.0.
	stats.record("bad", outcomeAllow)

	got := stats.reliability("bad")
	want := 2.0 / 3.0

	if math.Abs(got-want) > 1e-9 {
		t.Fatalf(
			"returned bad actor reliability = %.6f, want %.6f",
			got,
			want,
		)
	}

	if got == 1.0 {
		t.Fatal("evicted bad actor silently reset to reliability 1.0")
	}
}

func TestActorStatsPrefersEvictingCleanEntry(t *testing.T) {
	stats := newActorStatsWithCapacity(3, 3)

	stats.record("bad-oldest", outcomeDeny)
	stats.record("clean", outcomeAllow)
	stats.record("bad-newest", outcomeDeny)

	// The true LRU entry is bad-oldest, but a clean entry exists within the
	// bounded scan, so the clean entry should be evicted instead.
	stats.record("incoming", outcomeDeny)

	if _, ok := stats.entries[actorKey("bad-oldest")]; !ok {
		t.Fatal("bad oldest actor was evicted despite a clean candidate")
	}

	cleanKey := actorKey("clean")

	if _, ok := stats.entries[cleanKey]; ok {
		t.Fatal("clean actor unexpectedly remained in hot cache")
	}

	if _, ok := stats.trusted[cleanKey]; !ok {
		t.Fatal("evicted clean actor was not retained in trusted cache")
	}
}

func TestActorStatsCleanEvictionRetainsTrustedState(t *testing.T) {
	stats := newActorStatsWithCapacity(2, 2)

	stats.record("trusted", outcomeAllow)
	stats.record("other-a", outcomeAllow)

	// Evict the oldest clean actor.
	stats.record("other-b", outcomeAllow)

	key := actorKey("trusted")

	if _, ok := stats.trusted[key]; !ok {
		t.Fatal("clean evicted actor was not retained in trusted cache")
	}

	if got := stats.reliability("trusted"); got != 1.0 {
		t.Fatalf(
			"trusted evicted actor reliability = %.3f, want 1.0",
			got,
		)
	}

	// Becoming active again must consume the cold trusted marker.
	stats.record("trusted", outcomeAllow)

	if _, ok := stats.trusted[key]; ok {
		t.Fatal("trusted marker remained after actor became active")
	}
}

func TestActorStatsNewActorKeepsExistingDefaultBeforePressure(t *testing.T) {
	stats := newActorStatsWithCapacity(4, 4)

	if got := stats.reliability("brand-new"); got != 1.0 {
		t.Fatalf(
			"brand-new actor reliability = %.3f, want existing default 1.0",
			got,
		)
	}
}

func TestAnomalyTrackerCurrentCountMissDoesNotCreateBucket(t *testing.T) {
	tracker := newAnomalyTrackerWithCapacity(
		5,
		time.Minute,
		4,
	)

	if got := tracker.currentCount("never-seen"); got != 0 {
		t.Fatalf("unseen actor count = %d, want 0", got)
	}

	if _, ok := tracker.buckets[actorKey("never-seen")]; ok {
		t.Fatal("currentCount created an empty bucket for unseen actor")
	}
}

func TestAnomalyTrackerPrunesEmptyBucketKey(t *testing.T) {
	tracker := newAnomalyTrackerWithCapacity(
		5,
		time.Minute,
		4,
	)

	key := actorKey("old")

	tracker.buckets[key] = []time.Time{
		time.Now().Add(-2 * time.Minute),
	}

	if got := tracker.currentCount("old"); got != 0 {
		t.Fatalf("expired actor count = %d, want 0", got)
	}

	if _, ok := tracker.buckets[key]; ok {
		t.Fatal("expired anomaly bucket key was not removed")
	}
}

func TestAnomalyTrackerDistinctActorsStayBounded(t *testing.T) {
	tracker := newAnomalyTrackerWithCapacity(
		5,
		time.Hour,
		8,
	)

	for i := 0; i < 100; i++ {
		tracker.record(fmt.Sprintf("actor-%d", i))
	}

	if got := len(tracker.buckets); got > 8 {
		t.Fatalf("anomaly bucket size = %d, want <= 8", got)
	}

	if got := tracker.currentCount("overflow"); got != tracker.threshold {
		t.Fatalf(
			"overflow actor anomaly count = %d, want conservative %d",
			got,
			tracker.threshold,
		)
	}

	if _, ok := tracker.buckets[actorKey("overflow")]; ok {
		t.Fatal("overflow actor unexpectedly created a bucket")
	}
}

func TestAnomalyTrackerPerActorHistoryStaysBounded(t *testing.T) {
	tracker := newAnomalyTrackerWithCapacity(
		5,
		time.Hour,
		8,
	)

	for i := 0; i < 100; i++ {
		tracker.record("same-actor")
	}

	key := actorKey("same-actor")

	if got := len(tracker.buckets[key]); got > tracker.threshold {
		t.Fatalf(
			"timestamp history size = %d, want <= threshold %d",
			got,
			tracker.threshold,
		)
	}
}
