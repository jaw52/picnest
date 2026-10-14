package main

import (
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func writePNG(t *testing.T, path string, w, h int) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if err := png.Encode(f, image.NewRGBA(image.Rect(0, 0, w, h))); err != nil {
		t.Fatal(err)
	}
}

func TestScanFolderReadsDimensionsAndJoinsRatings(t *testing.T) {
	dir := t.TempDir()
	writePNG(t, filepath.Join(dir, "a.png"), 20, 10)
	writePNG(t, filepath.Join(dir, "b.png"), 4, 4)
	writePNG(t, filepath.Join(dir, "c.png"), 4, 4)
	os.WriteFile(filepath.Join(dir, "notes.txt"), []byte("hi"), 0o644)

	db, err := openRatingsDB(dir)
	if err != nil {
		t.Fatal(err)
	}
	setRating(db, "a.png", 5)
	db.Close()

	page, err := scanFolderPage(dir, 0, 100)
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 3 || page.Photos[0].Width != 20 || page.Photos[0].Height != 10 || page.Photos[0].Rating != 5 {
		t.Fatalf("unexpected page: %+v", page)
	}

	page, _ = scanFolderPage(dir, 1, 1)
	if page.Total != 3 || len(page.Photos) != 1 || page.Photos[0].FileName != "b.png" {
		t.Fatalf("unexpected slice: %+v", page)
	}
}

// A sparse file reads as a placeholder but has no cloud thumbnail, so it
// falls back to a neutral aspect ratio and no thumbnail.
func TestCloudPlaceholderWithoutCloudThumbnail(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "placeholder.jpg")
	f, _ := os.Create(path)
	f.Truncate(5_000_000)
	f.Close()

	page, err := scanFolderPage(dir, 0, 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Photos) != 1 || !page.Photos[0].IsCloudPlaceholder || page.Photos[0].Width != 1 {
		t.Fatalf("unexpected page: %+v", page)
	}
	if _, err := ensureThumbnail(dir, path, 480); err == nil {
		t.Fatal("expected no thumbnail")
	}
}

func TestThumbnailIsScaledAndCached(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "big.jpg")
	f, _ := os.Create(src)
	jpeg.Encode(f, image.NewRGBA(image.Rect(0, 0, 4000, 3000)), nil)
	f.Close()

	thumb, err := ensureThumbnail(dir, src, 480)
	if err != nil {
		t.Fatal(err)
	}
	w, h, err := imageDimensions(thumb)
	if err != nil || w != 480 || h != 360 {
		t.Fatalf("thumbnail %dx%d err=%v", w, h, err)
	}
	again, _ := ensureThumbnail(dir, src, 480)
	if again != thumb {
		t.Fatal("expected cached thumbnail path")
	}
}

func TestMoveAndRenameCarryRecords(t *testing.T) {
	src, dest := t.TempDir(), t.TempDir()
	writePNG(t, filepath.Join(src, "a.png"), 2, 2)
	writePNG(t, filepath.Join(src, "b.png"), 2, 2)
	app := NewApp()
	app.SetRating(src, "a.png", 4)
	app.SetRating(src, "b.png", 2)

	if err := app.RenamePhoto(src, "b.png", "c.png"); err != nil {
		t.Fatal(err)
	}
	if err := app.MovePhotos(src, []string{"a.png"}, dest); err != nil {
		t.Fatal(err)
	}
	srcDB, _ := openRatingsDB(src)
	defer srcDB.Close()
	destDB, _ := openRatingsDB(dest)
	defer destDB.Close()
	srcRatings, _ := getAllRatings(srcDB)
	destRatings, _ := getAllRatings(destDB)
	if srcRatings["c.png"] != 2 || srcRatings["a.png"] != 0 || destRatings["a.png"] != 4 {
		t.Fatalf("src=%v dest=%v", srcRatings, destRatings)
	}
}

func TestListSubfoldersHidesImagelessAndHiddenFolders(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "empty"), 0o755)
	os.MkdirAll(filepath.Join(dir, ".hidden"), 0o755)
	writePNG(t, filepath.Join(dir, ".hidden", "a.png"), 2, 2)
	os.MkdirAll(filepath.Join(dir, "nested", "child"), 0o755)
	writePNG(t, filepath.Join(dir, "nested", "child", "a.png"), 2, 2)

	entries, err := listSubfolders(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].Name != "nested" {
		t.Fatalf("unexpected entries: %+v", entries)
	}
}
