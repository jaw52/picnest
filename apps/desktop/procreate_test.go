package main

import (
	"archive/zip"
	"image"
	"image/png"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
)

func writeProcreate(t *testing.T, path string, w, h int) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	zw := zip.NewWriter(f)
	entry, err := zw.Create(procreatePreviewName)
	if err != nil {
		t.Fatal(err)
	}
	if err := png.Encode(entry, image.NewRGBA(image.Rect(0, 0, w, h))); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestProcreateUsesEmbeddedPreview(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "art.procreate")
	writeProcreate(t, path, 40, 30)

	page, err := scanFolderPage(dir, 0, 100)
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 1 || page.Photos[0].Width != 40 || page.Photos[0].Height != 30 {
		t.Fatalf("unexpected page: %+v", page)
	}

	thumb, err := ensureThumbnail(dir, path, 480)
	if err != nil {
		t.Fatal(err)
	}
	if w, h, err := imageDimensions(thumb); err != nil || w != 40 || h != 30 {
		t.Fatalf("thumbnail %dx%d, err %v", w, h, err)
	}

	rec := httptest.NewRecorder()
	serveLocalFile(rec, httptest.NewRequest("GET", "/?path="+url.QueryEscape(path), nil))
	if rec.Code != 200 || rec.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("serve: %d %q", rec.Code, rec.Header().Get("Content-Type"))
	}
	if _, err := png.DecodeConfig(rec.Body); err != nil {
		t.Fatalf("served body is not a PNG: %v", err)
	}
}

func TestProcreateWithoutPreviewIsSkipped(t *testing.T) {
	dir := t.TempDir()
	f, _ := os.Create(filepath.Join(dir, "broken.procreate"))
	zip.NewWriter(f).Close()
	f.Close()

	page, err := scanFolderPage(dir, 0, 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Photos) != 0 {
		t.Fatalf("expected no photos, got %+v", page.Photos)
	}
}
