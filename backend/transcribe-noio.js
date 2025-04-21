const express = require('express')
const router = express.Router()
const multer = require('multer')
const { OpenAI } = require('openai')
const ffmpeg = require('fluent-ffmpeg')
const { Readable } = require('stream')

// Initialize multer with memory storage
const upload = multer({ storage: multer.memoryStorage() })

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Convert WEBM buffer to MP3 buffer
const convertToMp3Buffer = (webmBuffer) => {
  return new Promise((resolve, reject) => {
    const buffers = []
    const inputStream = new Readable()
    inputStream.push(webmBuffer)
    inputStream.push(null) // End of stream

    ffmpeg(inputStream)
      .inputFormat('webm')
      .toFormat('mp3')
      .audioCodec('libmp3lame')
      .on('error', reject)
      .pipe()
      .on('data', (chunk) => buffers.push(chunk))
      .on('end', () => resolve(Buffer.concat(buffers)))
  })
}

// Transcription endpoint
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioFile = req.file
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file uploaded' })
    }

    console.log('Received file:', { size: audioFile.size })

    // Convert to MP3 buffer
    const mp3Buffer = await convertToMp3Buffer(audioFile.buffer)

    // Create a fake file stream with .mp3 extension
    const mp3Stream = new Readable()
    mp3Stream.push(mp3Buffer)
    mp3Stream.push(null)
    mp3Stream.path = 'audio.mp3' // Critical for OpenAI file type detection

    const startTime = Date.now()

    // Call OpenAI transcription API
    const transcription = await openai.audio.transcriptions.create({
      file: mp3Stream,
      model: 'whisper-1', // Verify correct model name
    })

    console.log('Transcription Response Time:', (Date.now() - startTime) / 1000, 'seconds')

    res.json({ transcription: transcription.text })
  } catch (error) {
    console.error('Transcription error:', error)
    res.status(500).json({ error: error.message || 'Transcription failed' })
  }
})

module.exports = router
