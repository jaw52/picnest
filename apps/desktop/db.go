package main

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

// sidecarDirName is created inside every folder the user opens. It holds the
// ratings database and the thumbnail cache, and never touches originals.
const sidecarDirName = ".picnest"

var recordTables = []string{"ratings", "photo_size"}

func sidecarDir(folder string) string {
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
		CREATE TABLE IF NOT EXISTS photo_size (
			file_name TEXT PRIMARY KEY,
			width     INTEGER NOT NULL,
			height    INTEGER NOT NULL,
			size      INTEGER NOT NULL,
			mtime     INTEGER NOT NULL
		);`)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to create table: %w", err)
	}
	return db, nil
}

// cachedPhotoMeta holds dimensions from a previous scan. It is only valid
// while size and mtime still match the file on disk.
type cachedPhotoMeta struct {
	Width, Height int
	Size, Mtime   int64
}

func getAllPhotoMeta(db *sql.DB) (map[string]cachedPhotoMeta, error) {
	rows, err := db.Query("SELECT file_name, width, height, size, mtime FROM photo_size")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]cachedPhotoMeta{}
	for rows.Next() {
		var name string
		var m cachedPhotoMeta
		if err := rows.Scan(&name, &m.Width, &m.Height, &m.Size, &m.Mtime); err != nil {
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
		_, err := tx.Exec(`INSERT INTO photo_size (file_name, width, height, size, mtime) VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(file_name) DO UPDATE SET width = excluded.width, height = excluded.height,
				size = excluded.size, mtime = excluded.mtime`,
			e.FileName, e.Width, e.Height, e.Size, e.Mtime)
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
		return fmt.Errorf("rating must be between 0 and 5")
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
