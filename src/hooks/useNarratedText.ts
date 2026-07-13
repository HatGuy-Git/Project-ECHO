import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  prefetchNarrationAudioOnce,
  playNarratedAudio,
  clearMessageSession,
  setWordHighlightProgress,
  stopSpeech,
  isAudioReady,
  initAudioContext,
} from '../services/textToSpeech'
import {
  buildEstimatedWordTimings,
  countWords,
  getActiveWordIndex,
  type WordTiming,
} from '../utils/wordHighlight'

interface UseNarratedTextOptions {
  text: string
  messageId: string
  elevenLabsApiKey: string | null
  voiceId: string | null
  playbackRate?: number
  enabled?: boolean
  autoPlay?: boolean
}

export function useNarratedText({
  text,
  messageId,
  elevenLabsApiKey,
  voiceId,
  playbackRate = 1,
  enabled = true,
  autoPlay = true,
}: UseNarratedTextOptions) {
  const speechText = useMemo(() => truncateForSpeech(text), [text])
  const wordCount = useMemo(() => countWords(speechText), [speechText])

  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null)
  const [isHighlightComplete, setIsHighlightComplete] = useState(!enabled)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMountedRef = useRef(true)
  const wordTimingsRef = useRef<WordTiming[]>([])
  const effectGenerationRef = useRef(0)
  const playbackRateRef = useRef(playbackRate)

  useEffect(() => {
    playbackRateRef.current = playbackRate
  }, [playbackRate])

  const finishHighlight = useCallback(() => {
    setActiveWordIndex(null)
    setIsHighlightComplete(true)
    setWordHighlightProgress(messageId, wordCount)
  }, [messageId, wordCount])

  const syncHighlightToElapsed = useCallback((elapsedSeconds: number) => {
    const wordIndex = getActiveWordIndex(wordTimingsRef.current, elapsedSeconds)
    setActiveWordIndex(wordIndex)
    if (wordIndex !== null) {
      setWordHighlightProgress(messageId, wordIndex)
    }
  }, [messageId])

  const playFromCached = useCallback(async (
    blob: Blob,
    wordTimings: WordTiming[],
    generation: number
  ) => {
    wordTimingsRef.current = wordTimings
    setIsLoading(false)
    setIsSpeaking(true)
    setIsHighlightComplete(false)
    setActiveWordIndex(null)

    try {
      await playNarratedAudio(blob, (elapsed) => {
        if (!isMountedRef.current || generation !== effectGenerationRef.current) return
        syncHighlightToElapsed(elapsed)
      }, playbackRateRef.current)
    } catch (err) {
      console.error('[useNarratedText] Playback error:', err)
      setError('Audio playback failed.')
    }

    if (isMountedRef.current && generation === effectGenerationRef.current) {
      setIsSpeaking(false)
      finishHighlight()
    }
  }, [finishHighlight, syncHighlightToElapsed])

  useEffect(() => {
    if (!enabled || !autoPlay) {
      finishHighlight()
      return
    }

    isMountedRef.current = true
    const generation = ++effectGenerationRef.current

    clearMessageSession(messageId)
    stopSpeech()
    setError(null)
    setIsLoading(!!elevenLabsApiKey)

    if (!elevenLabsApiKey) {
      setIsLoading(false)
      setError('Add an ElevenLabs API key in Settings to hear narration.')
      finishHighlight()
      return
    }

    prefetchNarrationAudioOnce(messageId, speechText, elevenLabsApiKey, voiceId)
      .then(async (result) => {
        if (!isMountedRef.current || generation !== effectGenerationRef.current) return

        if (!isAudioReady()) {
          try {
            await initAudioContext()
          } catch {
            // May require user gesture
          }
        }

        if (!isMountedRef.current || generation !== effectGenerationRef.current) return

        if (result) {
          await playFromCached(result.blob, result.wordTimings, generation)
        } else {
          setIsLoading(false)
          const timings = buildEstimatedWordTimings(speechText, Math.max(wordCount * 0.35, 3))
          setIsSpeaking(true)
          setIsHighlightComplete(false)
          let start = performance.now()
          const duration = timings[timings.length - 1]?.endTime ?? 3

          const tick = () => {
            if (!isMountedRef.current || generation !== effectGenerationRef.current) return
            const elapsed = ((performance.now() - start) / 1000) * playbackRateRef.current
            syncHighlightToElapsed(elapsed)
            if (elapsed < duration) {
              requestAnimationFrame(tick)
            } else {
              setIsSpeaking(false)
              finishHighlight()
            }
          }
          requestAnimationFrame(tick)
        }
      })
      .catch((err) => {
        console.error('[useNarratedText] Fetch error:', err)
        if (isMountedRef.current && generation === effectGenerationRef.current) {
          setIsLoading(false)
          setError('Failed to prepare narration.')
          finishHighlight()
        }
      })

    return () => {
      isMountedRef.current = false
      stopSpeech()
    }
  }, [
    messageId,
    speechText,
    elevenLabsApiKey,
    voiceId,
    enabled,
    autoPlay,
    wordCount,
    finishHighlight,
    playFromCached,
    syncHighlightToElapsed,
  ])

  const replay = useCallback(async () => {
    stopSpeech()
    clearMessageSession(messageId)
    setIsHighlightComplete(false)
    setActiveWordIndex(null)
    setIsLoading(true)
    setError(null)

    if (!elevenLabsApiKey) {
      setIsLoading(false)
      return
    }

    const generation = ++effectGenerationRef.current
    const result = await prefetchNarrationAudioOnce(messageId, speechText, elevenLabsApiKey, voiceId)
    if (result && isMountedRef.current) {
      await playFromCached(result.blob, result.wordTimings, generation)
    }
  }, [messageId, speechText, elevenLabsApiKey, voiceId, playFromCached])

  return {
    speechText,
    activeWordIndex: !isHighlightComplete ? activeWordIndex : null,
    isLoading,
    isSpeaking,
    isComplete: isHighlightComplete,
    error,
    replay,
  }
}

function truncateForSpeech(text: string, maxChars = 4500): string {
  if (text.length <= maxChars) return text
  const truncated = text.slice(0, maxChars)
  const lastSentence = truncated.lastIndexOf('. ')
  if (lastSentence > maxChars * 0.6) {
    return truncated.slice(0, lastSentence + 1)
  }
  return `${truncated.trim()}…`
}
