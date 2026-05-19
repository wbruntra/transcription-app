# Napkin

## User Preferences
- User wants to modify the Hono/TypeScript server (backend/), not the Go server (go-backend/)

## Patterns That Work
- Providers are defined as objects in a `providers` registry map in `backend/services/transcribe.js`, each with a `transcribe(audioBuffer)` method
- A single `transcribeFile(audioFile, provider)` orchestrator handles input validation, MP3 preprocessing, provider lookup, timing, and logging centrally
- Provider selection is done via `?provider=` query param; caller just calls `transcribeFile(audioFile, provider || 'xai')`
- New providers are added by: (1) adding one entry to the `providers` map, no changes needed to `transcriptions_v2.js`
