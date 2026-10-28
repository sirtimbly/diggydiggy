package store

import (
	"context"
	"encoding/json"
	"errors"
	"os/exec"
	"path/filepath"
	"testing"
)

func board(t *testing.T) Project {
	t.Helper()
	var p Project
	err := json.Unmarshal([]byte(`{"version":1,"layoutVersion":3,"name":"Local test","blocks":[{"id":"block-1","code":"DIG-01","title":"One","note":"","x":0,"y":0,"size":"medium","color":"amber","uncertainty":0,"progress":0,"done":false,"people":["person-1"],"dependency":"","dependencies":[]}],"crew":[{"id":"person-1","name":"One"}],"dividers":[],"colorLegend":{},"excavations":[],"selected":null}`), &p)
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func TestPersistenceHistoryAndStaleWrites(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	s, err := Open(ctx, dir, "Test", "test@example.invalid")
	if err != nil {
		t.Fatal(err)
	}
	_, original, err := s.Load(ctx)
	if err != nil {
		t.Fatal(err)
	}
	p := board(t)
	etag, err := s.Save(ctx, p, original)
	if err != nil {
		t.Fatal(err)
	}
	loaded, loadedTag, err := s.Load(ctx)
	if err != nil || etag != loadedTag {
		t.Fatalf("load: tag %s vs %s, %v", etag, loadedTag, err)
	}
	if tag(p) != tag(loaded) {
		t.Fatalf("round trip changed project: %#v", loaded)
	}
	if _, err := s.Save(ctx, p, original); !errors.Is(err, ErrStale) {
		t.Fatalf("stale write accepted: %v", err)
	}
	var count int
	if err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM dolt_log").Scan(&count); err != nil || count < 2 {
		t.Fatalf("missing Dolt history: %d, %v", count, err)
	}
	p["name"] = "Renamed"
	newTag, err := s.Save(ctx, p, etag)
	if err != nil {
		t.Fatal(err)
	}
	// A metadata edit must not rewrite blocks or relationship records.
	var changed int
	if err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM dolt_diff('HEAD~1', 'HEAD', 'diggy_cells')").Scan(&changed); err != nil || changed != 1 {
		t.Fatalf("expected one changed field, got %d: %v", changed, err)
	}
	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	s, err = Open(ctx, dir, "Test", "test@example.invalid")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	loaded, loadedTag, err = s.Load(ctx)
	if err != nil || loadedTag != newTag || loaded["name"] != "Renamed" {
		t.Fatalf("restart lost project: %v %v", loaded, err)
	}
}

func TestCodecSeparatesRelationshipsAndRejectsBadShapes(t *testing.T) {
	p := board(t)
	c, err := flatten(p)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := c[key{"people", "block-1", "person-1"}]; !ok {
		t.Fatal("assignment was not normalized")
	}
	delete(p, "blocks")
	if _, err := flatten(p); err == nil {
		t.Fatal("missing blocks accepted")
	}
}

func exchange(t *testing.T, s *Store) {
	t.Helper()
	ctx := context.Background()
	_, etag, err := s.Load(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err = s.Exchange(ctx, etag); err != nil {
		t.Fatal(err)
	}
}

func TestGitRemotePushCloneAndFastForwardPull(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git required")
	}
	ctx := context.Background()
	remote := filepath.Join(t.TempDir(), "remote.git")
	for _, args := range [][]string{
		{"init", "-b", "main", remote},
		{"-C", remote, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-m", "Seed Git remote"},
	} {
		if out, err := exec.Command("git", args...).CombinedOutput(); err != nil {
			t.Fatalf("git: %s %v", out, err)
		}
	}
	aDir, bDir := t.TempDir(), t.TempDir()
	a, err := Open(ctx, aDir, "A", "a@example.invalid")
	if err != nil {
		t.Fatal(err)
	}
	_, initial, _ := a.Load(ctx)
	p := board(t)
	if _, err = a.Save(ctx, p, initial); err != nil {
		t.Fatal(err)
	}
	if err = a.Remote(ctx, remote); err != nil {
		t.Fatal(err)
	}
	exchange(t, a)
	if err = a.Close(); err != nil {
		t.Fatal(err)
	}
	b, err := Clone(ctx, bDir, "B", "b@example.invalid", remote)
	if err != nil {
		t.Fatal(err)
	}
	loaded, etag, err := b.Load(ctx)
	if err != nil || loaded["name"] != p["name"] {
		t.Fatalf("clone: %v, %v", loaded, err)
	}
	loaded["name"] = "From B"
	if _, err = b.Save(ctx, loaded, etag); err != nil {
		t.Fatal(err)
	}
	exchange(t, b)
	if err = b.Close(); err != nil {
		t.Fatal(err)
	}
	a, err = Open(ctx, aDir, "A", "a@example.invalid")
	if err != nil {
		t.Fatal(err)
	}
	exchange(t, a)
	loaded, _, err = a.Load(ctx)
	if err != nil || loaded["name"] != "From B" {
		t.Fatalf("pull: %v, %v", loaded, err)
	}
	// Both machines now change the shared ancestor. First-pass pull must refuse
	// even independent changes, leaving the local board and history untouched.
	_, etag, _ = a.Load(ctx)
	loaded["name"] = "Local A"
	if _, err = a.Save(ctx, loaded, etag); err != nil {
		t.Fatal(err)
	}
	if err = a.Close(); err != nil {
		t.Fatal(err)
	}
	b, err = Open(ctx, bDir, "B", "b@example.invalid")
	if err != nil {
		t.Fatal(err)
	}
	loaded, etag, _ = b.Load(ctx)
	loaded["subtitle"] = "Remote B"
	if _, err = b.Save(ctx, loaded, etag); err != nil {
		t.Fatal(err)
	}
	if err = b.Sync(ctx, true); err != nil {
		t.Fatal(err)
	}
	if err = b.Close(); err != nil {
		t.Fatal(err)
	}
	a, err = Open(ctx, aDir, "A", "a@example.invalid")
	if err != nil {
		t.Fatal(err)
	}
	defer a.Close()
	_, etag, _ = a.Load(ctx)
	if _, _, err = a.Exchange(ctx, etag); !errors.Is(err, ErrDiverged) {
		t.Fatalf("expected divergent history refusal, got %v", err)
	}
	loaded, _, err = a.Load(ctx)
	if err != nil || loaded["name"] != "Local A" || loaded["subtitle"] != nil {
		t.Fatalf("failed pull changed local board: %v, %v", loaded, err)
	}
}
