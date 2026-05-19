/**
 * Audio processing utilities for transcription
 */

/**
 * Downsample audio buffer from input sample rate to target sample rate
 * @param {Float32Array} buffer - Input audio buffer
 * @param {number} inputSampleRate - Current sample rate in Hz
 * @param {number} targetSampleRate - Desired sample rate in Hz
 * @returns {Float32Array} Downsampled buffer
 */
export function downsampleBuffer(buffer, inputSampleRate, targetSampleRate) {
  if (targetSampleRate >= inputSampleRate) return buffer
  const sampleRateRatio = inputSampleRate / targetSampleRate
  const newLength = Math.round(buffer.length / sampleRateRatio)
  const result = new Float32Array(newLength)
  let offsetResult = 0
  let offsetBuffer = 0
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio)
    let accum = 0
    let count = 0
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i]
      count++
    }
    result[offsetResult] = accum / count
    offsetResult++
    offsetBuffer = nextOffsetBuffer
  }
  return result
}

/**
 * Convert Float32Array audio to 16-bit PCM ArrayBuffer
 * @param {Float32Array} float32Array - Input float audio data
 * @returns {ArrayBuffer} PCM16 audio data
 */
export function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2)
  const view = new DataView(buffer)
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buffer
}

/**
 * Create a WAV blob from PCM16 audio data
 * @param {ArrayBuffer} pcmData - PCM16 audio data
 * @param {number} sampleRate - Sample rate in Hz
 * @param {number} numChannels - Number of channels
 * @returns {Blob} WAV formatted audio blob
 */
export function createWavBlob(pcmData, sampleRate = 16000, numChannels = 1) {
  const wavBuffer = new ArrayBuffer(44 + pcmData.byteLength)
  const view = new DataView(wavBuffer)

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + pcmData.byteLength, true)
  writeString(view, 8, 'WAVE')

  // fmt sub-chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true) // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true) // ByteRate
  view.setUint16(32, numChannels * 2, true) // BlockAlign
  view.setUint16(34, 16, true) // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data')
  view.setUint32(40, pcmData.byteLength, true)

  // Copy PCM data
  new Uint8Array(wavBuffer, 44).set(new Uint8Array(pcmData))

  return new Blob([wavBuffer], { type: 'audio/wav' })
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}
