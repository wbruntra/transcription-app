import { useRef, useCallback } from 'react'
import axios from 'axios'

/**
 * Hook for managing batch recording and transcription (OpenAI or xAI REST)
 * @param {Object} options
 * @param {string} options.provider - Current provider
 * @param {(level: number) => void} options.onAudioLevel - Audio level callback for visualization
 * @param {(text: string) => void} options.onTranscription - Transcription result callback
 * @param {(error: string) => void} options.onError - Error callback
 * @param {() => void} options.onStart - Recording start callback
 * @param {() => void} options.onStop - Recording stop callback
 * @returns {Object} Batch recording controls
 */
export function useBatchRecorder({
  provider,
  onAudioLevel,
  onTranscription,
  onError,
  onStart,
  onStop,
}) {
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const shouldTranscribeRef = useRef(true)
  const abortControllerRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationRef = useRef(null)

  const stopAudioContext = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    analyserRef.current = null
    onAudioLevel(0)
  }, [onAudioLevel])

  const startVisualization = useCallback(
    (stream) => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext
        audioContextRef.current = new AudioContext()
        analyserRef.current = audioContextRef.current.createAnalyser()
        const source = audioContextRef.current.createMediaStreamSource(stream)

        analyserRef.current.fftSize = 256
        analyserRef.current.smoothingTimeConstant = 0.8
        source.connect(analyserRef.current)

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)

        const updateAudioLevel = () => {
          if (!analyserRef.current) return
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          onAudioLevel(average / 255)
          animationRef.current = requestAnimationFrame(updateAudioLevel)
        }

        animationRef.current = requestAnimationFrame(updateAudioLevel)
      } catch (err) {
        console.warn('Audio visualization not supported:', err)
      }
    },
    [onAudioLevel]
  )

  const transcribeAudio = useCallback(
    async (audioBlob) => {
      abortControllerRef.current = new AbortController()
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      try {
        const response = await axios.post(
          `/api/transcribe?provider=${provider}`,
          formData,
          { signal: abortControllerRef.current.signal }
        )
        onTranscription(response.data)
      } catch (err) {
        if (axios.isCancel(err)) {
          onError('Transcription canceled by user.')
        } else {
          const errorMsg = err.response?.data || err.message
          onError(`Failed to transcribe audio: ${errorMsg}`)
        }
      } finally {
        abortControllerRef.current = null
      }
    },
    [provider, onTranscription, onError]
  )

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      startVisualization(stream)

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        if (shouldTranscribeRef.current) {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: 'audio/webm;codecs=opus',
          })
          await transcribeAudio(audioBlob)
        }
        stream.getTracks().forEach((track) => track.stop())
        shouldTranscribeRef.current = true
        stopAudioContext()
        onStop()
      }

      mediaRecorderRef.current.start()
      onStart()
    } catch (err) {
      onError('Failed to access microphone. Please allow microphone access.')
      stopAudioContext()
    }
  }, [startVisualization, stopAudioContext, transcribeAudio, onStart, onStop, onError])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const cancelRecording = useCallback(() => {
    shouldTranscribeRef.current = false
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
    stopAudioContext()
  }, [stopAudioContext])

  const cancelTranscription = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  return {
    startRecording,
    stopRecording,
    cancelRecording,
    cancelTranscription,
  }
}
