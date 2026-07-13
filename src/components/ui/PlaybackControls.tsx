interface PlaybackControlsProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  speed: number
  disabled?: boolean
  onTogglePlay: () => void
  onSkip: (seconds: number) => void
  onSeek: (time: number) => void
  onCycleSpeed: () => void
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function PlaybackControls({
  isPlaying,
  currentTime,
  duration,
  speed,
  disabled = false,
  onTogglePlay,
  onSkip,
  onSeek,
  onCycleSpeed,
}: PlaybackControlsProps) {
  return (
    <div className="border-t border-sky-400/20 px-4 py-3 bg-void-light/80 backdrop-blur-sm">
      <div className="flex items-center gap-3 max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => onSkip(-5)}
          disabled={disabled}
          className="p-2 text-gray-400 hover:text-sky-300 disabled:opacity-40 transition-colors"
          title="Back 5 seconds"
          aria-label="Back 5 seconds"
        >
          <SkipBackIcon />
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          disabled={disabled}
          className="p-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-void rounded-full transition-colors"
          title="Play / Pause (Space)"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          type="button"
          onClick={() => onSkip(5)}
          disabled={disabled}
          className="p-2 text-gray-400 hover:text-sky-300 disabled:opacity-40 transition-colors"
          title="Forward 5 seconds"
          aria-label="Forward 5 seconds"
        >
          <SkipForwardIcon />
        </button>

        <span className="text-xs text-gray-500 font-mono min-w-[3rem] text-center tabular-nums">
          {formatTime(currentTime)}
        </span>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          disabled={disabled || duration <= 0}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="flex-1 h-1.5 accent-sky-400 cursor-pointer disabled:opacity-40"
          aria-label="Seek"
        />

        <span className="text-xs text-gray-500 font-mono min-w-[3rem] text-center tabular-nums">
          {formatTime(duration)}
        </span>

        <button
          type="button"
          onClick={onCycleSpeed}
          disabled={disabled}
          className="px-2.5 py-1 text-xs font-mono font-medium text-gray-300 bg-void-lighter border border-gray-700 rounded hover:border-sky-400/40 disabled:opacity-40 min-w-[3.25rem] transition-colors"
          title="Playback speed"
        >
          {speed}×
        </button>
      </div>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
    </svg>
  )
}

function SkipBackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}

function SkipForwardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  )
}
