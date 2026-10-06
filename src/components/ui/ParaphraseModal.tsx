import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { ApiKeys } from '../../types'
import { useNarrationPlayback } from '../../hooks/useNarrationPlayback'
import {
  getKidFriendlyParaphrase,
  hashParagraphText,
} from '../../services/paragraphParaphrase'
import HighlightedText from './HighlightedText'
import PlaybackControls from './PlaybackControls'

type Accent = 'sky' | 'amber'

interface ParaphraseModalProps {
  sourceText: string
  apiKeys: ApiKeys
  voiceId: string | null
  accent: Accent
  onClose: () => void
}

type ParaphraseState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; text: string }

const ACCENT_CLASSES: Record<Accent, { border: string; title: string; muted: string; button: string }> = {
  sky: {
    border: 'border-sky-400/30',
    title: 'text-sky-300',
    muted: 'text-sky-400/70',
    button: 'border-sky-400/50 text-sky-300 hover:bg-sky-400/10',
  },
  amber: {
    border: 'border-amber-400/30',
    title: 'text-amber-300',
    muted: 'text-amber-400/70',
    button: 'border-amber-400/50 text-amber-300 hover:bg-amber-400/10',
  },
}

export default function ParaphraseModal({
  sourceText,
  apiKeys,
  voiceId,
  accent,
  onClose,
}: ParaphraseModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [state, setState] = useState<ParaphraseState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const colors = ACCENT_CLASSES[accent]

  const paraphrase = state.status === 'ready' ? state.text : null

  const {
    audioRef,
    audioUrl,
    isLoading,
    isPlaying,
    isReady,
    duration,
    currentTime,
    speed,
    activeWordIndex,
    error: narrationError,
    togglePlay,
    pause,
    skip,
    seek,
    seekToWord,
    cycleSpeed,
  } = useNarrationPlayback({
    text: paraphrase ?? '',
    messageId: `paraphrase:${hashParagraphText(sourceText)}:${voiceId ?? 'default'}`,
    elevenLabsApiKey: apiKeys.elevenLabs,
    voiceId,
    enabled: paraphrase !== null,
  })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    getKidFriendlyParaphrase(sourceText, apiKeys)
      .then((text) => {
        if (!cancelled) setState({ status: 'ready', text })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not explain this paragraph.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [sourceText, apiKeys, attempt])

  const handleClose = useCallback(() => {
    pause()
    onClose()
  }, [pause, onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()
    return () => previouslyFocused?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
        return
      }
      if (e.code !== 'Space') return
      if (isTypingInField(e.target)) return
      e.preventDefault()
      togglePlay()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleClose, togglePlay])

  const trapFocus = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab' || !dialogRef.current) return
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), summary, [tabindex="0"]'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const handleWordClick = (wordIndex: number) => {
    if (isPlaying) pause()
    seekToWord(wordIndex)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapFocus}
        className={`card ${colors.border} p-0 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <h2 id={titleId} className={`font-display text-xl ${colors.title}`}>
            Explained simpler
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            aria-label="Close explanation"
            title="Close (Esc)"
            className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-5 space-y-4">
          <details className="text-sm text-gray-500">
            <summary className="cursor-pointer select-none hover:text-gray-300">
              Original paragraph
            </summary>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{sourceText}</p>
          </details>

          {state.status === 'loading' && (
            <p className={`font-mono text-sm ${colors.muted}`} role="status">
              Making it simpler…
            </p>
          )}

          {state.status === 'error' && (
            <div role="alert" className="space-y-3">
              <p className="text-sm text-danger">{state.message}</p>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className={`px-4 py-2 min-h-[44px] rounded-lg border font-semibold transition-colors ${colors.button}`}
              >
                Retry
              </button>
            </div>
          )}

          {paraphrase !== null && (
            <>
              <p className="text-lg leading-relaxed text-gray-200">
                <HighlightedText
                  message={paraphrase}
                  activeWordIndex={activeWordIndex}
                  theme="tutor"
                  onWordClick={handleWordClick}
                  wordClickEnabled={isReady && !isPlaying}
                />
              </p>
              {isLoading && (
                <p className={`text-xs font-mono ${colors.muted}`}>Preparing narration…</p>
              )}
              {narrationError && <p className="text-xs text-danger">{narrationError}</p>}
              {isReady && (
                <p className="text-xs text-gray-500">
                  Press Space to play/pause · Click a word while paused to jump there · Esc to
                  close
                </p>
              )}
            </>
          )}
        </div>

        {paraphrase !== null && (
          <PlaybackControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            speed={speed}
            disabled={!isReady || isLoading}
            onTogglePlay={togglePlay}
            onSkip={skip}
            onSeek={seek}
            onCycleSpeed={cycleSpeed}
          />
        )}

        {audioUrl && (
          <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
        )}
      </div>
    </div>
  )
}

function isTypingInField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}
