interface RecordButtonProps {
  isRecording: boolean
  isPaused?: boolean
  isProcessing?: boolean
  onStart: () => void
  onStop: () => void
  disabled?: boolean
  size?: 'normal' | 'large'
}

export default function RecordButton({
  isRecording,
  isPaused = false,
  isProcessing = false,
  onStart,
  onStop,
  disabled = false,
  size = 'large',
}: RecordButtonProps) {
  const sizeClasses = {
    normal: 'w-16 h-16',
    large: 'w-24 h-24',
  }

  const iconSize = size === 'large' ? 'text-4xl' : 'text-2xl'

  const handleClick = () => {
    if (isRecording) {
      onStop()
    } else {
      onStart()
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleClick}
        disabled={disabled || isProcessing}
        className={`
          ${sizeClasses[size]}
          rounded-full
          flex items-center justify-center
          transition-all duration-300
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4
          ${isRecording 
            ? 'bg-danger animate-pulse shadow-danger focus-visible:outline-danger' 
            : 'bg-mainframe/20 border-4 border-mainframe hover:bg-mainframe/30 hover:scale-105 shadow-mainframe focus-visible:outline-mainframe'
          }
          ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isProcessing ? (
          <div className="w-8 h-8 border-4 border-mainframe/30 border-t-mainframe rounded-full animate-spin" />
        ) : isRecording ? (
          // Stop icon (square)
          <div className="w-8 h-8 bg-white rounded-sm" />
        ) : (
          // Microphone icon
          <span className={iconSize}>🎤</span>
        )}
      </button>

      {/* Status text */}
      <div className="text-center">
        {isProcessing ? (
          <p className="text-mainframe font-mono text-sm animate-pulse">
            Processing transmission...
          </p>
        ) : isRecording ? (
          <p className="text-danger font-mono text-sm animate-pulse">
            {isPaused ? '⏸ PAUSED' : '● RECORDING'}
          </p>
        ) : (
          <p className="text-gray-400 font-mono text-sm">
            Tap to transmit
          </p>
        )}
      </div>
    </div>
  )
}


