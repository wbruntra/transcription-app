import React from 'react'
import { AudioVisualizer } from './AudioVisualizer'

/**
 * Recording controls component with start/stop/cancel buttons
 * @param {Object} props
 * @param {boolean} props.isRecording - Whether currently recording
 * @param {boolean} props.loading - Whether transcription is in progress
 * @param {boolean} props.isStreamingMode - Whether in streaming mode
 * @param {number} props.audioLevel - Current audio level (0-1)
 * @param {() => void} props.onToggleRecording - Toggle recording handler
 * @param {() => void} props.onCancelRecording - Cancel recording handler
 * @param {() => void} props.onCancelTranscription - Cancel transcription handler
 */
export function RecordingControls({
  isRecording,
  loading,
  isStreamingMode,
  audioLevel,
  onToggleRecording,
  onCancelRecording,
  onCancelTranscription,
}) {
  const statusText = isRecording
    ? `Recording, recording seconds (streaming)`
    : loading
    ? 'Transcribing...'
    : 'Idle'

  return (
    <div className="controls mt-3">
      <div className="d-flex align-items-center">
        <div className={`recording-indicator ${isRecording ? 'active' : ''}`}></div>
        <button
          className={`btn btn-sm btn-primary ${isRecording ? 'recording' : ''}`}
          onClick={onToggleRecording}
          disabled={loading && !isStreamingMode}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        {isRecording && (
          <button className="btn btn-sm btn-warning ms-2" onClick={onCancelRecording}>
            Cancel Recording
          </button>
        )}
        {loading && !isStreamingMode && (
          <button className="btn btn-sm btn-danger ms-2" onClick={onCancelTranscription}>
            Cancel Transcription
          </button>
        )}
      </div>

      {isRecording && (
        <div className="mt-2">
          <small className="text-muted">Audio Level:</small>
          <AudioVisualizer audioLevel={audioLevel} />
        </div>
      )}
    </div>
  )
}
