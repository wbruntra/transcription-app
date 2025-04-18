import { useState, useRef } from 'react'

// Global console interceptor to buffer logs for easier copying
if (typeof window !== 'undefined' && !window._appLogBuffer) {
  window._appLogBuffer = [];
  ['log', 'info', 'warn', 'error'].forEach((level) => {
    const original = console[level];
    console[level] = (...args) => {
      try {
        window._appLogBuffer.push({ level, args, ts: new Date().toISOString() });
      } catch (e) {
        // ignore
      }
      original.apply(console, args);
    };
  });
  // Expose a helper to retrieve the buffered logs
  window.getAppLogs = () => window._appLogBuffer.slice();
  // In Chrome devtools you can call: copy(getAppLogs()) to copy JSON logs
}
import axios from 'axios'
import './index.css'

function App() {
  const [transcription, setTranscription] = useState('')
  const [editedTranscription, setEditedTranscription] = useState('') // For textarea edits
  const [isRealtime, setIsRealtime] = useState(false)
  const [streamedTranscription, setStreamedTranscription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  // References for WebRTC PeerConnection and DataChannel
  const realtimePcRef = useRef(null)
  const realtimeDcRef = useRef(null)
  const realtimeStreamRef = useRef(null)

  // Helper: convert Float32 audio buffer to Int16 PCM
  const convertFloat32ToInt16 = (buffer) => {
    const l = buffer.length
    const buf = new Int16Array(l)
    for (let i = 0; i < l; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]))
      buf[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return buf
  }

  // Start real-time transcription via OpenAI Realtime API
  const startRealtime = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      realtimeStreamRef.current = stream

      // Obtain ephemeral token and session ID from backend
      const tokenRes = await axios.post('http://localhost:3001/realtime-token')
      const { session_id: sessionId, token: tokenEntry } = tokenRes.data
      if (!sessionId) throw new Error('Missing session_id from server')
      const token = typeof tokenEntry === 'string' ? tokenEntry : tokenEntry?.value
      if (!token) throw new Error('Invalid token from server')

      // Create RTCPeerConnection with STUN server for ICE and add local audio track
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      realtimePcRef.current = pc
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))
      // Create DataChannel for sending/receiving Realtime API events
      const dc = pc.createDataChannel('oai-events')
      realtimeDcRef.current = dc

      // Handle incoming messages (transcription events)
      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'transcription_event') {
            const txt = msg.input_audio_transcription?.text
            if (txt) setStreamedTranscription((prev) => prev + txt)
          }
        } catch (e) {
          console.error('DataChannel parse error', e)
        }
      }
      dc.onerror = (e) => {
        console.error('DataChannel error', e)
        setError('Real-time transcription error')
      }
      dc.onopen = () => {
        // Initialize transcription session
        dc.send(JSON.stringify({
          type: 'transcription_session.update',
          input_audio_format: 'pcm16',
          input_audio_transcription: { model: 'gpt-4o-transcribe', prompt: '', language: '' },
          turn_detection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 500 },
          input_audio_noise_reduction: { type: 'near_field' },
          include: ['item.input_audio_transcription.logprobs'],
        }))
      }

      // Create SDP offer and set local description
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Wait for ICE gathering to complete
      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve()
        } else {
          const handleIceCandidate = (event) => {
            if (event.candidate === null) {
              pc.removeEventListener('icecandidate', handleIceCandidate)
              resolve()
            }
          }
          pc.addEventListener('icecandidate', handleIceCandidate)
        }
      })

      // Handshake: send SDP offer to OpenAI Realtime API via REST (transcription intent)
      const handshakeUrl = 'https://api.openai.com/v1/realtime?intent=transcription'
      const sdpRes = await fetch(handshakeUrl, {
        method: 'POST',
        body: pc.localDescription.sdp,
        headers: {
          Authorization: `Bearer ${token}`,
          'OpenAI-Beta': 'realtime=v1',
          'Content-Type': 'application/sdp',
        },
      })
      const answerSdp = await sdpRes.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

      // Update UI state
      setIsRecording(true)
      setError('')
      setStreamedTranscription('')
      setTranscription('')
      setEditedTranscription('')
    } catch (err) {
      setError('Failed to start real-time transcription: ' + err.message)
    }
  }

  // Stop real-time transcription
  const stopRealtime = () => {
    if (realtimeStreamRef.current) {
      realtimeStreamRef.current.getTracks().forEach((t) => t.stop())
      realtimeStreamRef.current = null
    }
    if (realtimeDcRef.current) {
      realtimeDcRef.current.close()
      realtimeDcRef.current = null
    }
    if (realtimePcRef.current) {
      realtimePcRef.current.close()
      realtimePcRef.current = null
    }
    setIsRecording(false)
  }

  // Start recording (batch or real-time)
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
      setEditedTranscription('') // Clear textarea on new recording
    } catch (err) {
      setError('Failed to access microphone. Please allow microphone access.')
    }
  }

  // Stop recording (batch or real-time)
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
        <label style={{ marginRight: '1rem' }}>
          <input
            type="checkbox"
            checked={isRealtime}
            onChange={(e) => setIsRealtime(e.target.checked)}
            disabled={loading}
          />{' '}
          Real-time transcription
        </label>
        <button onClick={isRecording ? stopRecording : startRecording} disabled={loading}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        {loading && <p>Transcribing...</p>}
      </div>
      {error && <p className="error">{error}</p>}

      {isRealtime ? (
        <div className="transcription">
          <h2>Real-time Transcription:</h2>
          <div
            style={{
              width: '100%',
              minHeight: '150px',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {streamedTranscription}
          </div>
        </div>
      ) : (
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
      )}
    </div>
  )
}

export default App
