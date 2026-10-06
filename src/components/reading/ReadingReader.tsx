import { useEffect, useMemo, useState } from 'react'
import type { Screen } from '../../App'
import type { ApiKeys, ReadingDocument } from '../../types'
import { useNarrationPlayback } from '../../hooks/useNarrationPlayback'
import {
  getAvailableVoices,
  TUTOR_VOICE,
  type ElevenLabsVoice,
} from '../../services/textToSpeech'
import { splitTextIntoBlocks } from '../../services/studyContentParser'
import ParaphraseModal from '../ui/ParaphraseModal'
import PlaybackControls from '../ui/PlaybackControls'
import StudyContent from '../ui/StudyContent'
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
  const [explain, setExplain] = useState<{ text: string; resumeOnClose: boolean } | null>(null)
  const isExplainOpen = explain !== null
  // Markers stay in the text so per-block word offsets match the narration of chunk.content.
  const blocks = useMemo(
    () => splitTextIntoBlocks(chunk?.content ?? '', { keepMarkers: true }),
    [chunk?.content]
  )

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
    play,
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
      if (isExplainOpen) return
      if (e.code !== 'Space') return
      if (isTypingInField(e.target)) return
      e.preventDefault()
      togglePlay()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePlay, isExplainOpen])

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

  const openExplain = (text: string) => {
    setExplain({ text, resumeOnClose: isPlaying })
    pause()
  }

  const closeExplain = () => {
    const resume = explain?.resumeOnClose
    setExplain(null)
    if (resume) play()
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
            <StudyContent
              blocks={blocks}
              activeWordIndex={activeWordIndex}
              theme="tutor"
              accent="amber"
              onWordClick={handleWordClick}
              wordClickEnabled={isReady && !isPlaying}
              onExplainBlock={openExplain}
            />
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

      {explain && (
        <ParaphraseModal
          sourceText={explain.text}
          apiKeys={apiKeys}
          voiceId={resolvedVoiceId}
          accent="amber"
          onClose={closeExplain}
        />
      )}
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
