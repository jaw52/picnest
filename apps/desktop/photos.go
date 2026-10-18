package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

var imageExtensions = map[string]bool{
	"jpg": true, "jpeg": true, "png": true, "webp": true, "gif": true, "bmp": true,
	"procreate": true,
}

func isImageFile(path string) bool {
	ext := strings.TrimPrefix(filepath.Ext(path), ".")
	return imageExtensions[strings.ToLower(ext)]
}

// isCloudPlaceholder reports an iCloud Drive (or similar) "dataless" file:
// it has a logical size but no blocks on disk. Reading one forces a
// synchronous download, so callers avoid decoding these.
func isCloudPlaceholder(info os.FileInfo) bool {
	st, ok := info.Sys().(*syscall.Stat_t)
	return ok && info.Size() > 0 && st.Blocks == 0
}

// birthTime is when the file was created, in Unix seconds; 0 if unknown.
func birthTime(info os.FileInfo) int64 {
	if st, ok := info.Sys().(*syscall.Stat_t); ok {
		return st.Birthtimespec.Sec
	}
	return 0
}

// exifTime reads an EXIF date ("2006:01:02 15:04:05", in the camera's local
// time) as Unix seconds; 0 if it isn't one.
func exifTime(date string) int64 {
	t, err := time.ParseInLocation("2006:01:02 15:04:05", strings.TrimSpace(date), time.Local)
	if err != nil {
		return 0
	}
	return t.Unix()
}

type PhotoMeta struct {
	Path     string `json:"path"`
	FileName string `json:"fileName"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Rating   int    `json:"rating"`
	Modified int64  `json:"modified"`
	// Taken is when the photo was taken, in Unix seconds: by its EXIF, else
	// when its file was created (a library photo's creation date). What the
	// grid groups photos by.
	Taken              int64 `json:"taken"`
	IsCloudPlaceholder bool  `json:"isCloudPlaceholder"`
}

type PhotoPage struct {
	Photos []PhotoMeta `json:"photos"`
	Total  int         `json:"total"`
}

type fileStat struct {
	path, name             string
	size, modTime, created int64
	placeholder            bool
}

// listFiles stats every image directly inside folder, sorted by name. The
// stable ordering is what pagination relies on.
func listFiles(folder string) ([]fileStat, error) {
	entries, err := os.ReadDir(folder)
	if err != nil {
		return nil, fmt.Errorf("failed to read folder: %w", err)
	}
	var files []fileStat
	for _, e := range entries {
		path := filepath.Join(folder, e.Name())
		if !isImageFile(path) {
			continue
		}
		info, err := os.Stat(path)
		if err != nil || !info.Mode().IsRegular() {
			continue
		}
		files = append(files, fileStat{
			path:        path,
			name:        e.Name(),
			size:        info.Size(),
			modTime:     info.ModTime().Unix(),
			created:     birthTime(info),
			placeholder: isCloudPlaceholder(info),
		})
	}
	sort.Slice(files, func(i, j int) bool { return files[i].name < files[j].name })
	return files, nil
}

// folderListings keeps the listing a scan took for its first page, so the
// pages after it don't each list (and stat) the whole folder again: for
// 10,000 photos that made every page cost as much as the first, and loading
// them all take seconds. The last page lets it go.
var folderListings sync.Map // folder -> []fileStat

// scanListing lists folder for the first page of a scan, and reuses that
// listing for the pages after it.
func scanListing(folder string, offset int) ([]fileStat, error) {
	if offset > 0 {
		if files, ok := folderListings.Load(folder); ok {
			return files.([]fileStat), nil
		}
	}
	files, err := listFiles(folder)
	if err != nil {
		return nil, err
	}
	folderListings.Store(folder, files)
	return files, nil
}

// scanFolderPage returns one page of photo metadata, probing dimensions only
// for files in the page that are new or changed since the last scan.
func scanFolderPage(folder string, offset, limit int) (PhotoPage, error) {
	files, err := scanListing(folder, offset)
	if err != nil {
		return PhotoPage{}, err
	}
	pruneThumbnailsOnce(folder, files)
	total := len(files)
	start := min(max(offset, 0), total)
	end := min(start+max(limit, 0), total)
	if end == total {
		folderListings.Delete(folder)
	}

	db, err := openRatingsDB(folder)
	if err != nil {
		return PhotoPage{}, err
	}
	defer db.Close()
	ratings, err := getAllRatings(db)
	if err != nil {
		return PhotoPage{}, err
	}
	page := files[start:end]
	names := make([]string, len(page))
	for i, f := range page {
		names[i] = f.name
	}
	cached, err := getPhotoMeta(db, names)
	if err != nil {
		return PhotoPage{}, err
	}

	results := make([]*PhotoMeta, len(page))
	var updates []photoMetaUpdate
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 8)
	for i, f := range page {
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer func() { <-sem; wg.Done() }()
			meta := PhotoMeta{
				Path: f.path, FileName: f.name, Rating: ratings[f.name],
				Modified: f.modTime, Taken: f.created, IsCloudPlaceholder: f.placeholder,
			}
			switch c, ok := cached[f.name]; {
			case f.placeholder:
				// The cloud thumbnail gives the aspect ratio without a
				// download; neutral if there is none. Not cached, since these
				// aren't the photo's real dimensions.
				meta.Width, meta.Height = 1, 1
				if w, h, err := cloudThumbnailSize(f.path); err == nil && w > 0 && h > 0 {
					meta.Width, meta.Height = w, h
				}
			case ok && c.Size == f.size && c.Mtime == f.modTime:
				meta.Width, meta.Height = c.Width, c.Height
				if c.Taken != 0 {
					meta.Taken = c.Taken
				}
			default:
				header, err := readImageHeader(f.path)
				if err != nil {
					return
				}
				meta.Width, meta.Height = header.Width, header.Height
				if header.Taken != 0 {
					meta.Taken = header.Taken
				}
				mu.Lock()
				updates = append(updates, photoMetaUpdate{f.name, cachedPhotoMeta{header.Width, header.Height, header.Taken, f.size, f.modTime}})
				mu.Unlock()
			}
			results[i] = &meta
		}()
	}
	wg.Wait()

	if err := upsertPhotoMetaBatch(db, updates); err != nil {
		return PhotoPage{}, err
	}
	photos := make([]PhotoMeta, 0, len(results))
	for _, m := range results {
		if m != nil {
			photos = append(photos, *m)
		}
	}
	return PhotoPage{Photos: photos, Total: total}, nil
}

const (
	thumbMinEdge     = 480
	thumbMaxEdge     = 2048
	thumbJPEGQuality = 0.82
)

// thumbnailTarget resolves where a thumbnail lives and whether it already
// exists. A larger cached thumbnail (see thumbReuseFactor) is reused rather
// than generating a second size.
func thumbnailTarget(folder, filePath string, maxEdge int) (thumbPath string, cached bool, err error) {
	if isLibraryPath(filePath) {
		return libraryThumbnailTarget(filePath, maxEdge)
	}
	maxEdge = min(max(maxEdge, thumbMinEdge), thumbMaxEdge)
	info, err := os.Stat(filePath)
	if err != nil {
		return "", false, err
	}
	waitForPrune(folder)
	return thumbSlot(folder, thumbKey(filePath, info.ModTime().Unix(), info.Size(), isCloudPlaceholder(info)), maxEdge)
}

// thumbSlot is where the thumbnail with key, at maxEdge px, goes in folder's
// sidecar, and whether it or a larger one to reuse is there already.
func thumbSlot(folder, key string, maxEdge int) (thumbPath string, cached bool, err error) {
	thumbsDir := filepath.Join(sidecarDir(folder), "thumbs")
	if err := os.MkdirAll(thumbsDir, 0o755); err != nil {
		return "", false, err
	}
	thumbPath = filepath.Join(thumbsDir, thumbFileName(key, maxEdge))
	if _, statErr := os.Stat(thumbPath); statErr == nil {
		return thumbPath, true, nil
	}
	if reuse, ok := findReusableThumb(thumbsDir, key, maxEdge); ok {
		return reuse, true, nil
	}
	return thumbPath, false, nil
}

var thumbTmpSeq atomic.Uint64

// generateThumbnail writes the thumbnail at thumbPath unless another request
// finished it while this one waited for a slot.
func generateThumbnail(filePath, thumbPath string, maxEdge int) (string, error) {
	if _, err := os.Stat(thumbPath); err == nil {
		return thumbPath, nil
	}
	maxEdge = min(max(maxEdge, thumbMinEdge), thumbMaxEdge)
	write := writeThumbnail
	if isLibraryPath(filePath) {
		write = writeLibraryThumbnail
	} else {
		info, err := os.Stat(filePath)
		if err != nil {
			return "", err
		}
		// Decoding an undownloaded iCloud file would download it; its cloud
		// thumbnail doesn't.
		if isCloudPlaceholder(info) {
			write = writeCloudThumbnail
		}
	}

	// Write to a unique temp name first so a concurrent request for the same
	// thumbnail never sees (or clobbers) a half-written file.
	tmp := fmt.Sprintf("%s.tmp%d-%d", thumbPath, os.Getpid(), thumbTmpSeq.Add(1))
	if err := write(filePath, tmp, maxEdge, thumbJPEGQuality); err != nil {
		os.Remove(tmp)
		return "", err
	}
	if err := os.Rename(tmp, thumbPath); err != nil {
		os.Remove(tmp)
		return "", err
	}
	return thumbPath, nil
}

// ensureThumbnail generates (or reuses) a cached thumbnail and returns its
// path, without any concurrency gating.
func ensureThumbnail(folder, filePath string, maxEdge int) (string, error) {
	thumbPath, cached, err := thumbnailTarget(folder, filePath, maxEdge)
	if err != nil || cached {
		return thumbPath, err
	}
	return generateThumbnail(filePath, thumbPath, maxEdge)
}

type FolderEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

func isHiddenName(name string) bool {
	return name == sidecarDirName || strings.HasPrefix(name, ".")
}

var errFound = errors.New("found")

// containsImageRecursively reports whether dir has an image anywhere in its
// subtree, skipping hidden folders. Exits on the first match.
func containsImageRecursively(dir string) bool {
	err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			if path != dir && isHiddenName(d.Name()) {
				return filepath.SkipDir
			}
			return nil
		}
		if d.Type().IsRegular() && isImageFile(path) {
			return errFound
		}
		return nil
	})
	return err == errFound
}

// visibleSubdirs lists the immediate non-hidden subfolders of dir.
func visibleSubdirs(dir string) []string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var out []string
	for _, e := range entries {
		if isHiddenName(e.Name()) {
			continue
		}
		path := filepath.Join(dir, e.Name())
		if info, err := os.Stat(path); err == nil && info.IsDir() {
			out = append(out, path)
		}
	}
	return out
}

// listSubfolders lists the immediate subfolders worth offering in the path
// bar: hidden folders and folders without any images below are skipped.
func listSubfolders(folder string) ([]FolderEntry, error) {
	if info, err := os.Stat(folder); err != nil || !info.IsDir() {
		return nil, fmt.Errorf("%s is not a directory", folder)
	}
	entries := []FolderEntry{}
	for _, path := range visibleSubdirs(folder) {
		if !containsImageRecursively(path) {
			continue
		}
		entries = append(entries, FolderEntry{Name: filepath.Base(path), Path: path})
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name < entries[j].Name })
	return entries, nil
}

type PhotoExif struct {
	CameraMake   string `json:"cameraMake,omitempty"`
	CameraModel  string `json:"cameraModel,omitempty"`
	LensModel    string `json:"lensModel,omitempty"`
	FocalLength  string `json:"focalLength,omitempty"`
	Aperture     string `json:"aperture,omitempty"`
	ShutterSpeed string `json:"shutterSpeed,omitempty"`
	ISO          string `json:"iso,omitempty"`
	ExposureBias string `json:"exposureBias,omitempty"`
	TakenAt      string `json:"takenAt,omitempty"`
}

type PhotoDetails struct {
	FileSize int64      `json:"fileSize"`
	Created  *int64     `json:"created,omitempty"`
	Exif     *PhotoExif `json:"exif,omitempty"`
}

func readPhotoDetails(path string) (PhotoDetails, error) {
	info, err := os.Stat(path)
	if err != nil {
		return PhotoDetails{}, fmt.Errorf("failed to stat file: %w", err)
	}
	details := PhotoDetails{FileSize: info.Size()}
	if created := birthTime(info); created != 0 {
		details.Created = &created
	}
	details.Exif = readExif(path)
	return details, nil
}

func readExif(path string) *PhotoExif {
	raw := readExifJSON(path)
	if raw == nil {
		return nil
	}
	var f struct {
		Make, Model, LensModel, DateTimeOriginal string
		FocalLength, FNumber, ExposureTime       *float64
		ExposureBias                             *float64
		ISO                                      []float64
	}
	if json.Unmarshal(raw, &f) != nil {
		return nil
	}
	exif := PhotoExif{
		CameraMake:  strings.TrimSpace(f.Make),
		CameraModel: strings.TrimSpace(f.Model),
		LensModel:   strings.TrimSpace(f.LensModel),
		TakenAt:     f.DateTimeOriginal,
	}
	if f.FocalLength != nil {
		exif.FocalLength = fmt.Sprintf("%g mm", *f.FocalLength)
	}
	if f.FNumber != nil {
		exif.Aperture = fmt.Sprintf("f/%g", *f.FNumber)
	}
	if t := f.ExposureTime; t != nil && *t > 0 {
		if *t < 1 {
			exif.ShutterSpeed = fmt.Sprintf("1/%d s", int(math.Round(1 / *t)))
		} else {
			exif.ShutterSpeed = fmt.Sprintf("%g s", *t)
		}
	}
	if len(f.ISO) > 0 {
		parts := make([]string, len(f.ISO))
		for i, v := range f.ISO {
			parts[i] = fmt.Sprintf("%g", v)
		}
		exif.ISO = strings.Join(parts, ", ")
	}
	if f.ExposureBias != nil {
		exif.ExposureBias = fmt.Sprintf("%g EV", *f.ExposureBias)
	}
	if exif == (PhotoExif{}) {
		return nil
	}
	return &exif
}
