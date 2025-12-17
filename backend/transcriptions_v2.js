const express = require('express')
const router = express.Router()
const multer = require('multer')
const { transcribeFile } = require('./services/transcribe')

// Use memory storage instead of disk storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
})

router.get('/', (req, res) => {
  res.send('Transcription API is running')
})

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioFile = req.file
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file uploaded' })
    }

    const transcribedText = await transcribeFile(audioFile)
    res.send(transcribedText)
  } catch (error) {
    console.error('Transcription error:', error)
    res.status(500).send(error.message || 'Transcription failed')
  }
})

module.exports = router
