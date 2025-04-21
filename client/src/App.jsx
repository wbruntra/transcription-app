import { useState, useRef, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [transcription, setTranscription] = useState('')
  const [editedTranscription, setEditedTranscription] = useState('') // For textarea edits
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0) // New state for timer
  const shouldTranscribeRef = useRef(true) // Changed to useRef for immediate updates
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const textareaRef = useRef(null) // Ref for textarea (though focus check is removed)
  const abortControllerRef = useRef(null) // Ref for AbortController
  const timerRef = useRef(null) // Ref for timer interval

  // Add effect for keyboard event listener
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.ctrlKey && !event.repeat && !loading) {
        if (event.code === 'Space') {
          event.preventDefault() // Prevent default to avoid scrolling or other actions
          if (!isRecording) {
            shouldTranscribeRef.current = true // Set to transcribe for new recordings
            startRecording()
          } else {
            shouldTranscribeRef.current = true // Ensure transcription on regular stop
            stopRecording()
          }
        } else if (event.code === 'KeyX' && isRecording) {
          event.preventDefault() // Prevent default
          cancelRecording() // Call cancelRecording if recording is active
        }
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => {
      document.removeEventListener('keydown', handleKeyPress) // Cleanup on unmount
    }
  }, [isRecording, loading]) // Re-run if isRecording or loading changes

  // Add effect for recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1) // Increment time every second
      }, 1000)
    } else {
      clearInterval(timerRef.current) // Clear interval when not recording
      setRecordingTime(0) // Reset timer
    }

    return () => clearInterval(timerRef.current) // Cleanup on unmount or state change
  }, [isRecording]) // Depends on isRecording

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
        shouldTranscribeRef.current = true // Reset for next use
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
      setError('')
      setTranscription('')
    } catch (err) {
      setError('Failed to access microphone. Please allow microphone access.')
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  // Transcribe the recorded audio
  const transcribeAudio = async (audioBlob) => {
    abortControllerRef.current = new AbortController() // Create new AbortController
    setLoading(true)
    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.webm')

    try {
      const response = await axios.post('http://localhost:3001/transcribe', formData, {
        signal: abortControllerRef.current.signal, // Pass the signal for abortion
      })
      setTranscription(response.data.transcription)
      setEditedTranscription((prevEdited) =>
        prevEdited ? prevEdited + ' ' + response.data.transcription : response.data.transcription,
      )
      setError('')
    } catch (err) {
      if (axios.isCancel(err)) {
        setError('Transcription canceled by user.')
      } else {
        const errorMsg = err.response?.data?.error || err.message
        setError(`Failed to transcribe audio: ${errorMsg}`)
      }
    } finally {
      setLoading(false)
      abortControllerRef.current = null // Reset after operation
    }
  }

  // Handle cancel transcription (for ongoing transcription)
  const cancelTranscription = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort() // Abort the request
      setLoading(false)
      setError('Transcription canceled.')
    }
  }

  // Handle cancel recording (stops without transcribing)
  const cancelRecording = () => {
    shouldTranscribeRef.current = false // Set to not transcribe
    stopRecording() // Stop the recording
  }

  // Handle textarea changes
  const handleTranscriptionEdit = (e) => {
    setEditedTranscription(e.target.value)
  }

  const statusText = isRecording
    ? `Recording, ${recordingTime} seconds`
    : loading
    ? 'Transcribing...'
    : 'Idle'

  return (
    <div className="container">
      <h1>OpenAI-Powered Audio Transcription</h1>
      {/* New addition: Colored box for keyboard commands */}
      <div className="alert alert-info mt-3">
        <h5>Keyboard Commands</h5>
        <ul>
          <li>Ctrl + Space: Start/Stop Recording</li>
          <li>Ctrl + X: Cancel Recording (while recording)</li>
        </ul>
      </div>
      <div className="controls mt-3">
        <div className="d-flex">
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
          {isRecording && ( // Show cancel button only during recording
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
        {/* Removed redundant keyboard commands paragraph */}
      </div>
      {error && <p className="error">{error}</p>}

      <div className="transcription">
        {/* <p>{isRecording ? `Recording: ${recordingTime} seconds` : 'Idle'}</p>{' '} */}
        {/* Add timer display here */}
        <textarea
          ref={textareaRef} // Attach ref to textarea
          value={editedTranscription}
          onChange={handleTranscriptionEdit}
          rows={10}
          style={{ width: '100%', padding: '8px', borderRadius: '4px' }}
          placeholder="Transcription will appear here..."
        />
      </div>
      <p
        className="my-2"
        // style={{ visibility: loading ? 'visible' : 'hidden' }}
      >
        Status: {statusText}
      </p>
    </div>
  )
}

export default App
