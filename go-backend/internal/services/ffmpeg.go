package services

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

func IsMP3(mimetype, filename string) bool {
	mt := strings.ToLower(mimetype)
	fn := strings.ToLower(filename)
	return mt == "audio/mpeg" || mt == "audio/mp3" || strings.HasSuffix(fn, ".mp3")
}

func FFmpegToMP3(inputPath string) ([]byte, error) {
	outPath := inputPath + ".mp3"

	cmd := exec.Command("ffmpeg", "-y", "-i", inputPath, "-f", "mp3", outPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("ffmpeg conversion failed: %w\n%s", err, string(output))
	}
	defer os.Remove(outPath)

	return os.ReadFile(outPath)
}