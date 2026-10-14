package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestTrashItemAndRestore(t *testing.T) {
	// The trash is per-user and per-volume; keep the probe in the home
	// volume so it lands in ~/.Trash like a real photo would.
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skip(err)
	}
	dir, err := os.MkdirTemp(home, ".picnest-trash-test-")
	if err != nil {
		t.Skip(err)
	}
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, "probe.jpg")
	if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	app := NewApp()
	if err := app.SetRating(dir, "probe.jpg", 4); err != nil {
		t.Fatal(err)
	}
	result, err := app.DeletePhotos(dir, []string{path})
	if err != nil || len(result.Failures) > 0 || len(result.Trashed) != 1 {
		t.Fatalf("delete: %+v, %v", result, err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("file still in place: %v", err)
	}
	if _, err := os.Stat(result.Trashed[0].TrashPath); err != nil {
		t.Fatalf("trashed file not found at %q: %v", result.Trashed[0].TrashPath, err)
	}
	if result.Trashed[0].Rating != 4 {
		t.Fatalf("rating not carried: %d", result.Trashed[0].Rating)
	}
	if err := app.RestorePhotos(dir, result.Trashed); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("not restored: %v", err)
	}
	db, err := openRatingsDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ratings, err := getAllRatings(db)
	if err != nil || ratings["probe.jpg"] != 4 {
		t.Fatalf("rating not restored: %v, %v", ratings, err)
	}
}
