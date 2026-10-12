package main

import (
	"testing"
	"time"
)

func TestSchedulerRunsForegroundNewestFirstThenBackground(t *testing.T) {
	s := newThumbScheduler(1)
	releaseFirst, _ := s.acquire(false, "") // occupies the only slot

	order := make(chan string, 4)
	waiter := func(name string, background bool) {
		go func() {
			release, _ := s.acquire(background, "")
			order <- name
			release()
		}()
		time.Sleep(20 * time.Millisecond) // fix enqueue order
	}
	waiter("bg1", true)
	waiter("fg1", false)
	waiter("fg2", false)
	waiter("bg2", true)

	releaseFirst()
	var got []string
	for range 4 {
		select {
		case n := <-order:
			got = append(got, n)
		case <-time.After(time.Second):
			t.Fatalf("timed out, got %v", got)
		}
	}
	want := []string{"fg2", "fg1", "bg1", "bg2"}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("order = %v, want %v", got, want)
		}
	}
}

func TestSchedulerCancelDropsWaitingRequest(t *testing.T) {
	s := newThumbScheduler(1)
	releaseFirst, _ := s.acquire(false, "")

	results := make(chan error, 2)
	for _, id := range []string{"keep", "drop"} {
		go func() {
			release, err := s.acquire(false, id)
			if err == nil {
				release()
			}
			results <- err
		}()
		time.Sleep(20 * time.Millisecond)
	}

	s.cancel("drop")
	if err := <-results; err != errThumbCancelled {
		t.Fatalf("cancelled request returned %v, want errThumbCancelled", err)
	}
	s.cancel("unknown") // ignored

	releaseFirst()
	if err := <-results; err != nil {
		t.Fatalf("kept request returned %v", err)
	}
	if s.free != 1 || len(s.waiting) != 0 {
		t.Fatalf("free=%d waiting=%d, want 1 and 0", s.free, len(s.waiting))
	}
}
