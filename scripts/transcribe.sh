#!/bin/bash

# Ensure DISPLAY is set for GUI applications (needed for notify-send)
export DISPLAY=${DISPLAY:-:0}

# Define variables for API endpoint and temp file
ENDPOINT="http://localhost:12050/api/transcribe"
MP3_FILE="/tmp/recording.mp3"
STATUS_FILE="/tmp/transcribe-status.json"
START_FILE="/tmp/transcribe-start.time"

# --- STATUS HELPERS ---
# Minimal JSON string escaper for preview/message fields
json_escape() {
  local s="$1"
  s=${s//\\/\\\\}   # escape backslashes
  s=${s//\"/\\\"}   # escape double quotes
  s=${s//$'\n'/\\n}   # newlines -> \n
  # Also guard against carriage returns/tabs
  s=${s//$'\r'/}
  s=${s//$'\t'/\\t}
  echo -n "$s"
}

write_status() {
  # usage: write_status <state> [duration] [preview] [message] [pid] [full_text]
  local state="$1"
  local duration="$2"
  local preview_raw="$3"
  local message_raw="$4"
  local pid_val="$5"
  local full_text_raw="$6"
  local ts=$(date +%s)

  local preview
  local message
  local full_text
  if [ -n "$preview_raw" ]; then
    preview="\"$(json_escape "$preview_raw")\""
  else
    preview=null
  fi
  if [ -n "$message_raw" ]; then
    message="\"$(json_escape "$message_raw")\""
  else
    message=null
  fi
  if [ -n "$full_text_raw" ]; then
    full_text="\"$(json_escape "$full_text_raw")\""
  else
    full_text=null
  fi
  if [ -z "$duration" ]; then
    duration=null
  fi
  if [ -z "$pid_val" ]; then
    pid_val=null
  fi

  printf '{"state":"%s","timestamp":%s,"duration":%s,"preview":%s,"message":%s,"pid":%s,"full_text":%s}\n' \
    "$state" "$ts" "$duration" "$preview" "$message" "$pid_val" "$full_text" > "$STATUS_FILE"
}

# --- TOGGLE LOGIC ---
# This script is designed to be run by a hotkey.
# - On first press: starts recording audio.
# - On second press (while recording): stops the recording.
# 
# How it works:
# - The first script instance starts ffmpeg and waits for it to finish (either by timeout or being killed).
# - If a second instance is started (by pressing the hotkey again), it detects ffmpeg is running, kills it, and exits.
# - The first instance resumes after ffmpeg exits (whether by timeout or being killed), and continues to process and transcribe the audio.

# Check if recording is already in progress using status file
if [ -f "$STATUS_FILE" ]; then
  if command -v jq >/dev/null 2>&1; then
    CURRENT_STATE=$(jq -r '.state // "idle"' "$STATUS_FILE" 2>/dev/null)
    CURRENT_PID=$(jq -r '.pid // ""' "$STATUS_FILE" 2>/dev/null)
  else
    CURRENT_STATE=$(grep -o '"state":"[^"]*' "$STATUS_FILE" | cut -d'"' -f4)
    CURRENT_PID=$(grep -o '"pid":"[^"]*' "$STATUS_FILE" | cut -d'"' -f4)
  fi
  
  if [ "$CURRENT_STATE" = "recording" ]; then
    # This is the "stop" action (second hotkey press)
    
    # Compute duration if we have a start timestamp
    if [ -f "$START_FILE" ]; then
      START_TS=$(cat "$START_FILE" 2>/dev/null || echo "")
    fi
    NOW_TS=$(date +%s)
    if [[ "$START_TS" =~ ^[0-9]+$ ]]; then
      DURATION=$((NOW_TS - START_TS))
    else
      DURATION=""
    fi

    write_status "processing" "$DURATION" "" "" "$CURRENT_PID"

    # Kill the recording process - prefer stored PID, fallback to pattern
    if [ -n "$CURRENT_PID" ] && [ "$CURRENT_PID" != "null" ] && [ "$CURRENT_PID" != "" ]; then
      kill -TERM "$CURRENT_PID" 2>/dev/null
    else
      pkill -f "ffmpeg.*$MP3_FILE"
    fi

    # Wait briefly to ensure ffmpeg has stopped
    sleep 2

    # Exit this script instance; the original instance will handle processing
    exit 0
  fi
fi

# This is the "start" action (first hotkey press)
# Status indicator will show recording state

# Start recording audio from PulseAudio directly to MP3 for up to 60 seconds
# Run ffmpeg in the background so we can capture PID and update status
ffmpeg -f pulse -i default -t 60 -codec:a libmp3lame -y "$MP3_FILE" 2>/dev/null &
FFMPEG_PID=$!
date +%s > "$START_FILE"
write_status "recording" "" "" "" "$FFMPEG_PID"

# Wait for recording to end (either timeout or killed by toggle)
wait "$FFMPEG_PID" 2>/dev/null

# After recording ends (either by timeout or being killed), continue:
# Check if we got any audio
if [ ! -f "$MP3_FILE" ] || [ ! -s "$MP3_FILE" ]; then
  write_status "error" "" "" "No audio captured" ""
  exit 1
fi

# Processing will be shown in status indicator

# Update status to processing and compute duration if possible
if [ -f "$START_FILE" ]; then
  START_TS=$(cat "$START_FILE" 2>/dev/null || echo "")
fi
NOW_TS=$(date +%s)
if [[ "$START_TS" =~ ^[0-9]+$ ]]; then
  DURATION=$((NOW_TS - START_TS))
else
  DURATION=""
fi
write_status "processing" "$DURATION" "" "" "$$"

# Send the MP3 file to the transcription API endpoint
RESPONSE=$(curl -s -X POST "$ENDPOINT" -F "audio=@$MP3_FILE")

# Check if the API response is empty
if [ -z "$RESPONSE" ]; then
  write_status "error" "$DURATION" "" "Empty response from server" "$$"
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

# Update status to done with a short preview
PREVIEW="${RESPONSE:0:60}"
write_status "done" "$DURATION" "$PREVIEW" "" "$$" "$RESPONSE"

# Success - result is in clipboard and status shows completion