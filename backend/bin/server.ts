#!/usr/bin/env bun
import app from '../index'
import { websocket } from 'hono/bun'

const port = Number(process.env.PORT || 12050)

export const bunServer = Bun.serve({
  port,
  idleTimeout: 180, // 3 minutes for SSE/WebSocket connections
  fetch: app.fetch,
  websocket,
  maxRequestBodySize: 50 * 1024 * 1024, // 50MB
})

console.log(`Backend server running at http://localhost:${port}`)

