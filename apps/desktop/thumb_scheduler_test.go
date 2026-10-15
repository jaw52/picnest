package main

import (
	"testing"
	"time"
)

func TestSchedulerRunsForegroundNewestFirstThenBackground(t *testing.T) {
	s := newThumbScheduler(1, 1)
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
	s := newThumbScheduler(1, 1)
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
	if s.free != 1 || s.bgFree != 1 || len(s.waiting) != 0 {
		t.Fatalf("free=%d waiting=%d, want 1 and 0", s.free, len(s.waiting))
	}
}

func TestSchedulerKeepsBackgroundToItsSlots(t *testing.T) {
	s := newThumbScheduler(3, 1)
	releaseBg, _ := s.acquire(true, "")

	// A second background request waits although slots are free...
	granted := make(chan func(), 1)
	go func() {
		release, _ := s.acquire(true, "")
		granted <- release
	}()
	select {
	case <-granted:
		t.Fatal("second background request ran past the background limit")
	case <-time.After(50 * time.Millisecond):
	}

	// ...while foreground requests take them.
	releaseFg1, _ := s.acquire(false, "")
	releaseFg2, _ := s.acquire(false, "")
	if s.free != 0 {
		t.Fatalf("free = %d, want 0", s.free)
	}

	// A foreground slot freeing up isn't one background may use.
	releaseFg1()
	select {
	case <-granted:
		t.Fatal("background request took a foreground slot")
	case <-time.After(50 * time.Millisecond):
	}

	// The background slot freeing up passes to the waiting request.
	releaseBg()
	select {
	case release := <-granted:
		release()
	case <-time.After(time.Second):
		t.Fatal("waiting background request never ran")
	}
	releaseFg2()
	if s.free != 3 || s.bgFree != 1 {
		t.Fatalf("free=%d bgFree=%d, want 3 and 1", s.free, s.bgFree)
	}
}
