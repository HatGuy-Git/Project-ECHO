/**
 * Text-to-Speech Service using ElevenLabs
 * 
 * This service handles converting text to speech for reading passages aloud.
 * Designed to be swappable - can later point to our own backend instead of ElevenLabs directly.
 */

import type { TTSOptions, CharacterType, ApiKeys } from '../types'
import {
  buildWordTimingsFromAlignment,
  buildEstimatedWordTimings,
  type CharacterAlignment,
  type WordTiming,
} from '../utils/wordHighlight'

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1'

// Default voice ID (Rachel - clear, professional female voice)
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

/** Turbo for clear passage reading; v3 for expressive character dialogue */
export const TTS_MODELS = {
  passage: 'eleven_turbo_v2_5',
  character: 'eleven_v3',
} as const

// Target RMS level for volume normalization (0.0 to 1.0)
// 0.2 is a comfortable listening level that avoids clipping
const TARGET_RMS_LEVEL = 0.2

// Character voice defaults - futuristic robotic feel for Mainframe, menacing for Dr. Glitch
export const CHARACTER_VOICES = {
  mainframe: {
    defaultVoiceId: 'pNInz6obpgDQGcFmaJgB', // Adam - authoritative, robotic feel
    defaultSettings: {
      stability: 0.7,
      similarityBoost: 0.8,
      speed: 0.95,
    },
  },
  glitch: {
    defaultVoiceId: 'VR6AewLTigWG4xSOukaG', // Arnold - deeper, menacing villain voice
    defaultSettings: {
      stability: 0.3, // Less stable for glitchy effect
      similarityBoost: 0.6,
      speed: 1.1, // Slightly faster, more chaotic
    },
  },
} as const

/** Warm, gentle female narrator for read-along study modules */
export const TUTOR_VOICE = {
  defaultVoiceId: 'XrExE9yKIg1WjnnlVkGX', // Matilda — warm, kind, approachable
  defaultSettings: {
    stability: 0.78,
    similarityBoost: 0.82,
    speed: 0.95,
  },
} as const

// Shared AudioContext for Web Audio API operations
let audioContext: AudioContext | null = null
let audioContextReady = false

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

/**
 * Initialize/resume the AudioContext - must be called from a user gesture (click, etc.)
 * Call this early (e.g., on first button click) to enable audio playback
 */
export async function initAudioContext(): Promise<void> {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
  audioContextReady = true
  console.log('[AudioContext] Initialized, state:', ctx.state)
}

/**
 * Check if audio context is ready for playback
 */
export function isAudioReady(): boolean {
  return audioContextReady && audioContext?.state === 'running'
}

// Track current audio source for stopping
let currentSource: AudioBufferSourceNode | null = null
let currentPlaybackRate = 1

export function setPlaybackRate(rate: number): void {
  currentPlaybackRate = Math.max(0.5, Math.min(2, rate))
  if (currentSource) {
    currentSource.playbackRate.value = currentPlaybackRate
  }
}

export function getPlaybackRate(): number {
  return currentPlaybackRate
}

/**
 * Reset per-message session state so narration can replay (e.g. new study section).
 */
export function clearMessageSession(messageId: string): void {
  spokenMessagesThisSession.delete(messageId)
  prefetchPromises.delete(messageId)
  playbackPromises.delete(messageId)
  playbackListeners.delete(messageId)
  lastPlaybackElapsed.delete(messageId)
  sequenceStarted.delete(messageId)
  wordHighlightProgress.delete(messageId)
}

// Audio queue system to prevent speech interruption
interface QueuedAudio {
  blob: Blob
  resolve: () => void
  reject: (error: Error) => void
  onProgress?: (elapsedSeconds: number) => void
  playbackRate?: number
}

const audioQueue: QueuedAudio[] = []
let isProcessingQueue = false

/**
 * Process the audio queue - plays audio one at a time
 */
async function processAudioQueue(): Promise<void> {
  if (isProcessingQueue || audioQueue.length === 0) return
  
  isProcessingQueue = true
  
  while (audioQueue.length > 0) {
    const item = audioQueue.shift()!
    try {
      await playAudioImmediate(item.blob, item.onProgress, item.playbackRate)
      item.resolve()
    } catch (error) {
      item.reject(error as Error)
    }
  }
  
  isProcessingQueue = false
}

// Session-based tracking of spoken messages to prevent duplicates on HMR
// This persists across hot reloads but resets on full page refresh
const spokenMessagesThisSession = new Set<string>()

type PrefetchResult = {
  blob: Blob
  duration: number
  wordTimings: WordTiming[]
} | null

// Deduplicate in-flight prefetches and playback across StrictMode remounts / effect re-runs
const prefetchPromises = new Map<string, Promise<PrefetchResult>>()
const playbackPromises = new Map<string, Promise<void>>()
const sequenceStarted = new Set<string>()
const wordHighlightProgress = new Map<string, number>()

/**
 * Get the last highlighted word index for a message (for resume across remounts)
 */
export function getWordHighlightProgress(messageId: string): number {
  return wordHighlightProgress.get(messageId) ?? 0
}

/**
 * Update highlighted word progress for a message
 */
export function setWordHighlightProgress(messageId: string, wordIndex: number): void {
  wordHighlightProgress.set(messageId, wordIndex)
}

/**
 * Check if a message has already been spoken this session
 */
export function hasSpokenMessage(messageId: string): boolean {
  return spokenMessagesThisSession.has(messageId)
}

/**
 * Mark a message as spoken for this session
 */
export function markMessageSpoken(messageId: string): void {
  spokenMessagesThisSession.add(messageId)
}

/**
 * Prefetch character audio once per message ID (dedupes concurrent requests)
 */
export function prefetchCharacterAudioOnce(
  messageId: string,
  text: string,
  character: CharacterType,
  apiKey: string,
  apiKeys: ApiKeys
): Promise<PrefetchResult> {
  if (hasSpokenMessage(messageId)) {
    return Promise.resolve(null)
  }

  const existing = prefetchPromises.get(messageId)
  if (existing) {
    return existing
  }

  const promise = prefetchCharacterAudio(text, character, apiKey, apiKeys).finally(() => {
    prefetchPromises.delete(messageId)
  })

  prefetchPromises.set(messageId, promise)
  return promise
}

const TUTOR_VOICE_DEFAULT = TUTOR_VOICE.defaultVoiceId

/**
 * Prefetch narration audio once per message ID with a specific voice
 */
export function prefetchNarrationAudioOnce(
  messageId: string,
  text: string,
  apiKey: string,
  voiceId: string | null,
  options: TTSOptions = {}
): Promise<PrefetchResult> {
  const existing = prefetchPromises.get(messageId)
  if (existing) {
    return existing
  }

  const promise = prefetchAudio(
    text,
    apiKey,
    {
      voiceId: voiceId || TUTOR_VOICE_DEFAULT,
      modelId: TTS_MODELS.passage,
      ...TUTOR_VOICE.defaultSettings,
      ...options,
    },
    true
  ).finally(() => {
    prefetchPromises.delete(messageId)
  })

  prefetchPromises.set(messageId, promise)
  return promise
}

/**
 * Play narration audio (always plays — for study sections that can replay).
 */
export async function playNarratedAudio(
  blob: Blob,
  onProgress?: (elapsedSeconds: number) => void,
  playbackRate = getPlaybackRate()
): Promise<void> {
  setPlaybackRate(playbackRate)
  return playAudio(blob, onProgress, playbackRate)
}

/**
 * Play character audio once per message ID (dedupes concurrent playback).
 * Optional onProgress receives elapsed seconds synced to the audio clock.
 */
export function playCharacterAudioOnce(
  messageId: string,
  blob: Blob,
  onProgress?: (elapsedSeconds: number) => void
): Promise<void> {
  if (hasSpokenMessage(messageId)) {
    return Promise.resolve()
  }

  const existing = playbackPromises.get(messageId)
  if (existing) {
    if (onProgress) {
      registerPlaybackListener(messageId, onProgress)
    }
    return existing
  }

  markMessageSpoken(messageId)

  const listeners = new Set<(elapsedSeconds: number) => void>()
  if (onProgress) {
    listeners.add(onProgress)
  }

  playbackListeners.set(messageId, listeners)

  const promise = playAudio(blob, (elapsed) => {
    lastPlaybackElapsed.set(messageId, elapsed)
    playbackListeners.get(messageId)?.forEach((listener) => listener(elapsed))
  }).finally(() => {
    playbackPromises.delete(messageId)
    playbackListeners.delete(messageId)
    lastPlaybackElapsed.delete(messageId)
  })

  playbackPromises.set(messageId, promise)
  return promise
}

const playbackListeners = new Map<string, Set<(elapsedSeconds: number) => void>>()
const lastPlaybackElapsed = new Map<string, number>()

function registerPlaybackListener(
  messageId: string,
  onProgress: (elapsedSeconds: number) => void
): void {
  const listeners = playbackListeners.get(messageId)
  if (listeners) {
    listeners.add(onProgress)
    const elapsed = lastPlaybackElapsed.get(messageId)
    if (elapsed !== undefined) {
      onProgress(elapsed)
    }
  }
}

/**
 * Whether a message sequence (prefetch + typing + playback) has already started
 */
export function hasMessageSequenceStarted(messageId: string): boolean {
  return sequenceStarted.has(messageId)
}

/**
 * Mark a message sequence as started (prevents duplicate effect runs from restarting)
 */
export function markMessageSequenceStarted(messageId: string): void {
  sequenceStarted.add(messageId)
}

/**
 * Clear all spoken message tracking (useful for testing or resetting)
 */
export function clearSpokenMessages(): void {
  spokenMessagesThisSession.clear()
}

interface ElevenLabsVoice {
  voice_id: string
  name: string
  category: string
}

/**
 * Convert text to speech using ElevenLabs
 */
export async function textToSpeech(
  text: string,
  apiKey: string,
  options: TTSOptions = {}
): Promise<Blob | null> {
  const voiceId = options.voiceId || DEFAULT_VOICE_ID
  
  try {
    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: options.modelId || TTS_MODELS.passage,
          voice_settings: {
            stability: options.stability ?? 0.5,
            similarity_boost: options.similarityBoost ?? 0.75,
            speed: options.speed ?? 1.0,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('TTS Error:', errorText)
      throw new Error(`TTS failed: ${response.status}`)
    }

    return await response.blob()
  } catch (error) {
    console.error('TTS error:', error)
    return null
  }
}

interface TimestampedTTSResponse {
  audio_base64: string
  alignment?: {
    characters: string[]
    character_start_times_seconds: number[]
    character_end_times_seconds: number[]
  }
  normalized_alignment?: {
    characters: string[]
    character_start_times_seconds: number[]
    character_end_times_seconds: number[]
  }
}

/**
 * Convert text to speech with character-level timestamps from ElevenLabs
 */
export async function textToSpeechWithTimestamps(
  text: string,
  apiKey: string,
  options: TTSOptions = {}
): Promise<{ blob: Blob; alignment: TimestampedTTSResponse['alignment'] } | null> {
  const voiceId = options.voiceId || DEFAULT_VOICE_ID

  try {
    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/with-timestamps`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: options.modelId || TTS_MODELS.passage,
          voice_settings: {
            stability: options.stability ?? 0.5,
            similarity_boost: options.similarityBoost ?? 0.75,
            speed: options.speed ?? 1.0,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('TTS timestamps error:', errorText)
      return null
    }

    const data: TimestampedTTSResponse = await response.json()
    const alignment = data.alignment ?? data.normalized_alignment ?? null
    if (!alignment || !data.audio_base64) {
      return null
    }

    const binary = atob(data.audio_base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }

    return {
      blob: new Blob([bytes], { type: 'audio/mpeg' }),
      alignment,
    }
  } catch (error) {
    console.error('TTS timestamps error:', error)
    return null
  }
}

/**
 * Calculate the RMS (Root Mean Square) level of an audio buffer
 * This gives us the average loudness of the audio
 */
function calculateRMS(audioBuffer: AudioBuffer): number {
  let sumSquares = 0
  let sampleCount = 0
  
  // Analyze all channels
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel)
    for (let i = 0; i < channelData.length; i++) {
      sumSquares += channelData[i] * channelData[i]
      sampleCount++
    }
  }
  
  return Math.sqrt(sumSquares / sampleCount)
}

/**
 * Play audio blob immediately (internal use)
 * Uses Web Audio API to analyze and normalize volume levels
 */
async function playAudioImmediate(
  audioBlob: Blob,
  onProgress?: (elapsedSeconds: number) => void,
  playbackRate = currentPlaybackRate
): Promise<void> {
  const ctx = getAudioContext()
  
  // Resume context if it was suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    console.log('[AudioContext] Attempting to resume suspended context...')
    try {
      await ctx.resume()
      console.log('[AudioContext] Resumed, state:', ctx.state)
    } catch (error) {
      console.error('[AudioContext] Failed to resume:', error)
      throw new Error('AudioContext suspended - needs user interaction')
    }
  }
  
  if (ctx.state !== 'running') {
    console.log('[AudioContext] Waiting for context to be running, current state:', ctx.state)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  const arrayBuffer = await audioBlob.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  
  const currentRMS = calculateRMS(audioBuffer)
  const gainValue = currentRMS > 0 ? TARGET_RMS_LEVEL / currentRMS : 1
  const clampedGain = Math.max(0.1, Math.min(3.0, gainValue))
  const duration = audioBuffer.duration
  
  return new Promise((resolve, reject) => {
    try {
      const source = ctx.createBufferSource()
      const gainNode = ctx.createGain()
      
      source.buffer = audioBuffer
      gainNode.gain.value = clampedGain
      source.playbackRate.value = playbackRate
      currentPlaybackRate = playbackRate
      
      source.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      currentSource = source
      
      const startAt = ctx.currentTime
      let rafId = 0

      const reportProgress = () => {
        if (!currentSource) return
        const rate = currentSource.playbackRate.value
        const elapsed = Math.min((ctx.currentTime - startAt) * rate, duration)
        onProgress?.(elapsed)
        if (elapsed < duration) {
          rafId = requestAnimationFrame(reportProgress)
        }
      }

      source.onended = () => {
        cancelAnimationFrame(rafId)
        currentSource = null
        onProgress?.(duration)
        resolve()
      }
      
      source.start(0)
      if (onProgress) {
        onProgress(0)
        rafId = requestAnimationFrame(reportProgress)
      }
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Play audio blob through the browser with volume normalization
 * Queues audio to prevent interrupting currently playing speech
 */
export async function playAudio(
  audioBlob: Blob,
  onProgress?: (elapsedSeconds: number) => void,
  playbackRate = currentPlaybackRate
): Promise<void> {
  return new Promise((resolve, reject) => {
    audioQueue.push({ blob: audioBlob, resolve, reject, onProgress, playbackRate })
    processAudioQueue()
  })
}

/**
 * Play audio immediately, interrupting any currently playing audio
 * Use sparingly - prefer playAudio() for queued playback
 */
export async function playAudioInterrupt(audioBlob: Blob): Promise<void> {
  // Stop any currently playing audio
  stopSpeech()
  // Clear the queue
  audioQueue.length = 0
  isProcessingQueue = false
  // Play immediately
  return playAudioImmediate(audioBlob)
}

/**
 * Pre-fetch audio and get its duration plus word timings when available
 */
export async function prefetchAudio(
  text: string,
  apiKey: string,
  options: TTSOptions = {},
  withTimestamps = false
): Promise<PrefetchResult> {
  let audioBlob: Blob | null = null
  let alignment: CharacterAlignment | null = null

  if (withTimestamps) {
    const timestamped = await textToSpeechWithTimestamps(text, apiKey, options)
    if (timestamped) {
      audioBlob = timestamped.blob
      alignment = timestamped.alignment as CharacterAlignment | null
    }
  }

  if (!audioBlob) {
    audioBlob = await textToSpeech(text, apiKey, options)
  }

  if (!audioBlob) {
    return null
  }

  try {
    const ctx = getAudioContext()
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
    const newBlob = new Blob([arrayBuffer], { type: audioBlob.type })
    const duration = audioBuffer.duration

    let wordTimings = alignment
      ? buildWordTimingsFromAlignment(text, alignment)
      : []

    if (wordTimings.length === 0) {
      wordTimings = buildEstimatedWordTimings(text, duration)
    }

    return {
      blob: newBlob,
      duration,
      wordTimings,
    }
  } catch (error) {
    console.error('Error getting audio duration:', error)
    return {
      blob: audioBlob,
      duration: 5,
      wordTimings: buildEstimatedWordTimings(text, 5),
    }
  }
}

/**
 * Pre-fetch audio as a character and get duration
 */
export async function prefetchCharacterAudio(
  text: string,
  character: CharacterType,
  apiKey: string,
  apiKeys: ApiKeys
): Promise<PrefetchResult> {
  const charConfig = CHARACTER_VOICES[character]
  
  const voiceId = character === 'mainframe'
    ? (apiKeys.mainframeVoiceId || charConfig.defaultVoiceId)
    : (apiKeys.drGlitchVoiceId || charConfig.defaultVoiceId)
  
  const options: TTSOptions = {
    voiceId,
    modelId: TTS_MODELS.character,
    ...charConfig.defaultSettings,
  }
  
  return prefetchAudio(text, apiKey, options, true)
}

/**
 * Speak text and wait for completion
 */
export async function speak(
  text: string,
  apiKey: string,
  options: TTSOptions = {}
): Promise<boolean> {
  const audioBlob = await textToSpeech(text, apiKey, options)
  
  if (!audioBlob) {
    // Fallback to browser TTS if ElevenLabs fails
    return speakWithBrowserTTS(text)
  }
  
  try {
    await playAudio(audioBlob)
    return true
  } catch (error) {
    console.error('Audio playback error:', error)
    return speakWithBrowserTTS(text)
  }
}

/**
 * Fallback: Use browser's built-in speech synthesis
 */
export function speakWithBrowserTTS(text: string, rate = 0.9): Promise<boolean> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      console.warn('Browser TTS not supported')
      resolve(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rate
    utterance.pitch = 1
    utterance.volume = 1

    utterance.onend = () => resolve(true)
    utterance.onerror = () => resolve(false)

    window.speechSynthesis.speak(utterance)
  })
}

/**
 * Stop any currently playing speech (both Web Audio and browser TTS)
 */
export function stopSpeech(): void {
  // Stop Web Audio API playback
  if (currentSource) {
    try {
      currentSource.stop()
      currentSource = null
    } catch {
      // Source may have already stopped
    }
  }
  
  // Stop browser TTS
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

/**
 * Get available voices from ElevenLabs
 */
export async function getAvailableVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        'xi-api-key': apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`)
    }

    const data = await response.json()
    return data.voices || []
  } catch (error) {
    console.error('Error fetching voices:', error)
    return []
  }
}

/**
 * Validate an ElevenLabs API key
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/user`, {
      headers: {
        'xi-api-key': apiKey,
      },
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Speak text as a specific character (Mainframe or Dr. Glitch)
 * Uses character-specific voice settings for immersive experience
 */
export async function speakAsCharacter(
  text: string,
  character: CharacterType,
  apiKey: string,
  apiKeys: ApiKeys
): Promise<boolean> {
  const charConfig = CHARACTER_VOICES[character]
  
  // Use custom voice ID if set in settings, otherwise use character default
  const voiceId = character === 'mainframe'
    ? (apiKeys.mainframeVoiceId || charConfig.defaultVoiceId)
    : (apiKeys.drGlitchVoiceId || charConfig.defaultVoiceId)
  
  const options: TTSOptions = {
    voiceId,
    modelId: TTS_MODELS.character,
    ...charConfig.defaultSettings,
  }
  
  return speak(text, apiKey, options)
}

