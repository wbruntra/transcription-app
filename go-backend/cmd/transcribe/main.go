package main

import (
	"fmt"
	"log"
	"os"

	"transcription-app/internal/services"

	"github.com/joho/godotenv"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: go run cmd/transcribe/main.go <audio-file>")
	}

	godotenv.Load("../.env")
	godotenv.Load("../backend/.env")

	if os.Getenv("OPENAI_API_KEY") == "" {
		log.Fatal("OPENAI_API_KEY not set")
	}

	filePath := os.Args[1]
	text, err := services.TranscribeWithOpenAI(filePath)
	if err != nil {
		log.Fatalf("Error: %v", err)
	}

	fmt.Println(text)
}