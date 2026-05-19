import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/bun'

const router = new Hono()

const XAI_API_KEY = process.env.XAI_API_KEY
const XAI_STT_WS = 'wss://api.x.ai/v1/stt'

router.get(
  '/',
  upgradeWebSocket((c) => {
    let xaiWs = null

    return {
      onOpen(evt, ws) {
        const params = new URLSearchParams({
          sample_rate: '16000',
          encoding: 'pcm',
          interim_results: 'true',
          language: 'en',
        })

        xaiWs = new WebSocket(`${XAI_STT_WS}?${params}`, {
          headers: { Authorization: `Bearer ${XAI_API_KEY}` },
        })

        xaiWs.addEventListener('open', () => {
          console.log('xAI STT WebSocket connected')
        })

        xaiWs.addEventListener('message', (event) => {
          const data = JSON.parse(event.data)

          if (data.type === 'transcript.created') {
            console.log('xAI STT server ready')
            ws.send(JSON.stringify({ type: 'ready' }))
          } else if (data.type === 'transcript.partial') {
            ws.send(
              JSON.stringify({
                type: 'transcript',
                text: data.text,
                isFinal: data.is_final,
                speechFinal: data.speech_final,
                words: data.words,
                start: data.start,
                duration: data.duration,
              })
            )
          } else if (data.type === 'transcript.done') {
            ws.send(
              JSON.stringify({
                type: 'transcript_done',
                text: data.text,
                duration: data.duration,
              })
            )
          } else if (data.type === 'error') {
            console.error('xAI STT error:', data.message)
            ws.send(JSON.stringify({ type: 'error', message: data.message }))
          }
        })

        xaiWs.addEventListener('close', (event) => {
          console.log('xAI STT WebSocket closed:', event.code, event.reason)
        })

        xaiWs.addEventListener('error', (err) => {
          console.error('xAI STT WebSocket error:', err)
          ws.send(JSON.stringify({ type: 'error', message: 'xAI connection failed' }))
        })
      },

      onMessage(evt, ws) {
        if (!xaiWs || xaiWs.readyState !== WebSocket.OPEN) return

        const data = evt.data

        if (typeof data === 'string') {
          const msg = JSON.parse(data)
          if (msg.type === 'audio.done') {
            xaiWs.send(JSON.stringify({ type: 'audio.done' }))
          }
        } else {
          // Binary PCM audio — forward directly to xAI
          xaiWs.send(data)
        }
      },

      onClose() {
        if (xaiWs) {
          xaiWs.close()
          xaiWs = null
        }
      },

      onError(evt) {
        console.error('Client WebSocket error:', evt)
        if (xaiWs) {
          xaiWs.close()
          xaiWs = null
        }
      },
    }
  })
)

export default router
