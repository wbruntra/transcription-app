const express = require('express')
const router = express.Router()
const { OpenAI } = require('openai')
const ffmpeg = require('fluent-ffmpeg')
const multer = require('multer')
const { Readable, PassThrough } = require('stream')

// Use memory storage instead of disk storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
})

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
function createFileFromBuffer(buffer, filename = 'audio.mp3', mimeType = 'audio/mpeg') {
  return new File([buffer], filename, { type: mimeType })
}

router.get('/', (req, res) => {
  res.send('Transcription API is running')
})

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioFile = req.file
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file uploaded' })
    }

    console.log('Received file:', {
      size: audioFile.size,
      mimetype: audioFile.mimetype,
      originalname: audioFile.originalname
    })

    let finalBuffer = audioFile.buffer

    // Only convert if it's NOT already MP3
    const isMp3 = audioFile.mimetype === 'audio/mpeg' || 
                  audioFile.mimetype === 'audio/mp3' || 
                  audioFile.originalname?.toLowerCase().endsWith('.mp3')

    if (!isMp3) {
      console.log('Converting to MP3...')
      finalBuffer = await convertToMp3Buffer(audioFile.buffer, audioFile.mimetype)
      console.log('MP3 buffer created, size:', finalBuffer.length, 'bytes')
    } else {
      console.log('File is already MP3, using directly')
    }

    const startTime = Date.now()
    const audioFile_mp3 = createFileFromBuffer(finalBuffer, 'audio.mp3', 'audio/mpeg')

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile_mp3,
      model: 'gpt-4o-mini-transcribe',
    })

    const endTime = Date.now()
    console.log('Transcription Response Time:', (endTime - startTime) / 1000, 'seconds')

    res.send(transcription.text)
  } catch (error) {
    console.error('Transcription error:', error)
    res.status(500).send(error.message || 'Transcription failed')
  }
})

module.exports = router
