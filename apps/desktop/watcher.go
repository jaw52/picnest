package main

import (
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/rjeczalik/notify"
)

// A single filesystem operation (e.g. copying in 50 photos) fires many raw
// events; waiting this long after the last one collapses a burst into a
// single frontend refresh.
const watchDebounce = 600 * time.Millisecond

// watch is one active FSEvents subscription whose relevant events are
// debounced into calls to emit.
type watch struct {
	events chan notify.EventInfo
	done   chan struct{}
}

func startWatch(root string, emit func()) (*watch, error) {
	w := &watch{events: make(chan notify.EventInfo, 256), done: make(chan struct{})}
	if err := notify.Watch(root, w.events, notify.All); err != nil {
		return nil, err
	}
	go func() {
		var timer *time.Timer
		for {
			select {
			case <-w.done:
				if timer != nil {
					timer.Stop()
				}
				return
			case ev := <-w.events:
				if !isRelevantPath(root, ev.Path()) {
					continue
				}
				if timer != nil {
					timer.Stop()
				}
				timer = time.AfterFunc(watchDebounce, emit)
			}
		}
	}()
	return w, nil
}

func (w *watch) stop() {
	notify.Stop(w.events)
	close(w.done)
}

// isRelevantPath ignores anything under a dot-prefixed path component below
// root: our own .picnest sidecar (thumbnails, database) and the user's hidden
// files.
func isRelevantPath(root, path string) bool {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return true
	}
	for _, part := range strings.Split(rel, string(filepath.Separator)) {
		if strings.HasPrefix(part, ".") && part != "." && part != ".." {
			return false
		}
	}
	return true
}

// folderWatcher holds at most one non-recursive watch on the open folder.
type folderWatcher struct {
	mu      sync.Mutex
	current *watch
}

func (fw *folderWatcher) watch(folder string, emit func()) error {
	fw.mu.Lock()
	defer fw.mu.Unlock()
	if fw.current != nil {
		fw.current.stop()
		fw.current = nil
	}
	w, err := startWatch(folder, emit)
	if err != nil {
		return err
	}
	fw.current = w
	return nil
}

func (fw *folderWatcher) unwatch() {
	fw.mu.Lock()
	defer fw.mu.Unlock()
	if fw.current != nil {
		fw.current.stop()
		fw.current = nil
	}
}
