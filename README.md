# Transcription App

Voice transcription app with a web UI. Record audio from your microphone, send it to one of several AI-powered speech-to-text providers, and get text back. Supports batch transcription (record then transcribe) and real-time streaming transcription.

## Providers

| Provider | Mode | Model |
|---|---|---|
| OpenAI | Batch | GPT-4o-mini-transcribe |
| xAI | Batch + Streaming | Grok STT |
| Nvidia (OpenRouter) | Batch | Parakeet |
| Qwen (OpenRouter) | Batch | ASR |
| Danarch (local) | Batch | Whisper |

## Setup

### Prerequisites

- [Bun](https://bun.sh) runtime
- [ffmpeg](https://ffmpeg.org) (for audio format conversion)

### Install

```bash
bun install
cd client && bun install
```

### Environment

Create a `.env` file with your API keys:

```env
OPENAI_API_KEY=sk-...
XAI_API_KEY=...
OPENROUTER_API_KEY=...
PORT=12050
```

### Run

```bash
# Development (backend + frontend with hot reload)
bun run dev

# Production build (standalone binary)
bun run build
bun run start
```

The server runs on `http://localhost:12050`. In development, the Vite dev server runs on `http://localhost:12051` and proxies API requests to the backend.

## Desktop Integration (Linux/GNOME)

Global hotkey recording with auto-paste:

1. Install dependencies: `ffmpeg`, `xclip`, `xdotool`, `jq`
2. Register the keybinding: `./scripts/create-keybinding.sh`
3. Press `Ctrl+Alt+U` to toggle recording — result is pasted at cursor

See `MACOS_SETUP.md` for macOS integration.

## Benchmarking

```bash
bun run bench:transcription
```

Compares transcription speed across providers using a test audio file.

## Tech Stack

- **Backend**: Hono (Bun), OpenAI client, fluent-ffmpeg
- **Frontend**: React 19, Vite 6, Bootstrap 5, SCSS
- **Streaming**: WebSocket relay proxy (xAI STT)
