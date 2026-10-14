package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

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
	// Bounds concurrent thumbnail decodes so a big folder doesn't saturate
	// every core. A quarter of the cores keeps the UI responsive.
	thumbs        *thumbScheduler
	folderWatcher folderWatcher
}

func NewApp() *App {
	return &App{thumbs: newThumbScheduler(max(runtime.NumCPU()/4, 1))}
}

func (a *App) ScanFolderPage(folderPath string, offset, limit int) (PhotoPage, error) {
	return scanFolderPage(folderPath, offset, limit)
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
	release, err := a.thumbs.acquire(background, requestID)
	if err != nil {
		return "", err
	}
	defer release()
	return generateThumbnail(filePath, thumbPath, maxEdge)
}

// CancelThumbnail drops a thumbnail request that is still waiting for a
// slot. A request already generating, or already done, is unaffected.
func (a *App) CancelThumbnail(requestID string) {
	a.thumbs.cancel(requestID)
}

func (a *App) SetRating(folderPath, fileName string, rating int) error {
	db, err := openRatingsDB(folderPath)
	if err != nil {
		return err
	}
	defer db.Close()
	return setRating(db, fileName, rating)
}

// IsICloudFolder reports whether a folder is in iCloud Drive, including a
// Desktop or Documents folder synced to it.
func (a *App) IsICloudFolder(folderPath string) bool {
	return isICloudItem(folderPath)
}

func (a *App) ListSubfolders(folderPath string) ([]FolderEntry, error) {
	return listSubfolders(folderPath)
}

func (a *App) GetPhotoDetails(filePath string) (PhotoDetails, error) {
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
	Trashed  []TrashedPhoto `json:"trashed"`
	Failures []string       `json:"failures"`
}

func (a *App) DeletePhotos(folderPath string, filePaths []string) (DeleteResult, error) {
	db, err := openRatingsDB(folderPath)
	if err != nil {
		return DeleteResult{}, err
	}
	defer db.Close()
	ratings, err := getAllRatings(db)
	if err != nil {
		return DeleteResult{}, err
	}
	result := DeleteResult{Trashed: []TrashedPhoto{}, Failures: []string{}}
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

// RestorePhotos moves trashed photos back into folderPath with their
// ratings, undoing DeletePhotos. A photo whose name has since been taken
// stays in the trash.
func (a *App) RestorePhotos(folderPath string, photos []TrashedPhoto) error {
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
	return mygo.Shell.TrashItem(folderPath)
}

func (a *App) RenamePhoto(folderPath, oldName, newName string) error {
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

// WatchFolder (re)starts watching the open folder, replacing any previous
// watch, and emits folder-changed with the folder path on changes.
func (a *App) WatchFolder(folderPath string) error {
	return a.folderWatcher.watch(folderPath, func() { folderChanged.Broadcast(folderPath) })
}

func (a *App) UnwatchFolder() {
	a.folderWatcher.unwatch()
}
