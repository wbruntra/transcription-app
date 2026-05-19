import { useState, useRef, useCallback } from 'react'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useRecordingTimer } from './hooks/useRecordingTimer'
import { useBatchRecorder } from './hooks/useBatchRecorder'
import { useStreamingRecorder } from './hooks/useStreamingRecorder'
import { ProviderSelector } from './components/ProviderSelector'
import { RecordingControls } from './components/RecordingControls'
import { TranscriptionDisplay } from './components/TranscriptionDisplay'

function App() {
  const [provider, setProvider] = useState('openai')
  const [editedTranscription, setEditedTranscription] = useState('')
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  const textareaRef = useRef(null)

  const recordingTime = useRecordingTimer(isRecording)

  const handleTranscription = useCallback((text) => {
    setEditedTranscription((prev) => {
      const trimmed = prev.trimEnd()
      return trimmed ? trimmed + ' ' + text : text
    })
    setError('')
    setLoading(false)
  }, [])

  const handleError = useCallback((errorMsg) => {
    setError(errorMsg)
    setLoading(false)
  }, [])

  const handleStart = useCallback(() => {
    setIsRecording(true)
    setError('')
    setStreamingText('')
  }, [])

  const handleStop = useCallback(() => {
    setIsRecording(false)
  }, [])

  const handleInterimText = useCallback((text) => {
    setStreamingText(text)
  }, [])

  const batchRecorder = useBatchRecorder({
    provider,
    onAudioLevel: setAudioLevel,
    onTranscription: handleTranscription,
    onError: handleError,
    onStart: handleStart,
    onStop: handleStop,
  })

  const streamingRecorder = useStreamingRecorder({
    onAudioLevel: setAudioLevel,
    onInterimText: handleInterimText,
    onFinalText: handleTranscription,
    onError: handleError,
    onStart: handleStart,
    onStop: handleStop,
  })

  const isStreamingMode = provider === 'xai'

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      if (isStreamingMode) {
        streamingRecorder.stopRecording()
      } else {
        batchRecorder.stopRecording()
        setLoading(true)
      }
    } else {
      if (isStreamingMode) {
        streamingRecorder.startRecording()
      } else {
        batchRecorder.startRecording()
      }
    }
  }, [isRecording, isStreamingMode, streamingRecorder, batchRecorder])

  const handleCancelRecording = useCallback(() => {
    if (isStreamingMode) {
      streamingRecorder.cancelRecording()
    } else {
      batchRecorder.cancelRecording()
    }
    setStreamingText('')
  }, [isStreamingMode, streamingRecorder, batchRecorder])

  const handleCancelTranscription = useCallback(() => {
    batchRecorder.cancelTranscription()
    setLoading(false)
    setError('Transcription canceled.')
  }, [batchRecorder])

  useKeyboardShortcuts({
    enabled: !loading,
    isRecording,
    loading,
    onToggleRecording: handleToggleRecording,
    onCancelRecording: handleCancelRecording,
  })

  const statusText = isRecording
    ? `Recording, ${recordingTime} seconds${isStreamingMode ? ' (streaming)' : ''}`
    : loading
    ? 'Transcribing...'
    : 'Idle'

  return (
    <div className="container" data-bs-theme="dark">
      <h1>OpenAI-Powered Audio Transcription</h1>

      <ProviderSelector provider={provider} onProviderChange={setProvider} />

      {provider === 'xai' && !isRecording && (
        <div className="badge bg-info text-dark mt-2">
          xAI uses real-time streaming transcription
        </div>
      )}

      <div className="alert alert-info mt-3">
        <h5>Keyboard Commands</h5>
        <ul>
          <li>Ctrl + Space: Start/Stop Recording</li>
          <li>Ctrl + X: Cancel Recording (while recording)</li>
        </ul>
      </div>

      <RecordingControls
        isRecording={isRecording}
        loading={loading}
        isStreamingMode={isStreamingMode}
        audioLevel={audioLevel}
        onToggleRecording={handleToggleRecording}
        onCancelRecording={handleCancelRecording}
        onCancelTranscription={handleCancelTranscription}
      />

      {error && <p className="error">{error}</p>}

      <TranscriptionDisplay
        editedTranscription={editedTranscription}
        onChange={setEditedTranscription}
        streamingText={streamingText}
        textareaRef={textareaRef}
      />

      <p className="my-2">Status: {statusText}</p>
    </div>
  )
}

export default App
