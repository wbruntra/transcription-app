import { Hono } from 'hono'
import { transcribeFile, transcribeFileXai } from './services/transcribe.js'

const router = new Hono()

router.get('/', (c) => c.text('Transcription API is running'))

router.post('/transcribe', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('audio')

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No audio file uploaded' }, 400)
  }

  // Normalize Web API File to the shape the service expects
  const audioFile = {
    buffer: Buffer.from(await file.arrayBuffer()),
    mimetype: file.type,
    originalname: file.name,
    size: file.size,
  }

  const provider = c.req.query('provider')

  try {
    const text =
      provider === 'xai'
        ? await transcribeFileXai(audioFile)
        : await transcribeFile(audioFile)
    return c.text(text)
  } catch (error) {
    console.error('Transcription error:', error)
    return c.text(error.message || 'Transcription failed', 500)
  }
})

export default router
