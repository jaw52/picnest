package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/egoist/mygo"
)

// Events emitted to the frontend.
var (
	// folderChanged carries the path of the watched folder.
	folderChanged = mygo.NewEvent[string]("folder-changed")
	// languageChanged carries the language picked in Settings, and the
	// one the app is now shown in.
	languageChanged = mygo.NewEvent[LanguageState]("language-changed")
	// openSettings asks the page to open Settings, chosen from the menu bar.
	openSettings = mygo.NewEvent[struct{}]("open-settings")
	// cacheClearProgress tells the page clearing the photo cache how far it
	// has got.
	cacheClearProgress = mygo.NewEvent[CacheClearProgress]("cache-clear-progress")
)

// configFile returns a path inside the app config dir.
func configFile(name string) (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, "design.jaw.picnest")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(dir, name), nil
}

// App is the service bound to the frontend.
type App struct {
	// Bounds concurrent thumbnail decodes. Tiles on screen may use three
	// quarters of the cores, past which decoding gets no faster on Apple
	// silicon (its efficiency cores add little); background work keeps to a
	// quarter, so prefetching a big folder leaves the rest of the system be.
	thumbs *thumbScheduler
	// generating maps a thumbnail being written to the wait for it, so a
	// request for one already underway (a tile's, after prefetch started
	// it) waits for that one instead of decoding the photo again.
	generating    sync.Map // thumbnail path -> *thumbJob
	folderWatcher folderWatcher
}

type thumbJob struct {
	done chan struct{}
	err  error
}

func NewApp() *App {
	cpus := runtime.NumCPU()
	return &App{thumbs: newThumbScheduler(max(cpus*3/4, 1), max(cpus/4, 1))}
}

func (a *App) ScanFolderPage(folderPath string, offset, limit int) (PhotoPage, error) {
	if isLibraryPath(folderPath) {
		return scanLibraryPage(offset, limit)
	}
	return scanFolderPage(folderPath, offset, limit)
}

// PhotoCacheSize is how many bytes the thumbnails and what scans read of the
// photos in folders and their subfolders, the library and the collect
// folder take.
func (a *App) PhotoCacheSize(folders []string) int64 {
	return photoCacheSize(folders)
}

// ClearPhotoCache deletes the cache PhotoCacheSize measures, to be made again
// as the photos are shown, sending the calling page cacheClearProgress as it
// goes. Ratings are kept.
func (a *App) ClearPhotoCache(ctx context.Context, folders []string) error {
	win := mygo.CallerWindow(ctx)
	// At most one update a frame or so, and always the last one.
	var sent time.Time
	return clearPhotoCache(folders, func(p CacheClearProgress) {
		if win != nil && (p.Done == p.Total || time.Since(sent) >= 16*time.Millisecond) {
			sent = time.Now()
			_ = cacheClearProgress.Emit(win, p)
		}
	})
}

// LibraryFileNames returns the names photos in the Photos library had when
// imported, by path. Scans leave them out, as reading them is slow; the
// photos shown ask for theirs.
func (a *App) LibraryFileNames(paths []string) (map[string]string, error) {
	return libraryFileNames(paths)
}

// LibraryAccess reports whether the Photos library may be read, without
// asking.
func (a *App) LibraryAccess() (LibraryAccess, error) {
	return currentLibraryAccess()
}

// RequestLibraryAccess asks for access to the Photos library, with the
// system prompt the first time, and reports the answer.
func (a *App) RequestLibraryAccess() (LibraryAccess, error) {
	return requestLibraryAccess()
}

// OpenLibraryPrivacySettings opens the Photos pane of Privacy & Security,
// where access refused earlier can be granted.
func (a *App) OpenLibraryPrivacySettings() error {
	return mygo.Shell.OpenExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Photos")
}

// errIfLibrary refuses changes to photos in the Photos library, which can
// only be rated and deleted here.
func errIfLibrary(folderPath string) error {
	if isLibraryPath(folderPath) {
		return errors.New(text().libraryReadOnly)
	}
	return nil
}

// EnsureThumbnail returns the cached thumbnail path, generating it if needed.
// background marks speculative prefetch, which yields to on-screen requests.
// requestID, if not empty, lets CancelThumbnail drop the request while it
// waits for a slot.
func (a *App) EnsureThumbnail(folderPath, filePath string, maxEdge int, background bool, requestID string) (string, error) {
	thumbPath, cached, err := thumbnailTarget(folderPath, filePath, maxEdge)
	if err != nil || cached {
		return thumbPath, err
	}
	if job, ok := a.generating.Load(thumbPath); ok {
		return waitForThumb(job.(*thumbJob), thumbPath)
	}
	release, err := a.thumbs.acquire(background, requestID)
	if err != nil {
		return "", err
	}
	defer release()

	job := &thumbJob{done: make(chan struct{})}
	if running, loaded := a.generating.LoadOrStore(thumbPath, job); loaded {
		return waitForThumb(running.(*thumbJob), thumbPath)
	}
	defer func() {
		a.generating.Delete(thumbPath)
		close(job.done)
	}()
	path, err := generateThumbnail(filePath, thumbPath, maxEdge)
	job.err = err
	return path, err
}

func waitForThumb(job *thumbJob, thumbPath string) (string, error) {
	<-job.done
	if job.err != nil {
		return "", job.err
	}
	return thumbPath, nil
}

// CancelThumbnail drops a thumbnail request that is still waiting for a
// slot. A request already generating, or already done, is unaffected.
func (a *App) CancelThumbnail(requestID string) {
	a.thumbs.cancel(requestID)
}

// SetRating rates the photo at filePath. A library photo's rating is kept
// by its asset identifier, since names repeat across a library.
func (a *App) SetRating(folderPath, filePath string, rating int) error {
	db, err := openRatingsDB(folderPath)
	if err != nil {
		return err
	}
	defer db.Close()
	key := filepath.Base(filePath)
	if isLibraryPath(filePath) {
		key = libraryAssetID(filePath)
	}
	return setRating(db, key, rating)
}

// IsICloudFolder reports whether a folder is in iCloud Drive, including a
// Desktop or Documents folder synced to it.
func (a *App) IsICloudFolder(folderPath string) bool {
	return !isLibraryPath(folderPath) && isICloudItem(folderPath)
}

func (a *App) ListSubfolders(folderPath string) ([]FolderEntry, error) {
	if isLibraryPath(folderPath) {
		return []FolderEntry{}, nil
	}
	return listSubfolders(folderPath)
}

func (a *App) GetPhotoDetails(filePath string) (PhotoDetails, error) {
	if isLibraryPath(filePath) {
		return libraryPhotoDetails(filePath)
	}
	return readPhotoDetails(filePath)
}

// TrashedPhoto is a photo moved to the trash: where it went there, and the
// rating it had, which RestorePhotos puts back with it.
type TrashedPhoto struct {
	Path      string `json:"path"`
	TrashPath string `json:"trashPath"`
	Rating    int    `json:"rating"`
}

// DeleteResult reports a batch delete that may have partially succeeded.
type DeleteResult struct {
	// Trashed are the photos now in the trash, which RestorePhotos can put back.
	Trashed []TrashedPhoto `json:"trashed"`
	// Deleted are photos deleted from the Photos library, to its Recently
	// Deleted album, which can't be put back from here.
	Deleted  []string `json:"deleted"`
	Failures []string `json:"failures"`
}

func (a *App) DeletePhotos(folderPath string, filePaths []string) (DeleteResult, error) {
	if isLibraryPath(folderPath) {
		return deleteFromLibrary(filePaths)
	}
	db, err := openRatingsDB(folderPath)
	if err != nil {
		return DeleteResult{}, err
	}
	defer db.Close()
	ratings, err := getAllRatings(db)
	if err != nil {
		return DeleteResult{}, err
	}
	result := DeleteResult{Trashed: []TrashedPhoto{}, Deleted: []string{}, Failures: []string{}}
	for _, path := range filePaths {
		trashPath, err := trashItem(path)
		if err != nil {
			result.Failures = append(result.Failures, fmt.Sprintf("%s: %v", filepath.Base(path), err))
			continue
		}
		result.Trashed = append(result.Trashed, TrashedPhoto{
			Path:      path,
			TrashPath: trashPath,
			Rating:    ratings[filepath.Base(path)],
		})
		// The rating goes with the file: a new file taking its name later
		// mustn't inherit it. Undo puts it back (see RestorePhotos).
		if err := setRating(db, filepath.Base(path), 0); err != nil {
			result.Failures = append(result.Failures, err.Error())
		}
	}
	return result, nil
}

// deleteFromLibrary is DeletePhotos for photos in the Photos library, which
// macOS has the user confirm. Their ratings go with them.
func deleteFromLibrary(filePaths []string) (DeleteResult, error) {
	deleted, err := deleteLibraryPhotos(filePaths)
	if err != nil {
		return DeleteResult{}, err
	}
	result := DeleteResult{Trashed: []TrashedPhoto{}, Deleted: deleted, Failures: []string{}}
	if len(deleted) == 0 {
		return result, nil
	}
	db, err := openRatingsDB(libraryRoot)
	if err != nil {
		result.Failures = append(result.Failures, err.Error())
		return result, nil
	}
	defer db.Close()
	for _, path := range deleted {
		if err := setRating(db, libraryAssetID(path), 0); err != nil {
			result.Failures = append(result.Failures, err.Error())
		}
	}
	return result, nil
}

// RestorePhotos moves trashed photos back into folderPath with their
// ratings, undoing DeletePhotos. A photo whose name has since been taken
// stays in the trash.
func (a *App) RestorePhotos(folderPath string, photos []TrashedPhoto) error {
	if err := errIfLibrary(folderPath); err != nil {
		return err
	}
	db, err := openRatingsDB(folderPath)
	if err != nil {
		return err
	}
	defer db.Close()
	var msgs []string
	for _, p := range photos {
		name := filepath.Base(p.Path)
		if _, err := os.Lstat(p.Path); err == nil {
			msgs = append(msgs, fmt.Sprintf(text().existsNotRestored, name))
			continue
		}
		if err := moveFile(p.TrashPath, p.Path); err != nil {
			msgs = append(msgs, fmt.Sprintf(text().fileFailed, name, err))
			continue
		}
		if err := setRating(db, name, p.Rating); err != nil {
			msgs = append(msgs, fmt.Sprintf(text().ratingNotRestored, name, err))
		}
	}
	if len(msgs) > 0 {
		return errors.New(strings.Join(msgs, "\n"))
	}
	return nil
}

// DownloadPlaceholder asks iCloud Drive to fetch a not-yet-downloaded file.
// It returns once the request is accepted; the download continues in the
// background, so callers re-scan to see the file become real.
func (a *App) DownloadPlaceholder(filePath string) error {
	if runtime.GOOS != "darwin" {
		return errors.New(text().iCloudMacOnly)
	}
	info, err := os.Stat(filePath)
	if err != nil {
		return err
	}
	if !isCloudPlaceholder(info) {
		return nil
	}
	if out, err := exec.Command("brctl", "download", filePath).CombinedOutput(); err != nil {
		return fmt.Errorf("%w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func (a *App) DeleteFolder(folderPath string) error {
	if err := errIfLibrary(folderPath); err != nil {
		return err
	}
	return mygo.Shell.TrashItem(folderPath)
}

func (a *App) RenamePhoto(folderPath, oldName, newName string) error {
	if err := errIfLibrary(folderPath); err != nil {
		return err
	}
	if newName == "" || strings.Contains(newName, "/") {
		return errors.New(text().invalidName)
	}
	newPath := filepath.Join(folderPath, newName)
	if _, err := os.Lstat(newPath); err == nil {
		return fmt.Errorf(text().nameTaken, newName)
	}
	if err := os.Rename(filepath.Join(folderPath, oldName), newPath); err != nil {
		return err
	}
	db, err := openRatingsDB(folderPath)
	if err != nil {
		return err
	}
	defer db.Close()
	return renameFileRecords(db, oldName, newName)
}

// MovePhotos moves files into destFolder along with their sidecar records.
// Name collisions are skipped and every per-file failure is reported
// together, so one bad file doesn't abort the batch.
func (a *App) MovePhotos(folderPath string, fileNames []string, destFolder string) error {
	if err := errIfLibrary(folderPath); err != nil {
		return err
	}
	if filepath.Clean(folderPath) == filepath.Clean(destFolder) {
		return errors.New(text().sameFolder)
	}
	db, err := openRatingsDB(folderPath)
	if err != nil {
		return err
	}
	defer db.Close()
	destDB, err := openRatingsDB(destFolder)
	if err != nil {
		return err
	}
	destDB.Close()

	var msgs []string
	for _, name := range fileNames {
		from := filepath.Join(folderPath, name)
		to := filepath.Join(destFolder, name)
		if _, err := os.Lstat(to); err == nil {
			msgs = append(msgs, fmt.Sprintf(text().existsInDestination, name))
			continue
		}
		if err := moveFile(from, to); err != nil {
			msgs = append(msgs, fmt.Sprintf(text().fileFailed, name, err))
			continue
		}
		if err := moveFileRecords(db, ratingsDBPath(destFolder), name); err != nil {
			msgs = append(msgs, fmt.Sprintf(text().recordsNotMoved, name, err))
		}
	}
	if len(msgs) > 0 {
		return errors.New(strings.Join(msgs, "\n"))
	}
	return nil
}

// moveFile renames, falling back to copy + remove across volumes.
func moveFile(from, to string) error {
	if err := os.Rename(from, to); err == nil {
		return nil
	}
	src, err := os.Open(from)
	if err != nil {
		return err
	}
	defer src.Close()
	dst, err := os.OpenFile(to, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return err
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		os.Remove(to)
		return err
	}
	if err := dst.Close(); err != nil {
		os.Remove(to)
		return err
	}
	return os.Remove(from)
}

// WatchFolder watches a folder a tab shows, emitting folder-changed with its
// path on changes; each call wants an UnwatchFolder once the tab is done
// with it.
func (a *App) WatchFolder(folderPath string) error {
	if isLibraryPath(folderPath) {
		return nil
	}
	return a.folderWatcher.watch(folderPath, func() { _ = folderChanged.Broadcast(folderPath) })
}

// UnwatchFolder undoes a WatchFolder of the folder.
func (a *App) UnwatchFolder(folderPath string) {
	a.folderWatcher.unwatch(folderPath)
}
