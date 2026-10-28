// Package store owns the one embedded Dolt engine used by a local Diggy process.
package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"sync"

	embedded "github.com/dolthub/driver/v2"
)

var ErrStale = errors.New("the project has changed; reload before saving")
var ErrNoRemote = errors.New("no origin remote configured")
var ErrDiverged = errors.New("local and remote histories have diverged")

type key struct{ Kind, Entity, Field string }
type cells map[key]string
type Project map[string]any

type Store struct {
	db          *sql.Conn
	pool        *sql.DB
	closeEngine func() error
	mu          sync.Mutex
}

func Open(ctx context.Context, directory, name, email string) (*Store, error) {
	return open(ctx, directory, name, email, "")
}

func Clone(ctx context.Context, directory, name, email, remote string) (*Store, error) {
	if _, err := os.Stat(filepath.Join(directory, "diggy")); !os.IsNotExist(err) {
		return nil, fmt.Errorf("clone destination already exists or cannot be accessed")
	}
	return open(ctx, directory, name, email, remote)
}

func open(ctx context.Context, directory, name, email, cloneURL string) (*Store, error) {
	directory, err := filepath.Abs(directory)
	if err != nil {
		return nil, err
	}
	if err = os.MkdirAll(directory, 0700); err != nil {
		return nil, err
	}
	params := url.Values{"commitname": {name}, "commitemail": {email}, "database": {"diggy"}}
	if cloneURL != "" {
		params.Del("database")
	}
	dsn := url.URL{Scheme: "file", Path: filepath.ToSlash(directory), RawQuery: params.Encode()}
	cfg, err := embedded.ParseDSN(dsn.String())
	if err != nil {
		return nil, err
	}
	connector, err := embedded.NewConnector(cfg)
	if err != nil {
		return nil, err
	}
	db := sql.OpenDB(connector)
	db.SetMaxOpenConns(1)
	conn, err := db.Conn(ctx)
	if err != nil {
		db.Close()
		connector.Close()
		return nil, err
	}
	s := &Store{db: conn, pool: db, closeEngine: connector.Close}
	if cloneURL != "" {
		if _, err = conn.ExecContext(ctx, "CALL DOLT_CLONE(?, 'diggy')", cloneURL); err != nil {
			s.Close()
			return nil, fmt.Errorf("clone: %w", err)
		}
	}
	// The driver deliberately discards pooled sessions. Retain one connection
	// so USE, transaction settings, and branch selection persist across operations.
	for _, query := range []string{
		"CREATE DATABASE IF NOT EXISTS diggy",
		"USE diggy",
		`CREATE TABLE IF NOT EXISTS diggy_cells (
			kind VARCHAR(32) NOT NULL,
			entity_id VARCHAR(160) NOT NULL,
			field_name VARCHAR(80) NOT NULL,
			value_json JSON NOT NULL,
			PRIMARY KEY (kind, entity_id, field_name)
		)`,
	} {
		if _, err = conn.ExecContext(ctx, query); err != nil {
			s.Close()
			return nil, fmt.Errorf("initialize Dolt (%s): %w", query, err)
		}
	}
	// Track the new table even before the first board edit.
	var count int
	if err = conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM dolt_status").Scan(&count); err == nil && count > 0 {
		_, err = conn.ExecContext(ctx, "CALL DOLT_ADD('diggy_cells')")
		if err == nil {
			_, err = conn.ExecContext(ctx, "CALL DOLT_COMMIT('-m', 'Initialize Diggy storage')")
		}
	}
	if err == nil {
		_, err = conn.ExecContext(ctx, "SET @@dolt_transaction_commit = 1")
	}
	if err != nil {
		s.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Remote(ctx context.Context, remote string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.db.ExecContext(ctx, "CALL DOLT_REMOTE('add', 'origin', ?)", remote)
	return err
}

func (s *Store) Sync(ctx context.Context, push bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.sync(ctx, push)
}

func (s *Store) sync(ctx context.Context, push bool) error {
	var branch string
	if err := s.db.QueryRowContext(ctx, "SELECT active_branch()").Scan(&branch); err != nil {
		return err
	}
	if push {
		_, err := s.db.ExecContext(ctx, "CALL DOLT_PUSH('--set-upstream', 'origin', ?)", branch)
		return err
	}
	if _, err := s.db.ExecContext(ctx, "CALL DOLT_FETCH('origin')"); err != nil {
		return err
	}
	_, err := s.db.ExecContext(ctx, "CALL DOLT_MERGE('--ff-only', ?)", "origin/"+branch)
	return err
}

// Exchange shares the engine's lock with saves, so no browser can write between
// the precondition check, pull, and push. Always return the resulting snapshot:
// a push failure can follow a successful pull.
func (s *Store) Exchange(ctx context.Context, expected string) (Project, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, err := s.read(ctx)
	if err != nil {
		return nil, "", err
	}
	p, err := expand(c)
	if err != nil {
		return nil, "", err
	}
	if expected != tag(p) {
		return p, tag(p), ErrStale
	}
	var count int
	if err = s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM dolt_remotes WHERE name = 'origin'").Scan(&count); err != nil {
		return p, tag(p), err
	}
	if count == 0 {
		return p, tag(p), ErrNoRemote
	}
	if _, err = s.db.ExecContext(ctx, "CALL DOLT_FETCH('origin')"); err == nil {
		var branch string
		err = s.db.QueryRowContext(ctx, "SELECT active_branch()").Scan(&branch)
		if err == nil {
			err = s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM dolt_remote_branches WHERE name = ?", "remotes/origin/"+branch).Scan(&count)
		}
		if err == nil && count > 0 {
			_, err = s.db.ExecContext(ctx, "CALL DOLT_MERGE('--ff-only', ?)", "origin/"+branch)
			if err != nil {
				err = fmt.Errorf("%w: %v", ErrDiverged, err)
			}
		}
		if err == nil {
			err = s.sync(ctx, true)
		}
	}
	c, readErr := s.read(ctx)
	if readErr != nil {
		return nil, "", errors.Join(err, readErr)
	}
	p, readErr = expand(c)
	if readErr != nil {
		return nil, "", errors.Join(err, readErr)
	}
	return p, tag(p), err
}

func (s *Store) Close() error {
	err := s.db.Close()
	return errors.Join(err, s.pool.Close(), s.closeEngine())
}

func (s *Store) read(ctx context.Context) (cells, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT kind, entity_id, field_name, value_json FROM diggy_cells")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := cells{}
	for rows.Next() {
		var k key
		var value string
		if err = rows.Scan(&k.Kind, &k.Entity, &k.Field, &value); err != nil {
			return nil, err
		}
		// Dolt may pretty-print JSON; canonicalize it before comparison/hashing.
		var v any
		if err = json.Unmarshal([]byte(value), &v); err != nil {
			return nil, err
		}
		b, _ := json.Marshal(v)
		result[k] = string(b)
	}
	return result, rows.Err()
}

func tag(p Project) string {
	b, _ := json.Marshal(p)
	return fmt.Sprintf(`"%x"`, sha256.Sum256(b))
}

func (s *Store) Load(ctx context.Context) (Project, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, err := s.read(ctx)
	if err != nil {
		return nil, "", err
	}
	p, err := expand(c)
	return p, tag(p), err
}

// Save writes only changed fields, in a single SQL transaction that also creates
// a Dolt commit. No revision counter or whole-project blob creates a merge hotspot.
func (s *Store) Save(ctx context.Context, p Project, expected string) (string, error) {
	next, err := flatten(p)
	if err != nil {
		return "", err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	before, err := s.read(ctx)
	if err != nil {
		return "", err
	}
	previous, err := expand(before)
	if err != nil {
		return "", err
	}
	if expected != tag(previous) {
		return "", ErrStale
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	for k, value := range next {
		if before[k] == value {
			continue
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO diggy_cells (kind, entity_id, field_name, value_json)
			VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)`, k.Kind, k.Entity, k.Field, value)
		if err != nil {
			return "", err
		}
	}
	for k := range before {
		if _, exists := next[k]; exists {
			continue
		}
		if _, err = tx.ExecContext(ctx, "DELETE FROM diggy_cells WHERE kind = ? AND entity_id = ? AND field_name = ?", k.Kind, k.Entity, k.Field); err != nil {
			return "", err
		}
	}
	if err = tx.Commit(); err != nil {
		return "", err
	}
	canonical, err := expand(next)
	return tag(canonical), err
}
