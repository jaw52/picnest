package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func touch(t *testing.T, path string, age time.Duration) {
	t.Helper()
	if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	when := time.Now().Add(-age)
	os.Chtimes(path, when, when)
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func TestPruneThumbnails(t *testing.T) {
	dir := t.TempDir()
	live := fileStat{path: "/p/a.jpg", size: 10, modTime: 5}
	liveKey := thumbKey(live.path, live.modTime, live.size)
	goneKey := thumbKey("/p/gone.jpg", 1, 1)
	newKey := thumbKey("/p/new.jpg", 1, 1)

	small := filepath.Join(dir, thumbFileName(liveKey, 512))
	big := filepath.Join(dir, thumbFileName(liveKey, 2048))
	huge := filepath.Join(dir, thumbFileName(liveKey, 4096)) // supersedes 2048 (within 4x); too big to stand in for 512
	orphan := filepath.Join(dir, thumbFileName(goneKey, 512))
	fresh := filepath.Join(dir, thumbFileName(newKey, 512))
	legacy := filepath.Join(dir, "deadbeef.jpg")
	staleTmp := filepath.Join(dir, thumbFileName(liveKey, 512)+".tmp1-1")
	for _, p := range []string{small, big, huge, orphan, legacy, staleTmp} {
		touch(t, p, 2*time.Hour)
	}
	touch(t, fresh, 0)

	pruneThumbnails(dir, []fileStat{live})

	for path, want := range map[string]bool{
		small: false, big: false, huge: true, orphan: false,
		fresh: true, legacy: false, staleTmp: false,
	} {
		if exists(path) != want {
			t.Errorf("%s exists=%v, want %v", filepath.Base(path), !want, want)
		}
	}
}

func TestThumbnailReusesLargerCachedSize(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "big.jpg")
	writePNG(t, src, 4000, 3000)

	large, err := ensureThumbnail(dir, src, 1024)
	if err != nil {
		t.Fatal(err)
	}
	if got, _ := ensureThumbnail(dir, src, 512); got != large {
		t.Fatalf("512 request got %s, want reuse of %s", got, large)
	}
	if got, _ := ensureThumbnail(dir, src, 2048); got == large {
		t.Fatal("2048 request must not reuse a smaller thumbnail")
	}
}

func TestThumbnailWaitsForPrune(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "a.jpg")
	writePNG(t, src, 800, 600)

	// Simulate a prune still running for this folder.
	done := make(chan struct{})
	prunedFolders.Store(dir, done)
	t.Cleanup(func() { prunedFolders.Delete(dir) })

	got := make(chan error, 1)
	go func() {
		_, err := ensureThumbnail(dir, src, 512)
		got <- err
	}()
	select {
	case <-got:
		t.Fatal("thumbnail resolved before the prune finished")
	case <-time.After(50 * time.Millisecond):
	}
	close(done)
	if err := <-got; err != nil {
		t.Fatal(err)
	}
}
