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
	liveKey := thumbKey(live.path, live.modTime, live.size, false)
	goneKey := thumbKey("/p/gone.jpg", 1, 1, false)
	newKey := thumbKey("/p/new.jpg", 1, 1, false)

	// Each superseded by the next size up, within 1.5x; 1024 and 2048 are
	// too far apart for either to stand in for the other.
	small := filepath.Join(dir, thumbFileName(liveKey, 512))
	mid := filepath.Join(dir, thumbFileName(liveKey, 768))
	big := filepath.Join(dir, thumbFileName(liveKey, 1024))
	huge := filepath.Join(dir, thumbFileName(liveKey, 2048))
	orphan := filepath.Join(dir, thumbFileName(goneKey, 512))
	fresh := filepath.Join(dir, thumbFileName(newKey, 512))
	legacy := filepath.Join(dir, "deadbeef.jpg")
	staleTmp := filepath.Join(dir, thumbFileName(liveKey, 512)+".tmp1-1")
	for _, p := range []string{small, mid, big, huge, orphan, legacy, staleTmp} {
		touch(t, p, 2*time.Hour)
	}
	touch(t, fresh, 0)

	pruneThumbnails(dir, []fileStat{live})

	for path, want := range map[string]bool{
		small: false, mid: false, big: true, huge: true, orphan: false,
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

	large, err := ensureThumbnail(dir, src, 768)
	if err != nil {
		t.Fatal(err)
	}
	if got, _ := ensureThumbnail(dir, src, 512); got != large {
		t.Fatalf("512 request got %s, want reuse of %s", got, large)
	}
	if got, _ := ensureThumbnail(dir, src, 1024); got == large {
		t.Fatal("1024 request must not reuse a smaller thumbnail")
	}
}

func TestThumbnailSkipsMuchLargerCachedSize(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "big.jpg")
	writePNG(t, src, 4000, 3000)

	// A web view decodes a picture whole: a 2048px thumbnail in a tile that
	// needs 512 takes 16 times the memory.
	huge, err := ensureThumbnail(dir, src, 2048)
	if err != nil {
		t.Fatal(err)
	}
	if got, _ := ensureThumbnail(dir, src, 512); got == huge {
		t.Fatal("512 request must not reuse a 2048 thumbnail")
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
