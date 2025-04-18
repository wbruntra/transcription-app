import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import './index.css'

function App() {
  const [transcription, setTranscription] = useState('')
  const [editedTranscription, setEditedTranscription] = useState('')
  const [isRealtime, setIsRealtime] = useState(false)
  const [streamedTranscription, setStreamedTranscription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const realtimePcRef = useRef(null)
  const realtimeDcRef = useRef(null)
  const realtimeStreamRef = useRef(null)

  // Start realtime transcription
  const startRealtime = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      realtimeStreamRef.current = stream

      // Get session token from backend
      const tokenRes = await axios.post('http://localhost:3001/realtime-token')
      const { session_id: sessionId, token } = tokenRes.data
      if (!sessionId) throw new Error('Missing session_id from server')

      // Create peer connection
      const pc = new RTCPeerConnection()
      realtimePcRef.current = pc

      // Add audio track
      pc.addTrack(stream.getTracks()[0])

      // Create data channel with open/error handlers
      const dc = pc.createDataChannel('transcription')
      realtimeDcRef.current = dc

      // Wait for data channel to open before sending config
      await new Promise((resolve, reject) => {
        dc.onopen = resolve
        dc.onerror = (err) => reject(new Error('Data channel failed to open'))
      })

      // Handle transcription messages
      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          console.log('Received message:', msg) // Debug logging
          
          if (msg.type === 'transcription_event') {
            const txt = msg.input_audio_transcription?.text
            if (txt) {
              setStreamedTranscription(prev => prev + txt + ' ')
              setEditedTranscription(prev => prev + txt + ' ')
            }
          } else if (msg.type === 'error') {
            console.error('Transcription error:', msg)
            setError(msg.message || 'Transcription error occurred')
          }
        } catch (e) {
          console.error('DataChannel parse error', e)
          setError('Failed to parse transcription message')
        }
      }

      // Add error handler
      dc.onerror = (error) => {
        console.error('DataChannel error:', error)
        setError('Data channel error occurred')
      }

      // Create offer and set up session
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Wait for ICE gathering to complete
      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve()
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState)
              resolve()
            }
          }
          pc.addEventListener('icegatheringstatechange', checkState)
        }
      })

      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime`, {
        method: 'POST',
        body: pc.localDescription.sdp,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/sdp',
        },
      })

      if (!sdpResponse.ok) {
        throw new Error(`Failed to establish WebRTC connection: ${sdpResponse.status}`)
      }

      const answer = {
        type: 'answer',
        sdp: await sdpResponse.text(),
      }
      await pc.setRemoteDescription(new RTCSessionDescription(answer))

      console.log('Initializing transcription session...')
      const initMessage = {
        type: 'transcription_session.update',
        input_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'gpt-4o-transcribe',
          prompt: '',
          language: 'en'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        input_audio_noise_reduction: {
          type: 'near_field'
        },
        include: ['item.input_audio_transcription.logprobs']
      }
      console.log('Sent initialization message:', initMessage)
      setIsRecording(true)
      setError('')
      setStreamedTranscription('')
      setEditedTranscription('')
    } catch (err) {
      setError(`Realtime error: ${err.message}`)
      console.error('Realtime transcription error:', err)
      stopRealtime()
    }
  }

  // Stop realtime transcription
  const stopRealtime = () => {
    if (realtimeStreamRef.current) {
      realtimeStreamRef.current.getTracks().forEach(t => t.stop())
      realtimeStreamRef.current = null
    }
    if (realtimeDcRef.current) {
      try {
        realtimeDcRef.current.close()
      } catch (e) {
        console.error('Error closing data channel:', e)
      }
      realtimeDcRef.current = null
    }
    if (realtimePcRef.current) {
      realtimePcRef.current.close()
      realtimePcRef.current = null
    }
    setIsRecording(false)
  }

  // Start recording (either realtime or file-based)
  const startRecording = async () => {
    if (isRealtime) {
      return startRealtime()
    }

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
      setEditedTranscription('')
    } catch (err) {
      setError('Failed to access microphone. Please allow microphone access.')
    }
  }

  // Stop recording (handles both modes)
  const stopRecording = () => {
    if (isRealtime) {
      return stopRealtime()
    }
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
      setEditedTranscription(response.data.transcription) // Initialize textarea
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
        <div className="mode-toggle">
          <label>
            <input 
              type="checkbox" 
              checked={isRealtime}
              onChange={() => setIsRealtime(!isRealtime)}
              disabled={isRecording}
            />
            Realtime Mode
          </label>
        </div>
        <button onClick={isRecording ? stopRecording : startRecording} disabled={loading}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        {loading && !isRealtime && <p>Transcribing...</p>}
      </div>
      {error && <p className="error">{error}</p>}

      <div className="transcription">
        <h2>Transcription:</h2>
        {isRealtime && isRecording && (
          <div className="realtime-indicator">Realtime transcription active...</div>
        )}
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
