package main

import (
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

// sidecarDirName is created inside every folder the user opens. It holds the
// ratings database and the thumbnail cache, and never touches originals.
const sidecarDirName = ".picnest"

var recordTables = []string{"ratings", "photo_meta", "sources"}

func sidecarDir(folder string) string {
	if isLibraryPath(folder) {
		return libraryDataDir()
	}
	return filepath.Join(folder, sidecarDirName)
}

func ratingsDBPath(folder string) string {
	return filepath.Join(sidecarDir(folder), "ratings.db")
}

// openRatingsDB opens (creating if necessary) the ratings database for a
// folder. A single connection keeps ATTACH (used by moveFileRecords) on the
// same connection as the statements that follow it.
func openRatingsDB(folder string) (*sql.DB, error) {
	if err := os.MkdirAll(sidecarDir(folder), 0o755); err != nil {
		return nil, fmt.Errorf("failed to create sidecar dir: %w", err)
	}
	db, err := sql.Open("sqlite", "file:"+ratingsDBPath(folder)+"?_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, fmt.Errorf("failed to open db: %w", err)
	}
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS ratings (
			file_name  TEXT PRIMARY KEY,
			rating     INTEGER NOT NULL CHECK(rating BETWEEN 0 AND 5),
			updated_at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS photo_meta (
			file_name TEXT PRIMARY KEY,
			width     INTEGER NOT NULL,
			height    INTEGER NOT NULL,
			taken     INTEGER NOT NULL,
			size      INTEGER NOT NULL,
			mtime     INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS sources (
			file_name    TEXT PRIMARY KEY,
			page_url     TEXT NOT NULL,
			image_url    TEXT NOT NULL,
			dropped_url  TEXT NOT NULL,
			collected_at INTEGER NOT NULL
		);`)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to create table: %w", err)
	}
	return db, nil
}

// cachedPhotoMeta holds what a previous scan read of a photo's header (see
// imageHeader). It is only valid while size and mtime still match the file
// on disk.
type cachedPhotoMeta struct {
	Width, Height int
	Taken         int64
	Size, Mtime   int64
}

// getPhotoMeta returns what is cached of the named files that have any.
func getPhotoMeta(db *sql.DB, names []string) (map[string]cachedPhotoMeta, error) {
	out := map[string]cachedPhotoMeta{}
	if len(names) == 0 {
		return out, nil
	}
	args := make([]any, len(names))
	for i, name := range names {
		args[i] = name
	}
	rows, err := db.Query("SELECT file_name, width, height, taken, size, mtime FROM photo_meta WHERE file_name IN (?"+
		strings.Repeat(", ?", len(names)-1)+")", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		var m cachedPhotoMeta
		if err := rows.Scan(&name, &m.Width, &m.Height, &m.Taken, &m.Size, &m.Mtime); err != nil {
			return nil, err
		}
		out[name] = m
	}
	return out, rows.Err()
}

type photoMetaUpdate struct {
	FileName string
	cachedPhotoMeta
}

func upsertPhotoMetaBatch(db *sql.DB, entries []photoMetaUpdate) error {
	if len(entries) == 0 {
		return nil
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, e := range entries {
		_, err := tx.Exec(`INSERT INTO photo_meta (file_name, width, height, taken, size, mtime) VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(file_name) DO UPDATE SET width = excluded.width, height = excluded.height,
				taken = excluded.taken, size = excluded.size, mtime = excluded.mtime`,
			e.FileName, e.Width, e.Height, e.Taken, e.Size, e.Mtime)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

// Ratings are keyed by file name rather than absolute path, so a folder
// copied or moved elsewhere keeps its ratings.
func getAllRatings(db *sql.DB) (map[string]int, error) {
	rows, err := db.Query("SELECT file_name, rating FROM ratings")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var name string
		var rating int
		if err := rows.Scan(&name, &rating); err != nil {
			return nil, err
		}
		out[name] = rating
	}
	return out, rows.Err()
}

func setRating(db *sql.DB, fileName string, rating int) error {
	if rating < 0 || rating > 5 {
		return errors.New("rating must be between 0 and 5")
	}
	if rating == 0 {
		// 0 means "unrated": remove the row instead of storing a 0.
		_, err := db.Exec("DELETE FROM ratings WHERE file_name = ?", fileName)
		return err
	}
	_, err := db.Exec(`INSERT INTO ratings (file_name, rating, updated_at) VALUES (?, ?, ?)
		ON CONFLICT(file_name) DO UPDATE SET rating = excluded.rating, updated_at = excluded.updated_at`,
		fileName, rating, time.Now().Unix())
	return err
}

// renameFileRecords moves every record keyed by oldName over to newName so
// renaming a file on disk doesn't orphan its sidecar data.
func renameFileRecords(db *sql.DB, oldName, newName string) error {
	for _, table := range recordTables {
		if _, err := db.Exec("UPDATE "+table+" SET file_name = ? WHERE file_name = ?", newName, oldName); err != nil {
			return err
		}
	}
	return nil
}

// moveFileRecords moves every record keyed by fileName into the sidecar
// database at destDB. The destination schema must already exist.
func moveFileRecords(db *sql.DB, destDB, fileName string) (err error) {
	if _, err := db.Exec("ATTACH DATABASE ? AS dest", destDB); err != nil {
		return err
	}
	defer func() {
		if _, detachErr := db.Exec("DETACH DATABASE dest"); err == nil {
			err = detachErr
		}
	}()
	for _, table := range recordTables {
		if _, err := db.Exec("INSERT OR REPLACE INTO dest."+table+" SELECT * FROM main."+table+" WHERE file_name = ?", fileName); err != nil {
			return err
		}
		if _, err := db.Exec("DELETE FROM main."+table+" WHERE file_name = ?", fileName); err != nil {
			return err
		}
	}
	return nil
}

// photoCacheSidecars lists the sidecars in and under folders, plus the
// library's and the collect folder's, that exist.
func photoCacheSidecars(folders []string) []string {
	dirs := []string{sidecarDir(libraryRoot)}
	if dir := collectTarget(); dir != "" {
		folders = append(folders, dir)
	}
	for _, folder := range folders {
		// Unreadable folders, or ones gone since, have nothing cached.
		_ = filepath.WalkDir(folder, func(path string, d fs.DirEntry, err error) error {
			if err != nil || !d.IsDir() || path == folder {
				return nil
			}
			if name := d.Name(); strings.HasPrefix(name, ".") {
				if name == sidecarDirName {
					dirs = append(dirs, path)
				}
				return filepath.SkipDir
			}
			return nil
		})
	}
	return slices.DeleteFunc(dirs, func(dir string) bool {
		_, err := os.Stat(dir)
		return err != nil
	})
}

// openExistingDB opens a sidecar's ratings database, or nil if it has none,
// rather than creating one as openRatingsDB does.
func openExistingDB(sidecar string) *sql.DB {
	path := filepath.Join(sidecar, "ratings.db")
	if _, err := os.Stat(path); err != nil {
		return nil
	}
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=busy_timeout(5000)")
	if err != nil {
		return nil
	}
	return db
}

// photoCacheSize is how many bytes the photo cache (see clearPhotoCache)
// takes in folders.
func photoCacheSize(folders []string) int64 {
	var total int64
	for _, sidecar := range photoCacheSidecars(folders) {
		_ = filepath.WalkDir(filepath.Join(sidecar, "thumbs"), func(_ string, d fs.DirEntry, err error) error {
			if err == nil && !d.IsDir() {
				if info, err := d.Info(); err == nil {
					total += info.Size()
				}
			}
			return nil
		})
		if db := openExistingDB(sidecar); db != nil {
			var size int64
			if db.QueryRow("SELECT coalesce(sum(pgsize), 0) FROM dbstat WHERE name = 'photo_meta'").Scan(&size) == nil {
				total += size
			}
			db.Close()
		}
	}
	return total
}

// CacheClearProgress is how far clearing the photo cache has got: files and
// tables deleted out of all of them.
type CacheClearProgress struct {
	Done  int `json:"done"`
	Total int `json:"total"`
}

// clearPhotoCache deletes what scans and thumbnails cached of the photos in
// and under folders, the library and the collect folder - their thumbnails
// and what was read of their headers (photo_meta) - to be made again as
// they're shown. Ratings and sources are kept. progress is called as it goes.
func clearPhotoCache(folders []string, progress func(CacheClearProgress)) error {
	type sidecarCache struct {
		dir    string
		thumbs []string
	}
	sidecars := photoCacheSidecars(folders)
	caches := make([]sidecarCache, 0, len(sidecars))
	total := 0
	for _, sidecar := range sidecars {
		thumbs, _ := filepath.Glob(filepath.Join(sidecar, "thumbs", "*"))
		caches = append(caches, sidecarCache{sidecar, thumbs})
		total += len(thumbs) + 1 // the table
	}
	done := 0
	step := func() {
		done++
		progress(CacheClearProgress{done, total})
	}
	var errs []error
	for _, c := range caches {
		for _, thumb := range c.thumbs {
			if err := os.Remove(thumb); err != nil && !os.IsNotExist(err) {
				errs = append(errs, err)
			}
			step()
		}
		// Anything left, such as a thumbnail written meanwhile.
		if err := os.RemoveAll(filepath.Join(c.dir, "thumbs")); err != nil {
			errs = append(errs, err)
		}
		if db := openExistingDB(c.dir); db != nil {
			if _, err := db.Exec("DROP TABLE IF EXISTS photo_meta"); err != nil {
				errs = append(errs, fmt.Errorf("%s: %w", c.dir, err))
			}
			db.Close()
		}
		step()
	}
	return errors.Join(errs...)
}
