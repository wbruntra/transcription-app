import { useState, useEffect, useRef } from 'react'

/**
 * Hook for managing recording timer
 * @param {boolean} isRecording - Whether currently recording
 * @returns {number} Current recording time in seconds
 */
export function useRecordingTimer(isRecording) {
  const [recordingTime, setRecordingTime] = useState(0)
  const timerRef = useRef(null)

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

  return recordingTime
}
