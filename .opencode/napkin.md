# Napkin

## User Preferences
- User wants to modify the Hono/TypeScript server (backend/), not the Go server (go-backend/)

## Patterns That Work
- Providers are added as functions in `backend/services/transcribe.js` + wired in `backend/transcriptions_v2.js`
- Provider selection is done via `?provider=` query param (openai, danarch, xai)
