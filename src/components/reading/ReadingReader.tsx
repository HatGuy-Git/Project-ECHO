import { useEffect, useState } from 'react'
import type { Screen } from '../../App'
import type { ApiKeys, ReadingDocument } from '../../types'
import { useNarrationPlayback } from '../../hooks/useNarrationPlayback'
import {
  getAvailableVoices,
  TUTOR_VOICE,
  type ElevenLabsVoice,
} from '../../services/textToSpeech'
import HighlightedText from '../ui/HighlightedText'
import PlaybackControls from '../ui/PlaybackControls'
import VoiceSelect from '../ui/VoiceSelect'

interface ReadingReaderProps {
  document: ReadingDocument
  apiKeys: ApiKeys
  onBack: () => void
  onNavigate: (screen: Screen) => void
  onChunkChange: (index: number) => void
  onVoiceChange: (voiceId: string) => void
  onReset: () => void
}

export default function ReadingReader({
  document,
  apiKeys,
  onBack,
  onNavigate,
  onChunkChange,
  onVoiceChange,
  onReset,
}: ReadingReaderProps) {
  const chunk = document.chunks[document.currentChunkIndex]
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(!!apiKeys.elevenLabs)
  const preferredVoiceId =
    document.voiceId || apiKeys.tutorVoiceId || apiKeys.elevenLabsVoiceId || TUTOR_VOICE.defaultVoiceId
  const resolvedVoiceId = resolveVoiceId(preferredVoiceId, voices)

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
    error,
    togglePlay,
    pause,
    skip,
    seek,
    seekToWord,
    cycleSpeed,
  } = useNarrationPlayback({
    text: chunk?.content ?? '',
    messageId: `reading:${document.id}:${chunk?.id ?? 'none'}:${resolvedVoiceId}`,
    elevenLabsApiKey: apiKeys.elevenLabs,
    voiceId: resolvedVoiceId,
    enabled: !voicesLoading,
  })

  useEffect(() => {
    let cancelled = false
    setVoicesLoading(true)
    getAvailableVoices(apiKeys.elevenLabs ?? '')
      .then((list) => {
        if (cancelled) return
        setVoices(list)
        if (
          list.length > 0 &&
          !list.some((voice) => voice.voice_id === preferredVoiceId)
        ) {
          onVoiceChange(resolveVoiceId(preferredVoiceId, list))
        }
      })
      .finally(() => {
        if (!cancelled) setVoicesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [apiKeys.elevenLabs])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      if (isTypingInField(e.target)) return
      e.preventDefault()
      togglePlay()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePlay])

  if (!chunk) {
    return (
      <div className="min-h-screen p-6">
        <p className="text-gray-400">No reading chunks found.</p>
        <button onClick={onReset} className="btn btn-solid mt-4">
          Upload another PDF
        </button>
      </div>
    )
  }

  const handleWordClick = (wordIndex: number) => {
    if (isPlaying) pause()
    seekToWord(wordIndex)
  }

  const total = document.chunks.length
  const index = document.currentChunkIndex
  const controlsDisabled = !isReady || isLoading
  const selectedVoice = resolvedVoiceId

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-6 pb-28">
        <header className="max-w-3xl mx-auto w-full mb-4">
          <button
            onClick={onBack}
            className="text-amber-300 hover:text-amber-200 transition-colors mb-4 flex items-center gap-2"
          >
            <span>←</span>
            <span>Back to Modules</span>
          </button>

          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-amber-400/70 font-mono text-xs mb-1">
                {chunk.title} · {index + 1} of {total}
                {chunk.usedOcr ? ' · OCR' : ''}
              </p>
              <h1 className="font-display text-2xl text-amber-300">{document.title}</h1>
            </div>
            <VoiceSelect
              voices={voices}
              value={selectedVoice}
              isLoading={voicesLoading}
              disabled={isLoading}
              onChange={onVoiceChange}
            />
          </div>

          {isLoading && (
            <p className="text-xs text-amber-400/70 mt-2 font-mono">Preparing narration…</p>
          )}
          {error && <p className="text-xs text-danger mt-2">{error}</p>}
          {isReady && (
            <p className="text-xs text-gray-500 mt-2">
              Press Space to play/pause · Click a word while paused to jump there
            </p>
          )}
        </header>

        <main className="max-w-3xl mx-auto w-full">
          <div className="card border-amber-400/20 p-6 mb-6">
            <p className="text-lg leading-relaxed text-gray-200 whitespace-pre-wrap">
              <HighlightedText
                message={chunk.content}
                activeWordIndex={activeWordIndex}
                theme="tutor"
                onWordClick={handleWordClick}
                wordClickEnabled={isReady && !isPlaying}
              />
            </p>
          </div>

          <div className="flex flex-wrap gap-3 justify-between">
            <button
              onClick={() => onChunkChange(index - 1)}
              disabled={index === 0}
              className="btn btn-glitch"
            >
              ← Previous
            </button>
            <button onClick={onReset} className="btn border-gray-600 text-gray-400">
              New PDF
            </button>
            <button
              onClick={() => onNavigate('settings')}
              className="btn border-gray-600 text-gray-400"
            >
              ⚙️ Settings
            </button>
            <button
              onClick={() => onChunkChange(index + 1)}
              disabled={index >= total - 1}
              className="btn btn-solid"
            >
              Next →
            </button>
          </div>
        </main>
      </div>

      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
      )}

      <div className="fixed bottom-0 left-0 right-0 z-20">
        <PlaybackControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          speed={speed}
          disabled={controlsDisabled}
          onTogglePlay={togglePlay}
          onSkip={skip}
          onSeek={seek}
          onCycleSpeed={cycleSpeed}
        />
      </div>
    </div>
  )
}

function resolveVoiceId(
  preferredVoiceId: string,
  voices: ElevenLabsVoice[]
): string {
  if (voices.some((voice) => voice.voice_id === preferredVoiceId)) {
    return preferredVoiceId
  }
  return voices[0]?.voice_id ?? preferredVoiceId
}

function isTypingInField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}
