import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { prefetchNarrationAudioOnce } from '../services/textToSpeech'
import {
  buildEstimatedWordTimings,
  countWords,
  getActiveWordIndex,
  type WordTiming,
} from '../utils/wordHighlight'

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

interface UseNarrationPlaybackOptions {
  text: string
  messageId: string
  elevenLabsApiKey: string | null
  voiceId: string | null
  enabled?: boolean
}

export function useNarrationPlayback({
  text,
  messageId,
  elevenLabsApiKey,
  voiceId,
  enabled = true,
}: UseNarrationPlaybackOptions) {
  const speechText = useMemo(() => truncateForSpeech(text), [text])
  const wordCount = useMemo(() => countWords(speechText), [text])

  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [wordTimings, setWordTimings] = useState<WordTiming[]>([])

  const audioRef = useRef<HTMLAudioElement>(null)
  const animationRef = useRef<number | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  const activeWordIndex = useMemo(() => {
    if (!audioUrl || wordTimings.length === 0) return null
    return getActiveWordIndex(wordTimings, currentTime)
  }, [audioUrl, wordTimings, currentTime])

  const stopAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [])

  const syncTimeFromAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(audio.currentTime)
  }, [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    setIsLoading(true)
    setError(null)
    setAudioUrl(null)
    setCurrentTime(0)
    setDuration(0)
    setWordTimings([])
    setIsPlaying(false)

    if (!elevenLabsApiKey) {
      setIsLoading(false)
      setError('Add an ElevenLabs API key in Settings to hear narration.')
      return
    }

    prefetchNarrationAudioOnce(messageId, speechText, elevenLabsApiKey, voiceId)
      .then((result) => {
        if (cancelled) return

        if (result) {
          setWordTimings(result.wordTimings)
          setDuration(result.duration)
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current)
          }
          const url = URL.createObjectURL(result.blob)
          blobUrlRef.current = url
          setAudioUrl(url)
        } else {
          const estimated = buildEstimatedWordTimings(
            speechText,
            Math.max(wordCount * 0.35, 3)
          )
          setWordTimings(estimated)
          setDuration(estimated[estimated.length - 1]?.endTime ?? 0)
          setError('Narration unavailable — use read-along highlighting only.')
        }
        setIsLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoading(false)
          setError('Failed to prepare narration.')
        }
      })

    return () => {
      cancelled = true
      stopAnimation()
      const audio = audioRef.current
      if (audio) {
        audio.pause()
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [messageId, speechText, elevenLabsApiKey, voiceId, enabled, wordCount, stopAnimation])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(audio.duration)
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [audioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = speed
  }, [speed, audioUrl])

  useEffect(() => {
    const tick = () => {
      syncTimeFromAudio()
      animationRef.current = requestAnimationFrame(tick)
    }

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(tick)
    } else {
      stopAnimation()
    }

    return stopAnimation
  }, [isPlaying, syncTimeFromAudio, stopAnimation])

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return
    if (audio.paused) {
      try {
        await audio.play()
      } catch {
        setError('Playback blocked — click play again after interacting with the page.')
      }
    } else {
      audio.pause()
    }
  }, [audioUrl])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const play = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    try {
      await audio.play()
    } catch {
      setError('Playback blocked — click play again after interacting with the page.')
    }
  }, [])

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    const next = Math.max(0, Math.min(audio.currentTime + seconds, duration || audio.duration))
    audio.currentTime = next
    setCurrentTime(next)
  }, [duration])

  const seek = useCallback((time: number) => {
    const audio = audioRef.current
    if (!audio) return
    const clamped = Math.max(0, Math.min(time, duration || audio.duration))
    audio.currentTime = clamped
    setCurrentTime(clamped)
  }, [duration])

  const seekToWord = useCallback((wordIndex: number) => {
    const startTime = wordTimings[wordIndex]?.startTime
    if (startTime === undefined) return
    seek(startTime)
  }, [seek, wordTimings])

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const idx = SPEED_OPTIONS.indexOf(prev as (typeof SPEED_OPTIONS)[number])
      const nextIdx = idx === -1 ? 2 : (idx + 1) % SPEED_OPTIONS.length
      return SPEED_OPTIONS[nextIdx]
    })
  }, [])

  const setPlaybackSpeed = useCallback((rate: number) => {
    setSpeed(rate)
  }, [])

  return {
    speechText,
    audioRef,
    audioUrl,
    isLoading,
    isPlaying,
    isReady: !!audioUrl && !isLoading,
    duration,
    currentTime,
    speed,
    speedOptions: SPEED_OPTIONS,
    activeWordIndex,
    error,
    togglePlay,
    pause,
    play,
    skip,
    seek,
    seekToWord,
    cycleSpeed,
    setPlaybackSpeed,
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
