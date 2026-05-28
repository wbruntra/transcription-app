# Napkin

## User Preferences
- User wants to modify the Hono/TypeScript server (backend/), not the Go server (go-backend/)
- In `client/`, prefer absolute imports from `src` via an alias instead of relative `../../` paths

## Patterns That Work
- Providers are defined as objects in a `providers` registry map in `backend/services/transcribe.js`, each with a `transcribe(audioBuffer)` method
- A single `transcribeFile(audioFile, provider)` orchestrator handles input validation, MP3 preprocessing, provider lookup, timing, and logging centrally
- Provider selection is done via `?provider=` query param; caller just calls `transcribeFile(audioFile, provider || 'xai')`
- New providers are added by: (1) adding one entry to the `providers` map, no changes needed to `transcriptions_v2.js`
- For the Vite client, alias `@` to `client/src` in both `vite.config.js` and `client/tsconfig.json` so editor and bundler agree
- This repo prefers `bun`/`bunx` over `npm`/`npx` for package scripts and tooling commands
- For quick provider comparisons, hit the running Hono backend at `http://localhost:12050/api/transcribe?provider=<id>` with multipart field name `audio`; a Bun script under `scripts/` works well for timing and printing transcripts

## Patterns That Don't Work
- In this environment, the file-search helper can fail because the bundled `rg` binary is missing; use direct directory listing or targeted reads instead of retrying the same search
