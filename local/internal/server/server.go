package server

import (
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"net/url"
	"strings"

	"diggy.local/app/internal/store"
)

func New(db *store.Store, web fs.FS, host string) http.Handler {
	files := http.FileServer(http.FS(web))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// There is deliberately no account system on this loopback-only service.
		// Check Host as well as Origin to prevent DNS rebinding / cross-site writes.
		if r.Host != host {
			http.Error(w, "invalid host", http.StatusForbidden)
			return
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		if origin := r.Header.Get("Origin"); origin != "" {
			u, err := url.Parse(origin)
			if err != nil || u.Scheme != "http" || u.Host != host {
				http.Error(w, "invalid origin", http.StatusForbidden)
				return
			}
		}
		if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
			http.Error(w, "cross-site request", http.StatusForbidden)
			return
		}
		if r.URL.Path != "/api/local/project" {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				http.NotFound(w, r)
				return
			}
			files.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.Method {
		case http.MethodGet:
			p, etag, err := db.Load(r.Context())
			if err != nil {
				fail(w, err)
				return
			}
			w.Header().Set("ETag", etag)
			json.NewEncoder(w).Encode(map[string]any{"project": p})
		case http.MethodPut:
			if r.Header.Get("If-Match") == "" {
				http.Error(w, `{"error":"If-Match is required"}`, http.StatusPreconditionRequired)
				return
			}
			media, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
			if media != "application/json" {
				http.Error(w, `{"error":"JSON required"}`, http.StatusUnsupportedMediaType)
				return
			}
			r.Body = http.MaxBytesReader(w, r.Body, 4<<20)
			var payload struct {
				Project store.Project `json:"project"`
			}
			decoder := json.NewDecoder(r.Body)
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&payload); err != nil {
				http.Error(w, `{"error":"Invalid project JSON"}`, http.StatusBadRequest)
				return
			}
			if decoder.Decode(new(any)) != io.EOF {
				http.Error(w, `{"error":"Unexpected trailing JSON"}`, http.StatusBadRequest)
				return
			}
			if err := store.Validate(payload.Project); err != nil {
				http.Error(w, `{"error":"Invalid project structure"}`, http.StatusBadRequest)
				return
			}
			etag, err := db.Save(r.Context(), payload.Project, r.Header.Get("If-Match"))
			if errors.Is(err, store.ErrStale) {
				http.Error(w, `{"error":"Reload before saving"}`, http.StatusPreconditionFailed)
				return
			}
			if err != nil {
				fail(w, err)
				return
			}
			w.Header().Set("ETag", etag)
			w.WriteHeader(http.StatusNoContent)
		default:
			w.Header().Set("Allow", "GET, PUT")
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
}

func fail(w http.ResponseWriter, err error) {
	log.Printf("local database: %v", err)
	http.Error(w, `{"error":"Could not access Dolt"}`, http.StatusInternalServerError)
}
