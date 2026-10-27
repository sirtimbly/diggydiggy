package server

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"diggy.local/app/internal/store"
)

func TestLocalAPIAndOriginBoundary(t *testing.T) {
	db, err := store.Open(context.Background(), t.TempDir(), "Test", "test@example.invalid")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	handler := New(db, fstest.MapFS{"index.html": {Data: []byte("Diggy web app")}}, "127.0.0.1:4180")
	for _, tc := range []struct {
		method, path, host, origin, body string
		status                           int
	}{
		{"GET", "/", "127.0.0.1:4180", "", "", 200},
		{"GET", "/api/local/project", "evil.example", "", "", 403},
		{"PUT", "/api/local/project", "127.0.0.1:4180", "https://evil.example", "{}", 403},
		{"PUT", "/api/local/project", "127.0.0.1:4180", "", "{}", 428},
		{"GET", "/api/auth/session", "127.0.0.1:4180", "", "", 404},
	} {
		r := httptest.NewRequest(tc.method, "http://"+tc.host+tc.path, strings.NewReader(tc.body))
		r.Host = tc.host
		r.Header.Set("Origin", tc.origin)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Fatalf("%s %s: %d, %s", tc.method, tc.path, w.Code, w.Body)
		}
	}
	r := httptest.NewRequest("GET", "http://127.0.0.1:4180/api/local/project", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 200 || w.Header().Get("ETag") == "" {
		t.Fatal("missing initial snapshot / ETag")
	}
	initial := w.Header().Get("ETag")
	body := `{"project":{"version":1,"layoutVersion":3,"name":"Saved","blocks":[],"crew":[],"dividers":[],"colorLegend":{},"excavations":[]}}`
	for i, status := range []int{204, 412} {
		r = httptest.NewRequest("PUT", "http://127.0.0.1:4180/api/local/project", strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("If-Match", initial)
		w = httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("write %d: %d %s", i, w.Code, w.Body)
		}
	}
}
