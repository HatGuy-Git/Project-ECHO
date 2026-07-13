import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { ApiKeys, CharacterType } from '../types'
import {
  prefetchCharacterAudioOnce,
  playCharacterAudioOnce,
  hasSpokenMessage,
  hasMessageSequenceStarted,
  markMessageSequenceStarted,
  setWordHighlightProgress,
  isAudioReady,
  initAudioContext,
} from '../services/textToSpeech'
import {
  buildEstimatedWordTimings,
  countWords,
  getActiveWordIndex,
  type WordTiming,
} from '../utils/wordHighlight'

interface UseCharacterMessageOptions {
  message: string
  character: CharacterType
  speakOnType?: boolean
  showTyping?: boolean
  elevenLabsApiKey: string | null
  apiKeys: ApiKeys
  onComplete?: () => void
}

export function useCharacterMessage({
  message,
  character,
  speakOnType = false,
  showTyping = true,
  elevenLabsApiKey,
  apiKeys,
  onComplete,
}: UseCharacterMessageOptions) {
  const messageId = useMemo(() => `${character}:${message}`, [character, message])
  const alreadySpoken = hasSpokenMessage(messageId)
  const wordCount = useMemo(() => countWords(message), [message])
  const voiceId =
    character === 'mainframe' ? apiKeys.mainframeVoiceId : apiKeys.drGlitchVoiceId

  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null)
  const [isHighlightComplete, setIsHighlightComplete] = useState(!showTyping || alreadySpoken)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSpeechComplete, setIsSpeechComplete] = useState(!speakOnType || alreadySpoken)
  const [isLoading, setIsLoading] = useState(speakOnType && !alreadySpoken && !!elevenLabsApiKey)

  const onCompleteRef = useRef(onComplete)
  const isMountedRef = useRef(true)
  const highlightRafRef = useRef<number | null>(null)
  const highlightStartRef = useRef<number | null>(null)
  const wordTimingsRef = useRef<WordTiming[]>([])
  const effectGenerationRef = useRef(0)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const isComplete = isHighlightComplete && isSpeechComplete

  useEffect(() => {
    if (isComplete) {
      onCompleteRef.current?.()
    }
  }, [isComplete])

  const clearHighlightAnimation = useCallback(() => {
    if (highlightRafRef.current !== null) {
      cancelAnimationFrame(highlightRafRef.current)
      highlightRafRef.current = null
    }
    highlightStartRef.current = null
  }, [])

  const finishHighlight = useCallback(() => {
    clearHighlightAnimation()
    setActiveWordIndex(null)
    setIsHighlightComplete(true)
    setWordHighlightProgress(messageId, wordCount)
  }, [clearHighlightAnimation, messageId, wordCount])

  const syncHighlightToElapsed = useCallback((elapsedSeconds: number) => {
    const wordIndex = getActiveWordIndex(wordTimingsRef.current, elapsedSeconds)
    setActiveWordIndex(wordIndex)
    if (wordIndex !== null) {
      setWordHighlightProgress(messageId, wordIndex)
    }
  }, [messageId])

  const startEstimatedHighlight = useCallback((wordTimings: WordTiming[]) => {
    if (!showTyping || wordTimings.length === 0) {
      finishHighlight()
      return
    }

    wordTimingsRef.current = wordTimings
    setIsHighlightComplete(false)
    clearHighlightAnimation()
    highlightStartRef.current = performance.now()

    const tick = () => {
      if (highlightStartRef.current === null) return
      const elapsed = (performance.now() - highlightStartRef.current) / 1000
      syncHighlightToElapsed(elapsed)

      const totalDuration = wordTimings[wordTimings.length - 1]?.endTime ?? 0
      if (elapsed < totalDuration) {
        highlightRafRef.current = requestAnimationFrame(tick)
      } else {
        finishHighlight()
      }
    }

    highlightRafRef.current = requestAnimationFrame(tick)
  }, [showTyping, finishHighlight, clearHighlightAnimation, syncHighlightToElapsed])

  useEffect(() => {
    isMountedRef.current = true
    const generation = ++effectGenerationRef.current

    clearHighlightAnimation()

    if (!speakOnType) {
      setIsSpeechComplete(true)
      setIsLoading(false)
      if (!hasMessageSequenceStarted(messageId)) {
        markMessageSequenceStarted(messageId)
        if (showTyping) {
          startEstimatedHighlight(buildEstimatedWordTimings(message, Math.max(wordCount * 0.35, 2)))
        } else {
          finishHighlight()
        }
      }
      return () => {
        isMountedRef.current = false
        clearHighlightAnimation()
      }
    }

    if (hasSpokenMessage(messageId)) {
      setIsSpeechComplete(true)
      setIsLoading(false)
      finishHighlight()
      return () => {
        isMountedRef.current = false
        clearHighlightAnimation()
      }
    }

    if (!elevenLabsApiKey) {
      setIsSpeaking(false)
      setIsSpeechComplete(true)
      setIsLoading(false)
      if (!hasMessageSequenceStarted(messageId)) {
        markMessageSequenceStarted(messageId)
        if (showTyping) {
          startEstimatedHighlight(buildEstimatedWordTimings(message, Math.max(wordCount * 0.35, 2)))
        } else {
          finishHighlight()
        }
      }
      return () => {
        isMountedRef.current = false
        clearHighlightAnimation()
      }
    }

    if (!hasMessageSequenceStarted(messageId)) {
      markMessageSequenceStarted(messageId)
      setIsLoading(true)
    }

    prefetchCharacterAudioOnce(messageId, message, character, elevenLabsApiKey, apiKeys)
      .then(async (result) => {
        if (!isMountedRef.current || generation !== effectGenerationRef.current) return

        if (result) {
          if (!isAudioReady()) {
            for (let i = 0; i < 20; i++) {
              await new Promise((resolve) => setTimeout(resolve, 100))
              if (!isMountedRef.current || generation !== effectGenerationRef.current) return
              if (isAudioReady()) break
            }
            if (!isAudioReady()) {
              try {
                await initAudioContext()
              } catch {
                // Audio may require a user gesture
              }
            }
          }

          if (!isMountedRef.current || generation !== effectGenerationRef.current) return

          wordTimingsRef.current = result.wordTimings
          setIsLoading(false)
          setIsSpeaking(true)
          setIsHighlightComplete(false)
          setActiveWordIndex(null)

          try {
            await playCharacterAudioOnce(messageId, result.blob, (elapsed) => {
              if (!isMountedRef.current || generation !== effectGenerationRef.current) return
              syncHighlightToElapsed(elapsed)
            })
          } catch (error) {
            console.error(`[${character}Message] Audio playback error:`, error)
          }

          if (isMountedRef.current && generation === effectGenerationRef.current) {
            setIsSpeaking(false)
            setIsSpeechComplete(true)
            finishHighlight()
          }
        } else if (hasSpokenMessage(messageId)) {
          if (generation !== effectGenerationRef.current) return
          setIsLoading(false)
          finishHighlight()
          setIsSpeechComplete(true)
        } else {
          if (generation !== effectGenerationRef.current) return
          setIsLoading(false)
          setIsSpeechComplete(true)
          startEstimatedHighlight(buildEstimatedWordTimings(message, 5))
        }
      })
      .catch((error) => {
        console.error(`[${character}Message] Audio fetch error:`, error)
        if (isMountedRef.current && generation === effectGenerationRef.current) {
          setIsLoading(false)
          setIsSpeechComplete(true)
          startEstimatedHighlight(buildEstimatedWordTimings(message, 5))
        }
      })

    return () => {
      isMountedRef.current = false
      clearHighlightAnimation()
    }
  }, [
    message,
    messageId,
    character,
    speakOnType,
    showTyping,
    elevenLabsApiKey,
    voiceId,
    wordCount,
    startEstimatedHighlight,
    finishHighlight,
    clearHighlightAnimation,
    syncHighlightToElapsed,
  ])

  return {
    message,
    isLoading,
    isSpeaking,
    isComplete,
    activeWordIndex: showTyping && !isHighlightComplete ? activeWordIndex : null,
    showPlainText: !showTyping,
  }
}
