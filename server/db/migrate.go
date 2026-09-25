package db

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"path"
	"regexp"
	"sort"
	"strconv"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

const migrationsDir = "migrations"

var (
	upFilePattern   = regexp.MustCompile(`^(\d+)_.*\.up\.sql$`)
	downFilePattern = regexp.MustCompile(`^(\d+)_.*\.down\.sql$`)
)

// migrationFile pairs a version number with its embedded SQL filename.
type migrationFile struct {
	version int
	name    string
}

// loadMigrationFiles returns all embedded files matching pattern, sorted by
// version ascending.
func loadMigrationFiles(pattern *regexp.Regexp) ([]migrationFile, error) {
	entries, err := fs.ReadDir(migrationsFS, migrationsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read embedded migrations: %w", err)
	}

	var files []migrationFile
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		m := pattern.FindStringSubmatch(e.Name())
		if m == nil {
			continue
		}
		version, err := strconv.Atoi(m[1])
		if err != nil {
			return nil, fmt.Errorf("invalid migration version in filename %s: %w", e.Name(), err)
		}
		files = append(files, migrationFile{version: version, name: e.Name()})
	}

	sort.Slice(files, func(i, j int) bool { return files[i].version < files[j].version })
	return files, nil
}

func ensureMigrationsTable(dbConn *sql.DB) error {
	_, err := dbConn.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}
	return nil
}

// RunMigrations applies all pending versioned "up" migrations embedded in
// the binary, tracked in a schema_migrations table. Safe to call on every
// startup; already-applied versions are skipped. Each migration runs inside
// its own transaction, so a failing migration leaves the schema at the last
// successfully applied version rather than partially applied.
func RunMigrations(dbConn *sql.DB) error {
	if err := ensureMigrationsTable(dbConn); err != nil {
		return err
	}

	files, err := loadMigrationFiles(upFilePattern)
	if err != nil {
		return err
	}

	for _, f := range files {
		var alreadyApplied bool
		err := dbConn.QueryRow("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", f.version).Scan(&alreadyApplied)
		if err != nil {
			return fmt.Errorf("failed to check migration status for version %d: %w", f.version, err)
		}
		if alreadyApplied {
			continue
		}

		sqlBytes, err := migrationsFS.ReadFile(path.Join(migrationsDir, f.name))
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", f.name, err)
		}

		tx, err := dbConn.Begin()
		if err != nil {
			return fmt.Errorf("failed to start transaction for migration %s: %w", f.name, err)
		}

		if _, err := tx.Exec(string(sqlBytes)); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to apply migration %s: %w", f.name, err)
		}
		if _, err := tx.Exec("INSERT INTO schema_migrations (version) VALUES ($1)", f.version); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to record migration %s: %w", f.name, err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", f.name, err)
		}
		log.Printf("[migrate] applied %s", f.name)
	}

	return nil
}

// RollbackLastMigration reverses the most recently applied migration using
// its paired ".down.sql" file. Not invoked automatically at startup; intended
// for manual/maintenance use (e.g. a future CLI or ops script).
func RollbackLastMigration(dbConn *sql.DB) error {
	if err := ensureMigrationsTable(dbConn); err != nil {
		return err
	}

	var version int
	err := dbConn.QueryRow("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1").Scan(&version)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("no migrations have been applied")
		}
		return fmt.Errorf("failed to determine last applied migration: %w", err)
	}

	downFiles, err := loadMigrationFiles(downFilePattern)
	if err != nil {
		return err
	}

	var target *migrationFile
	for i := range downFiles {
		if downFiles[i].version == version {
			target = &downFiles[i]
			break
		}
	}
	if target == nil {
		return fmt.Errorf("no down migration found for version %d", version)
	}

	sqlBytes, err := migrationsFS.ReadFile(path.Join(migrationsDir, target.name))
	if err != nil {
		return fmt.Errorf("failed to read migration %s: %w", target.name, err)
	}

	tx, err := dbConn.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction for rollback of version %d: %w", version, err)
	}

	if _, err := tx.Exec(string(sqlBytes)); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to apply down migration %s: %w", target.name, err)
	}
	if _, err := tx.Exec("DELETE FROM schema_migrations WHERE version = $1", version); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to unrecord migration version %d: %w", version, err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit rollback of version %d: %w", version, err)
	}
	log.Printf("[migrate] rolled back %s", target.name)

	return nil
}

// ResetSchemaForTests drops and recreates the public schema, then reapplies
// all migrations from scratch. Used by tests that need a guaranteed-clean
// database, replacing the old pattern of each test re-executing a single
// hand-maintained SQL file directly.
func ResetSchemaForTests(dbConn *sql.DB) error {
	if _, err := dbConn.Exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"); err != nil {
		return fmt.Errorf("failed to reset schema for tests: %w", err)
	}
	return RunMigrations(dbConn)
}
