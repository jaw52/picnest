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

func (a *App) ListSubfolders(folderPath string) ([]FolderEntry, error) {
	return listSubfolders(folderPath)
}

func (a *App) GetPhotoDetails(filePath string) (PhotoDetails, error) {
	return readPhotoDetails(filePath)
}

func (a *App) DeletePhotos(folderPath string, filePaths []string) error {
	db, err := openRatingsDB(folderPath)
	if err != nil {
		return err
	}
	defer db.Close()
	var errs []error
	for _, path := range filePaths {
		if err := mygo.Shell.TrashItem(path); err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", filepath.Base(path), err))
		}
		// A batch can partially succeed: only clear ratings for files that
		// are confirmed gone.
		if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
			if err := setRating(db, filepath.Base(path), 0); err != nil {
				errs = append(errs, err)
			}
		}
	}
	return errors.Join(errs...)
}

// DownloadPlaceholder asks iCloud Drive to fetch a not-yet-downloaded file.
// It returns once the request is accepted; the download continues in the
// background, so callers re-scan to see the file become real.
func (a *App) DownloadPlaceholder(filePath string) error {
	if runtime.GOOS != "darwin" {
		return errors.New("只有 macOS 支持下载 iCloud 文件")
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
		return errors.New("文件名不能为空或包含斜杠")
	}
	newPath := filepath.Join(folderPath, newName)
	if _, err := os.Lstat(newPath); err == nil {
		return fmt.Errorf("「%s」已存在", newName)
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
		return errors.New("目标文件夹与当前文件夹相同")
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
			msgs = append(msgs, fmt.Sprintf("「%s」在目标文件夹中已存在", name))
			continue
		}
		if err := moveFile(from, to); err != nil {
			msgs = append(msgs, fmt.Sprintf("「%s」：%v", name, err))
			continue
		}
		if err := moveFileRecords(db, ratingsDBPath(destFolder), name); err != nil {
			msgs = append(msgs, fmt.Sprintf("「%s」元数据迁移失败：%v", name, err))
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
