import { OpenAI } from 'openai'
import ffmpeg from 'fluent-ffmpeg'
import { Readable, PassThrough } from 'stream'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const convertToMp3Buffer = (inputBuffer) => {
  return new Promise((resolve, reject) => {
    const outputStream = new PassThrough()
    const chunks = []

    outputStream.on('data', (chunk) => chunks.push(chunk))
    outputStream.on('end', () => resolve(Buffer.concat(chunks)))
    outputStream.on('error', reject)

    const inputStream = Readable.from(inputBuffer)

    ffmpeg()
      .input(inputStream)
      .inputFormat('webm')
      .toFormat('mp3')
      .on('error', reject)
      .pipe(outputStream, { end: true })
  })
}

export function createFileFromBuffer(buffer, filename = 'audio.mp3', mimeType = 'audio/mpeg') {
  return new File([buffer], filename, { type: mimeType })
}

export function isMp3File(audioFile) {
  return (
    audioFile.mimetype === 'audio/mpeg' ||
    audioFile.mimetype === 'audio/mp3' ||
    audioFile.originalname?.toLowerCase().endsWith('.mp3')
  )
}

export async function processAudioFile(audioFile) {
  console.log('Received file:', {
    size: audioFile.size,
    mimetype: audioFile.mimetype,
    originalname: audioFile.originalname,
  })

  let finalBuffer = audioFile.buffer

  if (!isMp3File(audioFile)) {
    console.log('Converting to MP3...')
    finalBuffer = await convertToMp3Buffer(audioFile.buffer, audioFile.mimetype)
    console.log('MP3 buffer created, size:', finalBuffer.length, 'bytes')
  } else {
    console.log('File is already MP3, using directly')
  }

  return finalBuffer
}

// --- Provider registry ---

const providers = {
  openai: {
    async transcribe(audioBuffer) {
      const audioFile = createFileFromBuffer(audioBuffer, 'audio.mp3', 'audio/mpeg')
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'gpt-4o-mini-transcribe-2025-12-15',
      })
      return transcription.text
    },
  },

  xai: {
    async transcribe(audioBuffer) {
      const formData = new FormData()
      formData.append('format', 'true')
      formData.append('language', 'en')
      formData.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3')

      const response = await fetch('https://api.x.ai/v1/stt', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`xAI STT error ${response.status}: ${text}`)
      }

      const result = await response.json()
      return result.text
    },
  },

  danarch: {
    async transcribe(audioBuffer) {
      const formData = new FormData()
      formData.append('model', 'whisper-1')
      formData.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3')

      const response = await fetch('http://danarch:8766/v1/audio/transcriptions', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Danarch STT error ${response.status}: ${text}`)
      }

      const result = await response.json()
      return result.text
    },
  },

  openrouter: {
    async transcribe(audioBuffer) {
      const base64Audio = audioBuffer.toString('base64')

      const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen/qwen3-asr-flash-2026-02-10',
          input_audio: {
            data: base64Audio,
            format: 'mp3',
          },
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`OpenRouter STT error ${response.status}: ${text}`)
      }

      const result = await response.json()
      return result.text
    },
  },
}

export function getAvailableProviders() {
  return Object.keys(providers)
}

export function getProvider(name) {
  return providers[name] ?? null
}

export async function transcribeFile(audioFile, provider = 'xai') {
  if (!audioFile) {
    throw new Error('No audio file provided')
  }

  const audioBuffer = await processAudioFile(audioFile)

  const impl = providers[provider]
  if (!impl) {
    throw new Error(`Unknown transcription provider: ${provider}`)
  }

  const startTime = Date.now()
  const text = await impl.transcribe(audioBuffer)
  console.log(`${provider} Transcription Response Time:`, (Date.now() - startTime) / 1000, 'seconds')

  return text
}
