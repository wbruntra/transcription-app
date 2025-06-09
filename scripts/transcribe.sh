#!/bin/bash

# Ensure DISPLAY is set for GUI applications (needed for notify-send)
export DISPLAY=${DISPLAY:-:0}

# Define variables for API endpoint and temp file
ENDPOINT="http://localhost:12050/api/transcribe"
MP3_FILE="/tmp/recording.mp3"

# --- TOGGLE LOGIC ---
# This script is designed to be run by a hotkey.
# - On first press: starts recording audio.
# - On second press (while recording): stops the recording.
# 
# How it works:
# - The first script instance starts ffmpeg and waits for it to finish (either by timeout or being killed).
# - If a second instance is started (by pressing the hotkey again), it detects ffmpeg is running, kills it, and exits.
# - The first instance resumes after ffmpeg exits (whether by timeout or being killed), and continues to process and transcribe the audio.

# Check if ffmpeg is already recording our file (i.e., recording is in progress)
if pgrep -f "ffmpeg.*$MP3_FILE" > /dev/null; then
  # This is the "stop" action (second hotkey press)
  # notify-send "🛑 Stop recording..." -t 2000

  # Kill the running ffmpeg process (stops the recording)
  pkill -f "ffmpeg.*$MP3_FILE"

  # Wait briefly to ensure ffmpeg has stopped
  sleep 2

  # Exit this script instance; the original instance will handle processing
  exit 0
fi

# This is the "start" action (first hotkey press)
notify-send "🎤 Recording started!" "Press shortcut again to STOP" -t 2000

# Start recording audio from PulseAudio directly to MP3 for up to 60 seconds
ffmpeg -f pulse -i default -t 60 -codec:a libmp3lame -y "$MP3_FILE" 2>/dev/null

# After recording ends (either by timeout or being killed), continue:
# Check if we got any audio
if [ ! -f "$MP3_FILE" ] || [ ! -s "$MP3_FILE" ]; then
  notify-send "❌ Recording failed" "No audio captured"
  exit 1
fi

notify-send "🔄 Processing..." "Transcribing audio" -t 1000

# Send the MP3 file to the transcription API endpoint
RESPONSE=$(curl -s -X POST "$ENDPOINT" -F "audio=@$MP3_FILE")

# Check if the API response is empty
if [ -z "$RESPONSE" ]; then
  notify-send "❌ Transcription failed" "Empty response from server"
  rm -f "$MP3_FILE"
  exit 1
fi

# Copy the transcription result to the clipboard
echo "$RESPONSE" | xclip -selection clipboard

# Optional: simulate Ctrl+V to paste the result (may depend on focus)
sleep 0.6
xdotool key ctrl+v

# Clean up temporary file
rm -f "$MP3_FILE"

# Notify the user of success, showing the first 30 characters of the transcription
notify-send "✅ Done!" "${RESPONSE:0:30}..." -t 800