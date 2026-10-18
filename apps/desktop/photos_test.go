package main

import (
	"database/sql"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"testing"
	"time"
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

func TestScanPagesShareTheFirstPagesListing(t *testing.T) {
	dir := t.TempDir()
	writePNG(t, filepath.Join(dir, "a.png"), 4, 4)
	writePNG(t, filepath.Join(dir, "b.png"), 4, 4)
	writePNG(t, filepath.Join(dir, "c.png"), 8, 2)

	first, err := scanFolderPage(dir, 0, 1)
	if err != nil {
		t.Fatal(err)
	}
	// A file added mid-scan waits for the next scan, so the pages keep to
	// the total and order the first one gave.
	writePNG(t, filepath.Join(dir, "ab.png"), 4, 4)
	second, _ := scanFolderPage(dir, 1, 1)
	last, _ := scanFolderPage(dir, 2, 1)
	if first.Total != 3 || second.Total != 3 || second.Photos[0].FileName != "b.png" ||
		last.Total != 3 || last.Photos[0].FileName != "c.png" || last.Photos[0].Width != 8 {
		t.Fatalf("pages = %+v, %+v, %+v", first, second, last)
	}

	again, _ := scanFolderPage(dir, 0, 10)
	if again.Total != 4 || again.Photos[1].FileName != "ab.png" {
		t.Fatalf("next scan = %+v, want the added file in it", again)
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

func TestExifTime(t *testing.T) {
	want := time.Date(2024, 5, 1, 12, 34, 56, 0, time.Local).Unix()
	if got := exifTime("2024:05:01 12:34:56"); got != want {
		t.Errorf("exifTime = %d, want %d", got, want)
	}
	for _, date := range []string{"", "0000:00:00 00:00:00", "2024-05-01"} {
		if got := exifTime(date); got != 0 {
			t.Errorf("exifTime(%q) = %d, want 0", date, got)
		}
	}
}

func TestClearPhotoCacheKeepsRatings(t *testing.T) {
	t.Setenv("HOME", t.TempDir()) // keeps the library's and collect folder's sidecars out of it
	root := t.TempDir()
	sub := filepath.Join(root, "sub")
	if err := os.Mkdir(sub, 0o755); err != nil {
		t.Fatal(err)
	}
	db, err := openRatingsDB(sub)
	if err != nil {
		t.Fatal(err)
	}
	if err := setRating(db, "a.jpg", 3); err != nil {
		t.Fatal(err)
	}
	if err := upsertPhotoMetaBatch(db, []photoMetaUpdate{{"a.jpg", cachedPhotoMeta{1, 1, 0, 1, 1}}}); err != nil {
		t.Fatal(err)
	}
	db.Close()
	thumbs := filepath.Join(sidecarDir(sub), "thumbs")
	if err := os.MkdirAll(thumbs, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(thumbs, "k_256.jpg"), make([]byte, 1000), 0o644); err != nil {
		t.Fatal(err)
	}

	if size := photoCacheSize([]string{root}); size <= 1000 {
		t.Errorf("photoCacheSize = %d, want the thumbnail and photo_meta", size)
	}
	var last CacheClearProgress
	if err := clearPhotoCache([]string{root}, func(p CacheClearProgress) { last = p }); err != nil {
		t.Fatal(err)
	}
	if last != (CacheClearProgress{2, 2}) { // the thumbnail, then the table
		t.Errorf("last progress = %+v, want 2 of 2", last)
	}
	if size := photoCacheSize([]string{root}); size != 0 {
		t.Errorf("photoCacheSize after clearing = %d, want 0", size)
	}
	if _, err := os.Stat(thumbs); !os.IsNotExist(err) {
		t.Errorf("thumbnails still there")
	}

	if _, err := os.Stat(filepath.Join(root, sidecarDirName)); !os.IsNotExist(err) {
		t.Errorf("created a sidecar in %s", root)
	}
	db, err = sql.Open("sqlite", "file:"+ratingsDBPath(sub))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var tables int
	if err := db.QueryRow("SELECT count(*) FROM sqlite_master WHERE name = 'photo_meta'").Scan(&tables); err != nil || tables != 0 {
		t.Errorf("photo_meta still there (%d, %v)", tables, err)
	}
	ratings, err := getAllRatings(db)
	if err != nil || ratings["a.jpg"] != 3 {
		t.Errorf("ratings = %v, %v; want a.jpg rated 3", ratings, err)
	}
}
