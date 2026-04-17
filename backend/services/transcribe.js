import { OpenAI } from 'openai'
import ffmpeg from 'fluent-ffmpeg'
import { Readable, PassThrough } from 'stream'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Convert buffer to MP3 buffer
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

// Create a File object from buffer (Node.js 20+)
export function createFileFromBuffer(buffer, filename = 'audio.mp3', mimeType = 'audio/mpeg') {
  return new File([buffer], filename, { type: mimeType })
}

// Check if file is already in MP3 format
export function isMp3File(audioFile) {
  return (
    audioFile.mimetype === 'audio/mpeg' ||
    audioFile.mimetype === 'audio/mp3' ||
    audioFile.originalname?.toLowerCase().endsWith('.mp3')
  )
}

// Process audio file and convert to MP3 if necessary
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

// Transcribe audio using OpenAI
export async function transcribeAudio(audioBuffer) {
  const startTime = Date.now()
  const audioFile = createFileFromBuffer(audioBuffer, 'audio.mp3', 'audio/mpeg')

  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'gpt-4o-mini-transcribe-2025-12-15',
  })

  const endTime = Date.now()
  console.log('Transcription Response Time:', (endTime - startTime) / 1000, 'seconds')

  return transcription.text
}

// Main service function to handle complete transcription workflow
export async function transcribeFile(audioFile) {
  if (!audioFile) {
    throw new Error('No audio file provided')
  }

  const audioBuffer = await processAudioFile(audioFile)
  const transcribedText = await transcribeAudio(audioBuffer)

  return transcribedText
}

// Transcribe audio using xAI STT REST API
export async function transcribeXai(audioBuffer) {
  const startTime = Date.now()

  const formData = new FormData()
  formData.append('format', 'true')
  formData.append('language', 'en')
  // file must be the last field per xAI docs
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
  const endTime = Date.now()
  console.log('xAI Transcription Response Time:', (endTime - startTime) / 1000, 'seconds')

  return result.text
}

// Main service function for xAI transcription
export async function transcribeFileXai(audioFile) {
  if (!audioFile) {
    throw new Error('No audio file provided')
  }

  const audioBuffer = await processAudioFile(audioFile)
  return transcribeXai(audioBuffer)
}
