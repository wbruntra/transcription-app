import { useState, useRef, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [transcription, setTranscription] = useState('')
  const [editedTranscription, setEditedTranscription] = useState('') // For textarea edits
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  // Add effect for keyboard event listener
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.code === 'Space' && !event.repeat && !loading) {
        // Use Spacebar and prevent repeated triggers
        event.preventDefault() // Prevent default to avoid scrolling or other actions
        if (!isRecording) {
          startRecording()
        } else {
          stopRecording()
        }
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => {
      document.removeEventListener('keydown', handleKeyPress) // Cleanup on unmount
    }
  }, [isRecording, loading]) // Re-run if isRecording or loading changes

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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' })
        await transcribeAudio(audioBlob)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
      setError('')
      setTranscription('')
      // setEditedTranscription('')  // This line has been removed as per the request
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
    setLoading(true)
    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.webm')

    try {
      const response = await axios.post('http://localhost:3001/transcribe', formData)
      setTranscription(response.data.transcription)
      setEditedTranscription((prevEdited) =>
        prevEdited ? prevEdited + '\n' + response.data.transcription : response.data.transcription,
      ) // Only add newline if prevEdited is not empty
      setError('')
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message
      setError(`Failed to transcribe audio: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  // Handle textarea changes
  const handleTranscriptionEdit = (e) => {
    setEditedTranscription(e.target.value)
  }

  return (
    <div className="container">
      <h1>Audio Transcription</h1>
      <div className="controls">
        <div className="d-flex">
          <div className={`recording-indicator ${isRecording ? 'active' : ''}`}></div>{' '}
          <button
            className={`btn btn-primary ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={loading}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
        </div>
        {/* Flashing red circle indicator */}
        <p style={{ visibility: loading ? 'visible' : 'hidden' }}>Transcribing...</p>
        <p>Press Spacebar to start/stop recording.</p> {/* Added visible documentation */}
      </div>
      {error && <p className="error">{error}</p>}

      <div className="transcription">
        <h2>Transcription:</h2>
        <textarea
          value={editedTranscription}
          onChange={handleTranscriptionEdit}
          rows={10}
          style={{ width: '100%', padding: '8px', borderRadius: '4px' }}
          placeholder="Transcription will appear here..."
        />
      </div>
    </div>
  )
}

export default App
