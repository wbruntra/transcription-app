#!/usr/bin/env bun
import { basename, extname } from 'node:path'

const DEFAULT_API_URL = process.env.TRANSCRIPTION_BENCHMARK_URL ?? 'http://localhost:12050/api/transcribe'
const DEFAULT_AUDIO_PATH = './data/explainer_audio.ogg'
const PROVIDERS = ['openai', 'qwen', 'nvidia']

function guessMimeType(filePath) {
  const extension = extname(filePath).toLowerCase()
  switch (extension) {
    case '.ogg':
      return 'audio/ogg'
    case '.opus':
      return 'audio/ogg'
    case '.mp3':
      return 'audio/mpeg'
    case '.wav':
      return 'audio/wav'
    case '.webm':
      return 'audio/webm'
    default:
      return 'application/octet-stream'
  }
}

function formatSeconds(milliseconds) {
  return `${(milliseconds / 1000).toFixed(2)}s`
}

async function run() {
  const audioPath = process.argv[2] ?? DEFAULT_AUDIO_PATH
  const file = Bun.file(audioPath)

  if (!(await file.exists())) {
    console.error(`Audio file not found: ${audioPath}`)
    process.exit(1)
  }

  const audioBuffer = await file.arrayBuffer()
  const fileName = basename(audioPath)
  const mimeType = file.type || guessMimeType(audioPath)

  console.log(`Benchmark target: ${DEFAULT_API_URL}`)
  console.log(`Audio file: ${audioPath}`)
  console.log(`Providers: ${PROVIDERS.join(', ')}`)

  const results = []

  for (const provider of PROVIDERS) {
    const form = new FormData()
    form.append('audio', new Blob([audioBuffer], { type: mimeType }), fileName)

    const url = new URL(DEFAULT_API_URL)
    url.searchParams.set('provider', provider)

    console.log(`\n=== ${provider} ===`)

    const startedAt = performance.now()

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: form,
      })
      const transcription = await response.text()
      const elapsedMs = performance.now() - startedAt

      if (!response.ok) {
        console.error(`HTTP ${response.status} after ${formatSeconds(elapsedMs)}`)
        console.error(transcription)

        results.push({
          provider,
          ok: false,
          elapsedMs,
          transcript: transcription,
        })
        continue
      }

      console.log(`Completed in ${formatSeconds(elapsedMs)}`)
      console.log('Transcription result:')
      console.log(transcription)

      results.push({
        provider,
        ok: true,
        elapsedMs,
        transcript: transcription,
      })
    } catch (error) {
      const elapsedMs = performance.now() - startedAt
      const message = error instanceof Error ? error.message : String(error)

      console.error(`Request failed after ${formatSeconds(elapsedMs)}`)
      console.error(message)

      results.push({
        provider,
        ok: false,
        elapsedMs,
        transcript: message,
      })
    }
  }

  console.log('\n=== Summary ===')
  for (const result of results) {
    const status = result.ok ? 'ok ' : 'err'
    console.log(`${result.provider.padEnd(8)} ${status} ${formatSeconds(result.elapsedMs)}`)
  }
}

await run()
