# macOS Setup Guide for Transcription App

This guide will help you set up the transcription app on macOS, including the backend server, keyboard shortcuts, and audio recording functionality.

## Prerequisites

### 1. Install Homebrew (if not already installed)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install Required Tools

#### Install Node.js or Bun
Choose one:

**Option A: Node.js (Recommended for stability)**
```bash
brew install node
```

**Option B: Bun (Faster, more modern)**
```bash
brew install oven-sh/bun/bun
```

#### Install FFmpeg
FFmpeg is fully supported on macOS and available via Homebrew:
```bash
brew install ffmpeg
```

#### Install jq (for JSON parsing)
```bash
brew install jq
```

## Backend Setup

1. **Navigate to the project directory**
```bash
cd /path/to/transcription-app
```

2. **Install dependencies**

If using Node.js:
```bash
npm install
```

If using Bun:
```bash
bun install
```

3. **Configure your OpenAI API key**
Create a `.env` file in the project root or set the environment variable:
```bash
export OPENAI_API_KEY='your-api-key-here'
```

4. **Start the backend server**

If using Node.js:
```bash
npm run server
```

If using Bun:
```bash
bun run server
```

The server will run on `http://localhost:12050`

## macOS Transcription Script

Create a new file `scripts/transcribe-macos.sh`:

```bash
#!/bin/bash

# Ensure proper environment for GUI applications
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# Define variables for API endpoint and temp file
ENDPOINT="http://localhost:12050/api/transcribe"
MP3_FILE="/tmp/recording.mp3"
STATUS_FILE="/tmp/transcribe-status.json"
START_FILE="/tmp/transcribe-start.time"

# --- STATUS HELPERS ---
json_escape() {
  local s="$1"
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/}
  s=${s//$'\t'/\\t}
  echo -n "$s"
}

write_status() {
  local state="$1"
  local duration="$2"
  local preview_raw="$3"
  local message_raw="$4"
  local pid_val="$5"
  local full_text_raw="$6"
  local ts=$(date +%s)

  local preview message full_text
  [ -n "$preview_raw" ] && preview="\"$(json_escape "$preview_raw")\"" || preview=null
  [ -n "$message_raw" ] && message="\"$(json_escape "$message_raw")\"" || message=null
  [ -n "$full_text_raw" ] && full_text="\"$(json_escape "$full_text_raw")\"" || full_text=null
  [ -z "$duration" ] && duration=null
  [ -z "$pid_val" ] && pid_val=null

  printf '{"state":"%s","timestamp":%s,"duration":%s,"preview":%s,"message":%s,"pid":%s,"full_text":%s}\n' \
    "$state" "$ts" "$duration" "$preview" "$message" "$pid_val" "$full_text" > "$STATUS_FILE"
}

# --- TOGGLE LOGIC ---
if [ -f "$STATUS_FILE" ]; then
  CURRENT_STATE=$(jq -r '.state // "idle"' "$STATUS_FILE" 2>/dev/null)
  CURRENT_PID=$(jq -r '.pid // ""' "$STATUS_FILE" 2>/dev/null)
  
  if [ "$CURRENT_STATE" = "recording" ]; then
    # Stop recording
    if [ -f "$START_FILE" ]; then
      START_TS=$(cat "$START_FILE" 2>/dev/null || echo "")
    fi
    NOW_TS=$(date +%s)
    [[ "$START_TS" =~ ^[0-9]+$ ]] && DURATION=$((NOW_TS - START_TS)) || DURATION=""

    write_status "processing" "$DURATION" "" "" "$CURRENT_PID"

    if [ -n "$CURRENT_PID" ] && [ "$CURRENT_PID" != "null" ] && [ "$CURRENT_PID" != "" ]; then
      kill -TERM "$CURRENT_PID" 2>/dev/null
    else
      pkill -f "ffmpeg.*$MP3_FILE"
    fi

    sleep 2
    exit 0
  fi
fi

# Start recording - macOS uses 'coreaudio' device instead of 'pulse'
# Record from default input device for up to 60 seconds
ffmpeg -f avfoundation -i ":default" -t 60 -codec:a libmp3lame -y "$MP3_FILE" 2>/dev/null &
FFMPEG_PID=$!
date +%s > "$START_FILE"
write_status "recording" "" "" "" "$FFMPEG_PID"

# Display notification that recording started
osascript -e 'display notification "Recording started..." with title "Transcription"'

# Wait for recording to end
wait "$FFMPEG_PID" 2>/dev/null

# Check if we got any audio
if [ ! -f "$MP3_FILE" ] || [ ! -s "$MP3_FILE" ]; then
  write_status "error" "" "" "No audio captured" ""
  osascript -e 'display notification "No audio captured" with title "Transcription Error"'
  exit 1
fi

# Processing notification
osascript -e 'display notification "Processing transcription..." with title "Transcription"'

# Compute duration
if [ -f "$START_FILE" ]; then
  START_TS=$(cat "$START_FILE" 2>/dev/null || echo "")
fi
NOW_TS=$(date +%s)
[[ "$START_TS" =~ ^[0-9]+$ ]] && DURATION=$((NOW_TS - START_TS)) || DURATION=""
write_status "processing" "$DURATION" "" "" "$$"

# Send to transcription API
RESPONSE=$(curl -s -X POST "$ENDPOINT" -F "audio=@$MP3_FILE")

if [ -z "$RESPONSE" ]; then
  write_status "error" "$DURATION" "" "Empty response from server" "$$"
  osascript -e 'display notification "Server error" with title "Transcription Error"'
  rm -f "$MP3_FILE"
  exit 1
fi

# Copy to clipboard (macOS uses pbcopy)
echo "$RESPONSE" | pbcopy

# Auto-paste the result (⌘+V)
sleep 0.6
osascript -e 'tell application "System Events" to keystroke "v" using command down'

# Clean up
rm -f "$MP3_FILE"

# Success notification
PREVIEW="${RESPONSE:0:60}"
write_status "done" "$DURATION" "$PREVIEW" "" "$$" "$RESPONSE"
osascript -e "display notification \"$PREVIEW\" with title \"Transcription Complete\""
```

Make the script executable:
```bash
chmod +x scripts/transcribe-macos.sh
```

## Setting Up Keyboard Shortcuts on macOS

macOS has several options for creating global keyboard shortcuts:

### Option 1: Using Automator + Keyboard Shortcut (Recommended)

1. **Create an Automator Quick Action**
   - Open **Automator** (found in Applications)
   - Choose **Quick Action** (or "Service" in older macOS versions)
   - Set "Workflow receives" to **no input** in **any application**
   - Add a "Run Shell Script" action
   - Set shell to `/bin/bash`
   - Paste this code:
   ```bash
   export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
   /path/to/transcription-app/scripts/transcribe-macos.sh > /tmp/transcribe.log 2>&1
   ```
   - Replace `/path/to/transcription-app` with your actual path
   - Save as "Voice Transcription" (or any name you prefer)

2. **Assign a Keyboard Shortcut**
   - Go to **System Settings** > **Keyboard** > **Keyboard Shortcuts** > **Services**
   - Scroll down to **General** section
   - Find "Voice Transcription" in the list
   - Click on it and click "Add Shortcut"
   - Press your desired key combination (e.g., ⌃⌥U for Ctrl+Option+U)

### Option 2: Using BetterTouchTool (Third-party, more powerful)

If you use [BetterTouchTool](https://folivora.ai/):
1. Install BetterTouchTool
2. Add a new keyboard shortcut
3. Set it to execute shell script:
   ```bash
   /path/to/transcription-app/scripts/transcribe-macos.sh
   ```

### Option 3: Using Hammerspoon (Free, scriptable)

Install [Hammerspoon](https://www.hammerspoon.org/):
```bash
brew install hammerspoon --cask
```

Add to your `~/.hammerspoon/init.lua`:
```lua
hs.hotkey.bind({"ctrl", "alt"}, "U", function()
  hs.task.new("/path/to/transcription-app/scripts/transcribe-macos.sh", nil):start()
  hs.notify.new({title="Transcription", informativeText="Started"}):send()
end)
```

Then reload Hammerspoon configuration.

## Audio Input Notes for macOS

### Check Available Audio Devices
```bash
ffmpeg -f avfoundation -list_devices true -i ""
```

This will list all available audio and video devices.

### Select a Specific Microphone
If you want to use a specific microphone instead of the default:
```bash
# In the script, replace:
ffmpeg -f avfoundation -i ":default" ...

# With (using device index from list_devices):
ffmpeg -f avfoundation -i ":0" ...
# Or by name:
ffmpeg -f avfoundation -i ":Built-in Microphone" ...
```

### Permissions
macOS will prompt for microphone access the first time you run the script. Make sure to grant permission to:
- Terminal (if running from terminal)
- Automator (if using Automator)
- Hammerspoon (if using Hammerspoon)

Go to **System Settings** > **Privacy & Security** > **Microphone** to manage permissions.

## Status Menu Bar Indicator (Optional)

macOS doesn't have a direct equivalent to GNOME's Argos extension, but you can:

### Option 1: SwiftBar (Similar to Argos)
1. Install SwiftBar:
   ```bash
   brew install swiftbar --cask
   ```

2. Create a SwiftBar plugin `~/.swiftbar/transcribe.2s.sh`:
   ```bash
   #!/bin/bash
   
   STATUS_FILE="/tmp/transcribe-status.json"
   
   if [ ! -f "$STATUS_FILE" ]; then
     echo "🎤 Idle"
     exit 0
   fi
   
   STATE=$(jq -r '.state // "idle"' "$STATUS_FILE" 2>/dev/null)
   PREVIEW=$(jq -r '.preview // ""' "$STATUS_FILE" 2>/dev/null)
   
   case "$STATE" in
     recording)
       echo "🔴 Rec"
       echo "---"
       echo "Recording in progress..."
       ;;
     processing)
       echo "⚙️ Proc"
       echo "---"
       echo "Processing transcription..."
       ;;
     done)
       echo "✅ Done"
       echo "---"
       echo "$PREVIEW"
       ;;
     error)
       echo "❌ Err"
       ;;
     *)
       echo "🎤 Idle"
       ;;
   esac
   ```
   
3. Make it executable:
   ```bash
   chmod +x ~/.swiftbar/transcribe.2s.sh
   ```

### Option 2: BitBar (SwiftBar predecessor)
Similar setup to SwiftBar, but less actively maintained.

## Testing

1. **Start the backend server**
2. **Test the script manually** from terminal:
   ```bash
   /path/to/transcription-app/scripts/transcribe-macos.sh
   ```
3. **Speak into your microphone** while recording
4. **Press the keyboard shortcut again** to stop recording
5. **Check that the transcription** appears in your clipboard and is pasted

## Troubleshooting

### FFmpeg can't access microphone
- Check System Settings > Privacy & Security > Microphone
- Grant permission to Terminal, Automator, or your automation tool

### Script doesn't run from keyboard shortcut
- Make sure the script has execute permissions (`chmod +x`)
- Check that the full path is specified in the automation tool
- Add logging to `/tmp/transcribe.log` to debug issues

### Backend server not responding
- Verify the server is running: `curl http://localhost:12050/api/`
- Check that your OpenAI API key is set correctly
- Look at server logs for errors

### Auto-paste doesn't work
- The AppleScript keystroke may need Accessibility permissions
- Go to System Settings > Privacy & Security > Accessibility
- Add Terminal, Automator, or your automation tool to the allowed list

## Key Differences from Ubuntu Setup

| Feature | Ubuntu | macOS |
|---------|--------|-------|
| Audio Input | PulseAudio (`-f pulse -i default`) | AVFoundation (`-f avfoundation -i ":default"`) |
| Clipboard | `xclip` | `pbcopy` |
| Auto-paste | `xdotool` | AppleScript |
| Notifications | `notify-send` | `osascript` (AppleScript) |
| Keyboard Shortcuts | GNOME Settings (`gsettings`) | System Settings / Automator / Third-party tools |
| Status Indicator | Argos (GNOME Extension) | SwiftBar / BitBar |

## Additional Resources

- [FFmpeg macOS documentation](https://trac.ffmpeg.org/wiki/Capture/Desktop)
- [Automator User Guide](https://support.apple.com/guide/automator)
- [Hammerspoon documentation](https://www.hammerspoon.org/docs/)
- [SwiftBar documentation](https://github.com/swiftbar/SwiftBar)
