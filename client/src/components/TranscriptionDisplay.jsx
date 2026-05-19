import React from 'react'

/**
 * Transcription display component with textarea and live text
 * @param {Object} props
 * @param {string} props.editedTranscription - Current edited transcription text
 * @param {(value: string) => void} props.onChange - Textarea change handler
 * @param {string} props.streamingText - Current live streaming text
 * @param {React.RefObject} props.textareaRef - Ref for textarea element
 */
export function TranscriptionDisplay({
  editedTranscription,
  onChange,
  streamingText,
  textareaRef,
}) {
  return (
    <>
      <div
        className="mt-2 p-2 rounded"
        style={{ backgroundColor: '#1a1a2e', border: '1px solid #4a4a6a', minHeight: '2.5rem' }}
      >
        <small className="text-info">Live:</small>
        <span className="ms-2" style={{ color: '#adb5bd' }}>
          {streamingText}
        </span>
      </div>

      <div className="transcription">
        <textarea
          ref={textareaRef}
          value={editedTranscription}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
          style={{ width: '100%', padding: '8px', borderRadius: '4px' }}
          placeholder="Transcription will appear here..."
        />
      </div>
    </>
  )
}
