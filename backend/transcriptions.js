var express = require('express')
var router = express.Router()
const multer = require('multer')
const cors = require('cors')
const { OpenAI } = require('openai')
const ffmpeg = require('fluent-ffmpeg')
const logger = require('morgan')
const path = require('path')
const fs = require('fs').promises

const upload = multer({ dest: 'uploads/' })

// Transcription endpoint
router.post('/api/transcribe', upload.single('audio'), async (req, res) => {})

module.exports = router
