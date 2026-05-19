#!/usr/bin/env bun
// Quick test script for the local Whisper STT provider at danarch:8766

const WHISPER_URL = 'http://danarch:8766/v1/audio/transcriptions'
const AUDIO_FILE = './data/mic_test.mp3'

const file = Bun.file(AUDIO_FILE)
const form = new FormData()
form.append('file', new Blob([await file.arrayBuffer()], { type: 'audio/mpeg' }), 'audio.mp3')
form.append('model', 'whisper-1')

console.log(`Sending ${AUDIO_FILE} to ${WHISPER_URL}...`)

const res = await fetch(WHISPER_URL, { method: 'POST', body: form })

if (!res.ok) {
  console.error(`HTTP ${res.status}:`, await res.text())
  process.exit(1)
}

const { text } = await res.json()
console.log('Transcription:', text)
