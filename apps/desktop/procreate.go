package main

import (
	"archive/zip"
	"io"
	"path/filepath"
	"strings"
)

// procreatePreviewName is the flattened preview Procreate stores inside each
// .procreate archive (a zip). Picnest shows this instead of compositing layers,
// so its resolution, not the canvas's, is what the app displays.
const procreatePreviewName = "QuickLook/Thumbnail.png"

func isProcreateFile(path string) bool {
	return strings.EqualFold(filepath.Ext(path), ".procreate")
}

// readProcreatePreview returns the PNG bytes of a .procreate file's preview.
func readProcreatePreview(path string) ([]byte, error) {
	zr, err := zip.OpenReader(path)
	if err != nil {
		return nil, err
	}
	defer zr.Close()
	f, err := zr.Open(procreatePreviewName)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return io.ReadAll(f)
}
