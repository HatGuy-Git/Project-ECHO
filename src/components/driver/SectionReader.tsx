import { useEffect, useState } from 'react'

import type { ApiKeys, DriverManualData, StudySection } from '../../types'

import { useNarrationPlayback } from '../../hooks/useNarrationPlayback'

import StudyContent from '../ui/StudyContent'

import HighlightedText from '../ui/HighlightedText'

import PlaybackControls from '../ui/PlaybackControls'

import ParaphraseModal from '../ui/ParaphraseModal'



interface SectionReaderProps {

  manual: DriverManualData

  section: StudySection

  apiKeys: ApiKeys

  onBack: () => void

  onSectionChange: (index: number) => void

}



export default function SectionReader({

  manual,

  section,

  apiKeys,

  onBack,

  onSectionChange,

}: SectionReaderProps) {

  const messageId = `tutor:tn-driver:${section.id}`

  const sectionIndex = manual.currentSectionIndex

  const totalSections = manual.sections.length

  const hasStructuredContent = (section.blocks?.length ?? 0) > 0

  const voiceId = apiKeys.tutorVoiceId || apiKeys.elevenLabsVoiceId

  const [explain, setExplain] = useState<{ text: string; resumeOnClose: boolean } | null>(null)

  const isExplainOpen = explain !== null



  const {

    speechText,

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

    text: section.content,

    messageId,

    elevenLabsApiKey: apiKeys.elevenLabs,

    voiceId,

  })



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



  const goToSection = (index: number) => {

    if (index < 0 || index >= totalSections) return

    onSectionChange(index)

  }



  const handleWordClick = (wordIndex: number) => {

    if (isPlaying) {

      pause()

    }

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



  const speechTruncated = speechText.length < section.content.length

  const controlsDisabled = !isReady || isLoading



  return (

    <div className="min-h-screen flex flex-col">

      <div className="flex-1 p-6 pb-28">

        <header className="max-w-3xl mx-auto w-full mb-4">

          <button

            onClick={onBack}

            className="text-sky-300 hover:text-sky-200 transition-colors mb-4 flex items-center gap-2"

          >

            <span>←</span>

            <span>Section List</span>

          </button>



          <div>

            <p className="text-sky-400/70 font-mono text-xs mb-1">

              {section.sectionLabel ?? `Section ${sectionIndex + 1}`} ·{' '}

              {sectionIndex + 1} of {totalSections}

            </p>

            <h1 className="font-display text-2xl text-sky-300">{section.title}</h1>

            {section.testFocus && (

              <p className="text-sm text-gray-400 mt-2 leading-relaxed">

                <span className="text-sky-400/70 font-mono text-xs uppercase tracking-wide">

                  Written test focus:{' '}

                </span>

                {section.testFocus}

              </p>

            )}

          </div>



          {isLoading && (

            <p className="text-xs text-sky-400/70 mt-2 font-mono">Preparing narration…</p>

          )}

          {error && (

            <p className="text-xs text-danger mt-2">{error}</p>

          )}

          {isReady && (

            <p className="text-xs text-gray-500 mt-2">

              Press Space to play/pause · Click a word while paused to jump there

            </p>

          )}

        </header>



        <main className="max-w-3xl mx-auto w-full">

          <div className="card border-sky-400/20 p-6 mb-6">

            {hasStructuredContent ? (

              <StudyContent

                blocks={section.blocks ?? []}

                activeWordIndex={activeWordIndex}

                onWordClick={handleWordClick}

                wordClickEnabled={isReady && !isPlaying}

                onExplainBlock={openExplain}

              />

            ) : (

              <p className="text-lg leading-relaxed text-gray-200">

                <HighlightedText

                  message={speechTruncated ? speechText : section.content}

                  activeWordIndex={activeWordIndex}

                  theme="tutor"

                  onWordClick={handleWordClick}

                  wordClickEnabled={isReady && !isPlaying}

                />

              </p>

            )}

            {speechTruncated && (

              <p className="text-xs text-gray-500 mt-4">

                Long section — narration covers the first portion. Read the full text on screen.

              </p>

            )}

          </div>



          {speechTruncated && (

            <div className="card bg-void-lighter/40 p-4 mb-6 max-h-48 overflow-y-auto">

              <p className="text-sm text-gray-400 whitespace-pre-wrap">

                {section.content.slice(speechText.length)}

              </p>

            </div>

          )}



          <div className="flex flex-wrap gap-3 justify-between">

            <button

              onClick={() => goToSection(sectionIndex - 1)}

              disabled={sectionIndex === 0}

              className="btn btn-glitch"

            >

              ← Previous Section

            </button>



            <button

              onClick={() => goToSection(sectionIndex + 1)}

              disabled={sectionIndex >= totalSections - 1}

              className="btn btn-solid"

            >

              Next Section →

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

          voiceId={voiceId}

          accent="sky"

          onClose={closeExplain}

        />

      )}

    </div>

  )

}



function isTypingInField(target: EventTarget | null): boolean {

  if (!(target instanceof HTMLElement)) return false

  const tag = target.tagName

  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable

}

