package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"transcription-app/internal/services"

	"github.com/go-chi/chi/v5"
)

func Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Transcription API is running"))
}

func Transcribe(w http.ResponseWriter, r *http.Request) {
	maxSize := int64(50 * 1024 * 1024)
	r.Body = http.MaxBytesReader(w, r.Body, maxSize)

	if err := r.ParseMultipartForm(maxSize); err != nil {
		http.Error(w, fmt.Sprintf("Error parsing form: %v", err), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("audio")
	if err != nil {
		http.Error(w, "No audio file uploaded", http.StatusBadRequest)
		return
	}
	defer file.Close()

	srcPath := filepath.Join(os.TempDir(), fmt.Sprintf("transcribe-%d%s", header.Size, filepath.Ext(header.Filename)))
	dstPath := srcPath + ".mp3"

	src, err := os.Create(srcPath)
	if err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	defer os.Remove(srcPath)

	if _, err := src.Seek(0, 0); err != nil {
		http.Error(w, "Failed to seek file", http.StatusInternalServerError)
		return
	}
	if _, err := src.ReadFrom(file); err != nil {
		http.Error(w, "Failed to write file", http.StatusInternalServerError)
		return
	}
	src.Close()

	transcribePath := srcPath
	if !services.IsMP3(header.Header.Get("Content-Type"), header.Filename) {
		log.Printf("Converting %s to MP3...", filepath.Ext(header.Filename))
		mp3Data, err := services.FFmpegToMP3(srcPath)
		if err != nil {
			log.Printf("Conversion error: %v", err)
			http.Error(w, "Failed to convert audio", http.StatusInternalServerError)
			return
		}
		if err := os.WriteFile(dstPath, mp3Data, 0644); err != nil {
			http.Error(w, "Failed to save converted file", http.StatusInternalServerError)
			return
		}
		defer os.Remove(dstPath)
		transcribePath = dstPath
		log.Printf("Converted to MP3, size: %d bytes", len(mp3Data))
	} else {
		log.Printf("File is already MP3, using directly")
	}

	provider := chi.URLParam(r, "provider")
	if provider == "" {
		provider = r.URL.Query().Get("provider")
	}

	var text string
	var transcribeErr error

	switch provider {
	case "xai":
		text, transcribeErr = services.TranscribeWithXAI(transcribePath)
	case "danarch":
		text, transcribeErr = services.TranscribeWithDanarch(transcribePath)
	default:
		text, transcribeErr = services.TranscribeWithOpenAI(transcribePath)
	}

	if transcribeErr != nil {
		log.Printf("Transcription error: %v", transcribeErr)
		http.Error(w, transcribeErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(text))
}