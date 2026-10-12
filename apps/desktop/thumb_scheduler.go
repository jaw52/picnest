package main

import (
	"errors"
	"slices"
	"sync"
)

// The frontend matches this exact string to ignore a request it gave up on.
const thumbCancelledError = "thumbnail-cancelled"

var errThumbCancelled = errors.New(thumbCancelledError)

// thumbScheduler bounds concurrent thumbnail decodes and decides who runs
// next when a slot frees up. Foreground requests (a tile the user is looking
// at) run newest-first, so tiles scrolled past don't delay the ones on
// screen; background prefetch runs oldest-first and only when no foreground
// request is waiting. A waiting request can be cancelled by its id, e.g. when
// its tile unmounts; one that already holds a slot runs to completion.
type thumbScheduler struct {
	mu         sync.Mutex
	free       int
	foreground []*thumbWaiter // stack: newest last
	background []*thumbWaiter // queue: oldest first
	waiting    map[string]*thumbWaiter
}

type thumbWaiter struct {
	id        string
	granted   chan struct{}
	cancelled chan struct{}
}

func newThumbScheduler(slots int) *thumbScheduler {
	return &thumbScheduler{free: slots, waiting: make(map[string]*thumbWaiter)}
}

// acquire blocks until a slot is available and returns its release func, or
// returns errThumbCancelled if cancel(id) is called while it waits. An empty
// id can't be cancelled.
func (s *thumbScheduler) acquire(background bool, id string) (func(), error) {
	s.mu.Lock()
	if s.free > 0 {
		s.free--
		s.mu.Unlock()
		return s.release, nil
	}
	w := &thumbWaiter{id: id, granted: make(chan struct{}), cancelled: make(chan struct{})}
	if background {
		s.background = append(s.background, w)
	} else {
		s.foreground = append(s.foreground, w)
	}
	if id != "" {
		s.waiting[id] = w
	}
	s.mu.Unlock()

	select {
	case <-w.granted:
		return s.release, nil
	case <-w.cancelled:
		return nil, errThumbCancelled
	}
}

// cancel drops a still-waiting request. Unknown or already-granted ids are
// ignored.
func (s *thumbScheduler) cancel(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	w, ok := s.waiting[id]
	if !ok {
		return
	}
	delete(s.waiting, id)
	remove := func(q []*thumbWaiter) []*thumbWaiter {
		return slices.DeleteFunc(q, func(x *thumbWaiter) bool { return x == w })
	}
	s.foreground = remove(s.foreground)
	s.background = remove(s.background)
	close(w.cancelled)
}

func (s *thumbScheduler) release() {
	s.mu.Lock()
	defer s.mu.Unlock()
	var next *thumbWaiter
	switch {
	case len(s.foreground) > 0:
		last := len(s.foreground) - 1
		next, s.foreground = s.foreground[last], s.foreground[:last]
	case len(s.background) > 0:
		next, s.background = s.background[0], s.background[1:]
	default:
		s.free++
		return
	}
	if next.id != "" {
		delete(s.waiting, next.id)
	}
	// The slot transfers directly to the waiter, so free stays unchanged.
	close(next.granted)
}
