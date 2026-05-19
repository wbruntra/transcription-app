package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"transcription-app/internal/handlers"
	"transcription-app/internal/middleware"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()
	godotenv.Load(".env.local")

	port := os.Getenv("PORT")
	if port == "" {
		port = "12050"
	}

	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(middleware.CORS)

	r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte("pong"))
	})

	r.Get("/api", handlers.Health)
	r.Post("/api/transcribe", handlers.Transcribe)

	staticDir := filepath.Join("..", "client", "dist")
	if info, err := os.Stat(staticDir); err == nil && info.IsDir() {
		r.Get("/*", middleware.SPAFallback(staticDir))
		log.Printf("Serving static files from %s", staticDir)
	}

	log.Printf("Backend server running at http://localhost:%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}