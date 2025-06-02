const express = require('express')
const router = express.Router()
const { OpenAI } = require('openai')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const multer = require('multer')

// Initialize multer
const upload = multer({ dest: 'uploads/' })

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

router.get('/', (req, res) => {
  res.send('Transcription API is running')
})

// Transcription endpoint
router.post('/transcribe', upload.single('audio'), async (req, res) => {
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
      file: fs.createReadStream(mp3Path),
      model: 'gpt-4o-mini-transcribe',
    })

    // Log end time and duration after receiving response
    const endTime = Date.now()
    console.log('Transcription Response Time:', (endTime - startTime) / 1000, 'seconds')

    // Clean up files
    await fs.promises.unlink(audioFile.path)
    await fs.promises.unlink(mp3Path)

    res.json({ transcription: transcription.text })
  } catch (error) {
    console.error('Transcription error:', error)
    res.status(500).json({ error: error.message || 'Transcription failed' })
  }
})

module.exports = router
