import { useRef, useCallback } from 'react'
import { downsampleBuffer, floatTo16BitPCM } from '../utils/audio'

/**
 * Hook for managing xAI streaming STT via WebSocket
 * @param {Object} options
 * @param {(level: number) => void} options.onAudioLevel - Audio level callback
 * @param {(text: string) => void} options.onInterimText - Interim transcript callback
 * @param {(text: string) => void} options.onFinalText - Final transcript callback
 * @param {(error: string) => void} options.onError - Error callback
 * @param {() => void} options.onStart - Recording start callback
 * @param {() => void} options.onStop - Recording stop callback
 * @returns {Object} Streaming recording controls
 */
export function useStreamingRecorder({
  onAudioLevel,
  onInterimText,
  onFinalText,
  onError,
  onStart,
  onStop,
}) {
  const wsRef = useRef(null)
  const scriptProcessorRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const streamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationRef = useRef(null)

  const stopAll = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect()
      scriptProcessorRef.current = null
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (analyserRef.current) {
      analyserRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    onAudioLevel(0)
  }, [onAudioLevel])

  const startPcmCapture = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream

    const AudioContext = window.AudioContext || window.webkitAudioContext
    const audioContext = new AudioContext()
    audioContextRef.current = audioContext

    // Visualization analyser
    const analyser = audioContext.createAnalyser()
    analyserRef.current = analyser
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8

    const source = audioContext.createMediaStreamSource(stream)
    sourceNodeRef.current = source

    // ScriptProcessor for PCM capture (4096 buffer, mono input, mono output)
    const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1)
    scriptProcessorRef.current = scriptProcessor

    const inputSampleRate = audioContext.sampleRate
    const targetSampleRate = 16000

    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

      const inputData = audioProcessingEvent.inputBuffer.getChannelData(0)
      const downsampled = downsampleBuffer(inputData, inputSampleRate, targetSampleRate)
      const pcm16 = floatTo16BitPCM(downsampled)
      wsRef.current.send(pcm16)
    }

    source.connect(scriptProcessor)
    scriptProcessor.connect(audioContext.destination)

    // Visualization
    source.connect(analyser)
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    const updateAudioLevel = () => {
      if (!analyserRef.current) return
      analyserRef.current.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length
      onAudioLevel(average / 255)
      animationRef.current = requestAnimationFrame(updateAudioLevel)
    }
    animationRef.current = requestAnimationFrame(updateAudioLevel)
  }, [onAudioLevel])

  const startRecording = useCallback(async () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/stt-stream`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    onInterimText('')

    ws.onopen = () => {
      console.log('Streaming WebSocket connected')
    }

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'ready') {
        console.log('xAI STT ready, starting audio capture')
        await startPcmCapture()
        onStart()
      } else if (data.type === 'transcript') {
        if (data.speechFinal) {
          onFinalText(data.text)
          onInterimText('')
        } else {
          onInterimText(data.text)
        }
      } else if (data.type === 'transcript_done') {
        if (data.text) {
          onFinalText(data.text)
        }
        onInterimText('')
      } else if (data.type === 'error') {
        onError(`Streaming error: ${data.message}`)
      }
    }

    ws.onerror = () => {
      onError('Streaming connection error')
    }

    ws.onclose = () => {
      console.log('Streaming WebSocket closed')
    }
  }, [startPcmCapture, onInterimText, onFinalText, onError, onStart])

  const stopRecording = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'audio.done' }))
      setTimeout(() => {
        if (wsRef.current) {
          wsRef.current.close()
          wsRef.current = null
        }
      }, 2000)
    }
    stopAll()
    onStop()
  }, [stopAll, onStop])

  const cancelRecording = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    stopAll()
    onStop()
  }, [stopAll, onStop])

  return {
    startRecording,
    stopRecording,
    cancelRecording,
  }
}
