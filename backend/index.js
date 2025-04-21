const express = require('express')
const multer = require('multer')
const cors = require('cors')
const { OpenAI } = require('openai')
const ffmpeg = require('fluent-ffmpeg')
const logger = require('morgan')
const path = require('path')
const fs = require('fs').promises

require('dotenv').config()

const app = express()
const upload = multer({ dest: 'uploads/' })

// Middleware for logging requests
app.use(logger('dev'))

// Middleware
app.use(cors())
app.use(express.json())

const react_client_directory = path.join(__dirname, '../client/dist')

// Add this to verify the directory exists
// // Serve static files from client/dist
app.use(express.static(react_client_directory))

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Convert WEBM to MP3
const convertToMp3 = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('mp3')
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .save(outputPath)
  })
}

// Transcription endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioFile = req.file
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file uploaded' })
    }

    console.log('Received file:', {
      size: audioFile.size,
    })

    // Convert to MP3
    const mp3Path = `uploads/${audioFile.filename}.mp3`
    await convertToMp3(audioFile.path, mp3Path)

    // Log start time before sending to OpenAI
    const startTime = Date.now()

    // Call OpenAI transcription API
    const transcription = await openai.audio.transcriptions.create({
      file: require('fs').createReadStream(mp3Path),
      model: 'gpt-4o-mini-transcribe',
    })

    // Log end time and duration after receiving response
    const endTime = Date.now()
    console.log('Transcription Response Time:', (endTime - startTime) / 1000, 'seconds')

    // Clean up files
    await fs.unlink(audioFile.path)
    await fs.unlink(mp3Path)

    res.json({ transcription: transcription.text })
  } catch (error) {
    console.error('Transcription error:', error)
    res.status(500).json({ error: error.message || 'Transcription failed' })
  }
})

// Serve index.html for all unmatched routes (SPA fallback)
app.get('/', (req, res) => {
  res.sendFile(path.join(react_client_directory, 'index.html'))
})

// Start server
const PORT = process.env.PORT || 12050
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
