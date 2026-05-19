import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/bun'
import transcriptionsRouter from './transcriptions_v2.js'
import transcribeStreamRouter from './transcribe-stream.js'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())

app.route('/api/stt-stream', transcribeStreamRouter)
app.route('/api', transcriptionsRouter)

// Serve built client files
app.use('/*', serveStatic({ root: './client/dist' }))

// SPA fallback
app.get('*', serveStatic({ path: './client/dist/index.html' }))

export default app
