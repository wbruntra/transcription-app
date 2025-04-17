const express = require('express')
const multer = require('multer')
const cors = require('cors')
const { OpenAI } = require('openai')
const fs = require('fs').promises
const ffmpeg = require('fluent-ffmpeg')
require('dotenv').config()

const app = express()
const upload = multer({ dest: 'uploads/' })

// Middleware
app.use(cors())
app.use(express.json())

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
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioFile = req.file
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file uploaded' })
    }

    console.log('Received file:', {
      originalName: audioFile.originalname,
      mimetype: audioFile.mimetype,
      size: audioFile.size,
      path: audioFile.path,
    })

    // Convert to MP3
    const mp3Path = `uploads/${audioFile.filename}.mp3`
    await convertToMp3(audioFile.path, mp3Path)

    // Call OpenAI transcription API
    const transcription = await openai.audio.transcriptions.create({
      file: require('fs').createReadStream(mp3Path),
      model: 'gpt-4o-mini-transcribe', 
    })

    // Clean up files
    await fs.unlink(audioFile.path)
    await fs.unlink(mp3Path)

    res.json({ transcription: transcription.text })
  } catch (error) {
    console.error('Transcription error:', error)
    res.status(500).json({ error: error.message || 'Transcription failed' })
  }
})

// Start server
const PORT = 3001
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
