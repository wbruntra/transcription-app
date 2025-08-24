#!/usr/bin/env bash

# Same as transcribe.2s.sh but intended to refresh every 1s.
# Place as ~/.config/argos/transcribe.1s.sh for faster updates.

STATUS_FILE="/tmp/transcribe-status.json"
STALE_AFTER=120

now=$(date +%s)
state="idle"
icon="🎙️"
label="Idle"
preview=""
message=""
pid=""
full_text=""

if [ -f "$STATUS_FILE" ]; then
  if command -v jq >/dev/null 2>&1; then
    ts=$(jq -r '.timestamp // 0' "$STATUS_FILE" 2>/dev/null)
    state=$(jq -r '.state // "idle"' "$STATUS_FILE" 2>/dev/null)
    duration=$(jq -r '.duration // null' "$STATUS_FILE" 2>/dev/null)
    preview=$(jq -r '.preview // ""' "$STATUS_FILE" 2>/dev/null)
    message=$(jq -r '.message // ""' "$STATUS_FILE" 2>/dev/null)
    pid=$(jq -r '.pid // ""' "$STATUS_FILE" 2>/dev/null)
    full_text=$(jq -r '.full_text // ""' "$STATUS_FILE" 2>/dev/null)
  else
    ts=$(grep -o '"timestamp":[0-9]*' "$STATUS_FILE" | head -n1 | cut -d: -f2)
    state=$(grep -o '"state":"[^"]*' "$STATUS_FILE" | cut -d'"' -f4)
  fi
  if [ -n "$ts" ] && [ "$ts" -gt 0 ] && [ $((now - ts)) -gt $STALE_AFTER ]; then
    state="idle"
  fi
fi

case "$state" in
  recording)
    icon="🎤"; label="Rec" ;;
  processing)
    icon="🔄"; label="Proc" ;;
  done)
    icon="✅"; label="Done" ;;
  error)
    icon="❌"; label="Err" ;;
  *)
    icon="🎙️"; label="Idle" ;;
 esac

echo "$icon $label"
echo "---"
[ -n "$preview" ] && echo "Preview: ${preview:0:80}"
[ -n "$message" ] && echo "Msg: ${message}"
[ -n "$ts" ] && echo "Updated: $(date -d @"$ts" '+%H:%M:%S')"

if [ "$state" = "recording" ] && [ -n "$pid" ] && [ "$pid" != "null" ]; then
  echo "Stop Recording (PID $pid) | bash=kill param1=-TERM param2=$pid terminal=false"
elif [ "$state" = "recording" ]; then
  echo "Stop Recording | bash=pkill param1=-f param2=ffmpeg.*\/tmp\/recording.mp3 terminal=false"
fi

# Add "Copy Last Result" if we have full text from done state
if [ "$state" = "done" ] && [ -n "$full_text" ] && [ "$full_text" != "null" ]; then
  echo "Copy Last Result | bash=-c param1='echo \"$full_text\" | xclip -selection clipboard' terminal=false"
fi

echo "Open Status File | bash=xdg-open param1=$STATUS_FILE terminal=false"
echo "Refresh | refresh=true"
