import React from 'react'

/**
 * Audio level visualizer component
 * @param {Object} props
 * @param {number} props.audioLevel - Current audio level (0-1)
 */
export function AudioVisualizer({ audioLevel }) {
  const getColor = () => {
    if (audioLevel > 0.7) return '#dc3545'
    if (audioLevel > 0.3) return '#fd7e14'
    return '#28a745'
  }

  return (
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
          backgroundColor: getColor(),
          transition: 'width 0.1s ease-out',
          borderRadius: '2px',
        }}
      />
    </div>
  )
}
