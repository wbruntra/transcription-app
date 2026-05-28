import { OpenAI } from 'openai'
import ffmpeg from 'fluent-ffmpeg'
import { Readable, PassThrough } from 'stream'
import * as secrets from './secrets.js'

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

function getPassthroughInfo(audioFile) {
  const mime = audioFile.mimetype || ''
  const name = (audioFile.originalname || '').toLowerCase()
  if (mime === 'audio/mpeg' || mime === 'audio/mp3' || name.endsWith('.mp3')) {
    return { mimeType: 'audio/mpeg', filename: 'audio.mp3' }
  }
  if (mime === 'audio/ogg' || mime === 'audio/opus' || name.endsWith('.ogg') || name.endsWith('.opus')) {
    return { mimeType: 'audio/ogg', filename: 'audio.ogg' }
  }
  return null
}

export async function processAudioFile(audioFile) {
  console.log('Received file:', {
    size: audioFile.size,
    mimetype: audioFile.mimetype,
    originalname: audioFile.originalname,
  })

  const info = getPassthroughInfo(audioFile)
  if (info) {
    console.log(`File is ${info.mimeType}, using directly`)
    return { buffer: audioFile.buffer, ...info }
  }

  console.log('Converting to MP3...')
  const buffer = await convertToMp3Buffer(audioFile.buffer)
  console.log('MP3 buffer created, size:', buffer.length, 'bytes')
  return { buffer, mimeType: 'audio/mpeg', filename: 'audio.mp3' }
}

// --- Provider registry ---

const providers = {
  openai: {
    label: 'OpenAI',
    streaming: false,
    async transcribe(audioBuffer, mimeType, filename) {
      const audioFile = createFileFromBuffer(audioBuffer, filename, mimeType)
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'gpt-4o-mini-transcribe-2025-12-15',
      })
      return transcription.text
    },
  },

  xai: {
    label: 'xAI',
    streaming: true,
    async transcribe(audioBuffer, mimeType, filename) {
      const formData = new FormData()
      formData.append('format', 'true')
      formData.append('language', 'en')
      formData.append('file', new Blob([audioBuffer], { type: mimeType }), filename)

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
    label: 'Danarch',
    streaming: false,
    async transcribe(audioBuffer, mimeType, filename) {
      const formData = new FormData()
      formData.append('model', 'whisper-1')
      formData.append('file', new Blob([audioBuffer], { type: mimeType }), filename)

      const response = await fetch(secrets.DANARCH_API_URL, {
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

  qwen: {
    label: 'Qwen',
    streaming: false,
    async transcribe(audioBuffer, mimeType) {
      const base64Audio = audioBuffer.toString('base64')
      const format = mimeType === 'audio/ogg' ? 'ogg' : 'mp3'

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
            format,
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

  nvidia: {
    label: 'Nvidia',
    streaming: false,
    async transcribe(audioBuffer, mimeType) {
      const base64Audio = audioBuffer.toString('base64')
      const format = mimeType === 'audio/ogg' ? 'ogg' : 'mp3'

      const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'nvidia/parakeet-tdt-0.6b-v3',
          input_audio: {
            data: base64Audio,
            format,
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

export function getProviders() {
  return Object.entries(providers).map(([id, impl]) => ({
    id,
    label: impl.label,
    streaming: impl.streaming,
  }))
}

export function getProvider(name) {
  return providers[name] ?? null
}

export async function transcribeFile(audioFile, provider = 'openai') {
  if (!audioFile) {
    throw new Error('No audio file provided')
  }

  const { buffer, mimeType, filename } = await processAudioFile(audioFile)

  const impl = providers[provider]
  if (!impl) {
    throw new Error(`Unknown transcription provider: ${provider}`)
  }

  const startTime = Date.now()
  const text = await impl.transcribe(buffer, mimeType, filename)
  console.log(`${provider} Transcription Response Time:`, (Date.now() - startTime) / 1000, 'seconds')

  return text
}
