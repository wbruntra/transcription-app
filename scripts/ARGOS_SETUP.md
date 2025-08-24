# Argos status indicator for transcription

This adds a GNOME top-bar indicator using the Argos extension. It reads `/tmp/transcribe-status.json` written by `scripts/transcribe.sh` and shows a small state badge: Rec / Proc / Done / Err / Idle.

## Install Argos
- Visit https://extensions.gnome.org/ and install the Argos extension (or the current maintained fork for your GNOME version). You may need to enable the browser connector and the `gnome-shell-extension-prefs` tool.
- Ensure the extension is enabled in `Extensions` app.

## Install jq (optional but recommended)
```
sudo apt-get update
sudo apt-get install -y jq
```

## Place the Argos script
- Copy `scripts/argos-transcribe.2s.sh` to `~/.config/argos/` and make it executable.
```
mkdir -p ~/.config/argos
cp scripts/argos-transcribe.2s.sh ~/.config/argos/transcribe.2s.sh
chmod +x ~/.config/argos/transcribe.2s.sh
```
- The `.2s` suffix makes it refresh every 2 seconds.

## Bash script changes
`scripts/transcribe.sh` now writes `/tmp/transcribe-status.json` with this shape:
```
{
  "state": "recording|processing|done|error|idle",
  "timestamp": 1703123456,
  "duration": 15,
  "preview": "Hello world...",
  "message": null,
  "pid": 12345
}
```
- `duration` is seconds from start to stop.
- `pid` reflects the active ffmpeg or the processing script PID.
- On errors or stale timestamps (>120s), the indicator shows Idle.

## Actions in the menu
- Stop Recording: kills the ffmpeg tied to `/tmp/recording.mp3`.
- Open Status File: opens the JSON in your default app.
- Refresh: forces Argos refresh.

## Notes
- This doesn’t replace existing notifications; it augments them.
- If you ever change the temp audio path, update both `transcribe.sh` and the Argos script grep.
- Wayland/X11 has no impact here; Argos runs in GNOME Shell.
