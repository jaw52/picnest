package main

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Thumbnails live at <sidecar>/thumbs/<key>_<edge>.jpg, where key hashes the
// source's path + mtime + size (so edits invalidate it) and whether it came
// from an undownloaded iCloud file's cloud thumbnail (so downloading the file
// replaces it with one decoded from the file itself), and edge is the
// longest side in pixels. Several edges can exist for one photo as the column
// width changes.

// thumbReuseFactor is how much larger than requested an existing thumbnail
// may be and still be reused instead of generating a new one.
const thumbReuseFactor = 4

// thumbGrace protects files that look orphaned but may just belong to a photo
// added after the folder listing was taken.
const thumbGrace = time.Minute

func thumbKey(path string, modTime, size int64, cloud bool) string {
	h := sha256.New()
	h.Write([]byte(path))
	binary.Write(h, binary.LittleEndian, modTime)
	binary.Write(h, binary.LittleEndian, uint64(size))
	if cloud {
		h.Write([]byte("cloud"))
	}
	return hex.EncodeToString(h.Sum(nil))
}

func thumbFileName(key string, edge int) string {
	return fmt.Sprintf("%s_%d.jpg", key, edge)
}

func parseThumbFileName(name string) (key string, edge int, ok bool) {
	base, found := strings.CutSuffix(name, ".jpg")
	if !found {
		return "", 0, false
	}
	key, edgeStr, found := strings.Cut(base, "_")
	if !found {
		return "", 0, false
	}
	edge, err := strconv.Atoi(edgeStr)
	return key, edge, err == nil && edge > 0
}

// findReusableThumb returns an existing thumbnail for key that is at least
// edge px and at most thumbReuseFactor times larger, preferring the smallest.
func findReusableThumb(thumbsDir, key string, edge int) (string, bool) {
	matches, _ := filepath.Glob(filepath.Join(thumbsDir, key+"_*.jpg"))
	best, bestEdge := "", 0
	for _, m := range matches {
		_, e, ok := parseThumbFileName(filepath.Base(m))
		if !ok || e < edge || e > edge*thumbReuseFactor {
			continue
		}
		if best == "" || e < bestEdge {
			best, bestEdge = m, e
		}
	}
	return best, best != ""
}

// prunedFolders maps a folder to a channel closed once its cache prune ends.
var prunedFolders sync.Map

// pruneThumbnailsOnce cleans a folder's thumbnail cache in the background the
// first time it is seen in this process, so a large cache doesn't delay the
// first page of photos.
func pruneThumbnailsOnce(folder string, files []fileStat) {
	done := make(chan struct{})
	if _, loaded := prunedFolders.LoadOrStore(folder, done); loaded {
		return
	}
	go func() {
		defer close(done)
		pruneThumbnails(filepath.Join(sidecarDir(folder), "thumbs"), files)
	}()
}

// waitForPrune blocks until the folder's prune (if one started) finishes, so
// the prune can never delete a file the UI was just handed a URL to.
func waitForPrune(folder string) {
	if done, ok := prunedFolders.Load(folder); ok {
		<-done.(chan struct{})
	}
}

// pruneThumbnails removes thumbnails whose source is gone or changed, any
// thumbnail superseded by a larger reusable one, and stale temp files.
func pruneThumbnails(thumbsDir string, files []fileStat) {
	entries, err := os.ReadDir(thumbsDir)
	if err != nil {
		return
	}
	valid := make(map[string]bool, len(files))
	for _, f := range files {
		valid[thumbKey(f.path, f.modTime, f.size, f.placeholder)] = true
	}

	old := func(e os.DirEntry, age time.Duration) bool {
		info, err := e.Info()
		return err == nil && time.Since(info.ModTime()) > age
	}
	remove := func(e os.DirEntry) { os.Remove(filepath.Join(thumbsDir, e.Name())) }

	edgesByKey := make(map[string][]int)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		key, edge, ok := parseThumbFileName(e.Name())
		switch {
		case !ok:
			// Old-format cache files and abandoned ".tmp" writes.
			if old(e, thumbGrace) && (!strings.Contains(e.Name(), ".tmp") || old(e, time.Hour)) {
				remove(e)
			}
		case !valid[key]:
			if old(e, thumbGrace) {
				remove(e)
			}
		default:
			edgesByKey[key] = append(edgesByKey[key], edge)
		}
	}

	// A thumbnail is redundant if a larger one would be reused in its place.
	for key, edges := range edgesByKey {
		for _, a := range edges {
			for _, b := range edges {
				if b > a && b <= a*thumbReuseFactor {
					os.Remove(filepath.Join(thumbsDir, thumbFileName(key, a)))
					break
				}
			}
		}
	}
}
