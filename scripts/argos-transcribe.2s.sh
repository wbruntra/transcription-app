#!/usr/bin/env bash

# Argos script: place as ~/.config/argos/transcribe.2s.sh
# Shows the current transcription status from /tmp/transcribe-status.json
# Refreshes every 2 seconds (because of .2s in filename)

STATUS_FILE="/tmp/transcribe-status.json"
STALE_AFTER=120 # seconds after which we treat status as stale/idle

now=$(date +%s)
state="idle"
icon="" # fallback microphone icon (Font Awesome if available)
label="Idle"
preview=""
message=""
pid=""

if [ -f "$STATUS_FILE" ]; then
  # Read fields safely with jq if available; otherwise grep/awk
  if command -v jq >/dev/null 2>&1; then
    ts=$(jq -r '.timestamp // 0' "$STATUS_FILE" 2>/dev/null)
    state=$(jq -r '.state // "idle"' "$STATUS_FILE" 2>/dev/null)
    duration=$(jq -r '.duration // null' "$STATUS_FILE" 2>/dev/null)
    preview=$(jq -r '.preview // ""' "$STATUS_FILE" 2>/dev/null)
    message=$(jq -r '.message // ""' "$STATUS_FILE" 2>/dev/null)
    pid=$(jq -r '.pid // ""' "$STATUS_FILE" 2>/dev/null)
  else
    # best-effort parse for systems without jq
    ts=$(grep -o '"timestamp":[0-9]*' "$STATUS_FILE" | head -n1 | cut -d: -f2)
    state=$(grep -o '"state":"[^"]*' "$STATUS_FILE" | cut -d'"' -f4)
    duration=""
    preview=""
    message=""
    pid=""
  fi

  # Staleness check
  if [ -n "$ts" ] && [ "$ts" -gt 0 ] && [ $((now - ts)) -gt $STALE_AFTER ]; then
    state="idle"
  fi
fi

case "$state" in
  recording)
    icon="🎤"
    label="Rec"
    ;;
  processing)
    icon="🔄"
    label="Proc"
    ;;
  done)
    icon="✅"
    label="Done"
    ;;
  error)
    icon="❌"
    label="Err"
    ;;
  *)
    icon="🎙️"
    label="Idle"
    ;;
  esac

# Top bar label (keep it short)
echo "$icon $label"

echo "---"
# Detail section in dropdown menu
if [ -n "$preview" ]; then
  echo "Preview: ${preview:0:80}"
fi
if [ -n "$message" ]; then
  echo "Msg: ${message}"
fi
# Show last update time
if [ -n "$ts" ]; then
  human=$(date -d @"$ts" '+%H:%M:%S')
  echo "Updated: $human"
fi

# Actions
# Prefer killing by stored PID when recording
if [ "$state" = "recording" ] && [ -n "$pid" ] && [ "$pid" != "null" ]; then
  echo "Stop Recording (PID $pid) | bash=kill param1=-TERM param2=$pid terminal=false"
elif [ "$state" = "recording" ]; then
  # Fallback if PID missing: pattern kill (less precise)
  echo "Stop Recording | bash=pkill param1=-f param2=ffmpeg.*\/tmp\/recording.mp3 terminal=false"
fi

# Add "Copy Last Result" if we have a preview from done state
if [ "$state" = "done" ] && [ -n "$preview" ]; then
  echo "Copy Last Result | bash=-c param1='echo \"$preview\" | xclip -selection clipboard' terminal=false"
fi

# Quick action: open status file
if command -v xdg-open >/dev/null 2>&1; then
  echo "Open Status File | bash=xdg-open param1=$STATUS_FILE terminal=false"
fi

# Refresh action
echo "Refresh | refresh=true"
