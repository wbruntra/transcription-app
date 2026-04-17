import { useState, useRef, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [provider, setProvider] = useState('openai')
  const [transcription, setTranscription] = useState('')
  const [editedTranscription, setEditedTranscription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0) // NEW: Audio level for visualization

  const providerRef = useRef(provider)
  useEffect(() => { providerRef.current = provider }, [provider])

  const shouldTranscribeRef = useRef(true)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const textareaRef = useRef(null)
  const abortControllerRef = useRef(null)
  const timerRef = useRef(null)
  // NEW: Audio visualization refs
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationRef = useRef(null)

  // Add effect for keyboard event listener
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.ctrlKey && !event.repeat && !loading) {
        if (event.code === 'Space') {
          event.preventDefault()
          if (!isRecording) {
            shouldTranscribeRef.current = true
            startRecording()
          } else {
            shouldTranscribeRef.current = true
            stopRecording()
          }
        } else if (event.code === 'KeyX' && isRecording) {
          event.preventDefault()
          cancelRecording()
        }
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => {
      document.removeEventListener('keydown', handleKeyPress)
    }
  }, [isRecording, loading])

  // Add effect for recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1)
      }, 1000)
    } else {
      clearInterval(timerRef.current)
      setRecordingTime(0)
    }

    return () => clearInterval(timerRef.current)
  }, [isRecording])

  // NEW: Audio visualization function
  const startAudioVisualization = (stream) => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
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
        setAudioLevel(average / 255) // Normalize to 0-1

        animationRef.current = requestAnimationFrame(updateAudioLevel)
      }

      animationRef.current = requestAnimationFrame(updateAudioLevel)
    } catch (err) {
      console.warn('Audio visualization not supported:', err)
    }
  }

  // NEW: Stop audio visualization
  const stopAudioVisualization = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    analyserRef.current = null
    setAudioLevel(0)
  }

  // MODIFIED: Start recording with visualization
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Start audio visualization
      startAudioVisualization(stream)

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
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' })
          await transcribeAudio(audioBlob)
        }
        stream.getTracks().forEach((track) => track.stop())
        shouldTranscribeRef.current = true

        // Stop visualization when recording stops
        stopAudioVisualization()
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
      setError('')
      setTranscription('')
    } catch (err) {
      setError('Failed to access microphone. Please allow microphone access.')
      stopAudioVisualization() // Clean up on error
    }
  }

  // MODIFIED: Stop recording with visualization cleanup
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  // MODIFIED: Cancel recording with visualization cleanup
  const cancelRecording = () => {
    shouldTranscribeRef.current = false
    stopRecording()
    stopAudioVisualization() // Make sure visualization stops immediately
  }

  // Transcribe the recorded audio
  const transcribeAudio = async (audioBlob) => {
    abortControllerRef.current = new AbortController()
    setLoading(true)
    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.webm')

    try {
      const response = await axios.post(`/api/transcribe?provider=${providerRef.current}`, formData, {
        signal: abortControllerRef.current.signal,
      })
      setTranscription(response.data)
      setEditedTranscription((prevEdited) =>
        prevEdited ? prevEdited + ' ' + response.data : response.data,
      )
      setError('')
    } catch (err) {
      if (axios.isCancel(err)) {
        setError('Transcription canceled by user.')
      } else {
        const errorMsg = err.response?.data || err.message
        setError(`Failed to transcribe audio: ${errorMsg}`)
      }
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  const cancelTranscription = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setLoading(false)
      setError('Transcription canceled.')
    }
  }

  const handleTranscriptionEdit = (e) => {
    setEditedTranscription(e.target.value)
  }

  // NEW: Audio visualizer component
  const AudioVisualizer = () => (
    <div
      style={{
        width: '200px',
        height: '6px',
        backgroundColor: '#e0e0e0',
        borderRadius: '3px',
        overflow: 'hidden',
        margin: '8px 0',
        border: '1px solid #ccc',
      }}
    >
      <div
        style={{
          width: `${audioLevel * 100}%`,
          height: '100%',
          backgroundColor: audioLevel > 0.7 ? '#dc3545' : audioLevel > 0.3 ? '#fd7e14' : '#28a745',
          transition: 'width 0.1s ease-out',
          borderRadius: '2px',
        }}
      />
    </div>
  )

  const statusText = isRecording
    ? `Recording, ${recordingTime} seconds`
    : loading
    ? 'Transcribing...'
    : 'Idle'

  return (
    <div className="container" data-bs-theme="dark">
      <h1>OpenAI-Powered Audio Transcription</h1>

      <div className="d-flex align-items-center gap-3 mt-3">
        <span className="fw-semibold">Provider:</span>
        <div className="btn-group btn-group-sm" role="group">
          <input
            type="radio"
            className="btn-check"
            name="provider"
            id="provider-openai"
            value="openai"
            checked={provider === 'openai'}
            onChange={() => setProvider('openai')}
          />
          <label className="btn btn-outline-secondary" htmlFor="provider-openai">
            OpenAI
          </label>
          <input
            type="radio"
            className="btn-check"
            name="provider"
            id="provider-xai"
            value="xai"
            checked={provider === 'xai'}
            onChange={() => setProvider('xai')}
          />
          <label className="btn btn-outline-secondary" htmlFor="provider-xai">
            xAI
          </label>
        </div>
      </div>

      <div className="alert alert-info mt-3">
        <h5>Keyboard Commands</h5>
        <ul>
          <li>Ctrl + Space: Start/Stop Recording</li>
          <li>Ctrl + X: Cancel Recording (while recording)</li>
        </ul>
      </div>

      <div className="controls mt-3">
        <div className="d-flex align-items-center">
          <div className={`recording-indicator ${isRecording ? 'active' : ''}`}></div>
          <button
            className={`btn btn-sm btn-primary ${isRecording ? 'recording' : ''}`}
            onClick={() => {
              shouldTranscribeRef.current = true
              isRecording ? stopRecording() : startRecording()
            }}
            disabled={loading}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
          {isRecording && (
            <button className="btn btn-sm btn-warning ms-2" onClick={cancelRecording}>
              Cancel Recording
            </button>
          )}
          {loading && (
            <button className="btn btn-sm btn-danger ms-2" onClick={cancelTranscription}>
              Cancel Transcription
            </button>
          )}
        </div>

        {/* NEW: Audio visualization - only show when recording */}
        {isRecording && (
          <div className="mt-2">
            <small className="text-muted">Audio Level:</small>
            <AudioVisualizer />
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="transcription">
        <textarea
          ref={textareaRef}
          value={editedTranscription}
          onChange={handleTranscriptionEdit}
          rows={10}
          style={{ width: '100%', padding: '8px', borderRadius: '4px' }}
          placeholder="Transcription will appear here..."
        />
      </div>

      <p className="my-2">Status: {statusText}</p>
    </div>
  )
}

export default App
