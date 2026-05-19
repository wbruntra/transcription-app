import { useEffect, useCallback } from 'react'

/**
 * Hook for handling keyboard shortcuts
 * @param {Object} options - Keyboard action handlers
 * @param {boolean} options.enabled - Whether shortcuts are enabled
 * @param {boolean} options.isRecording - Current recording state
 * @param {boolean} options.loading - Current loading state
 * @param {() => void} options.onToggleRecording - Toggle recording handler
 * @param {() => void} options.onCancelRecording - Cancel recording handler
 */
export function useKeyboardShortcuts({
  enabled = true,
  isRecording,
  loading,
  onToggleRecording,
  onCancelRecording,
}) {
  const handleKeyPress = useCallback(
    (event) => {
      if (!event.ctrlKey || event.repeat || loading) return

      if (event.code === 'Space') {
        event.preventDefault()
        onToggleRecording()
      } else if (event.code === 'KeyX' && isRecording) {
        event.preventDefault()
        onCancelRecording()
      }
    },
    [isRecording, loading, onToggleRecording, onCancelRecording]
  )

  useEffect(() => {
    if (!enabled) return

    document.addEventListener('keydown', handleKeyPress)
    return () => {
      document.removeEventListener('keydown', handleKeyPress)
    }
  }, [enabled, handleKeyPress])
}
