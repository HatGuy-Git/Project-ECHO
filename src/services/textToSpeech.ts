/**
 * Text-to-Speech Service using ElevenLabs
 * 
 * This service handles converting text to speech for reading passages aloud.
 * Designed to be swappable - can later point to our own backend instead of ElevenLabs directly.
 */

import type { TTSOptions, CharacterType, ApiKeys } from '../types'

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1'

// Default voice ID (Rachel - clear, professional female voice)
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

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

// Shared AudioContext for Web Audio API operations
let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

// Track current audio source for stopping
let currentSource: AudioBufferSourceNode | null = null

// Audio queue system to prevent speech interruption
interface QueuedAudio {
  blob: Blob
  resolve: () => void
  reject: (error: Error) => void
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
      await playAudioImmediate(item.blob)
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
          model_id: 'eleven_monolingual_v1',
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
async function playAudioImmediate(audioBlob: Blob): Promise<void> {
  const ctx = getAudioContext()
  
  // Resume context if it was suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
  
  // Decode the audio blob into an AudioBuffer
  const arrayBuffer = await audioBlob.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  
  // Calculate current RMS and determine gain needed for normalization
  const currentRMS = calculateRMS(audioBuffer)
  const gainValue = currentRMS > 0 ? TARGET_RMS_LEVEL / currentRMS : 1
  
  // Clamp gain to prevent distortion (max 3x boost, min 0.1x reduction)
  const clampedGain = Math.max(0.1, Math.min(3.0, gainValue))
  
  return new Promise((resolve, reject) => {
    try {
      // Create audio nodes
      const source = ctx.createBufferSource()
      const gainNode = ctx.createGain()
      
      source.buffer = audioBuffer
      gainNode.gain.value = clampedGain
      
      // Connect: source -> gain -> output
      source.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      // Track current source for stopping
      currentSource = source
      
      source.onended = () => {
        currentSource = null
        resolve()
      }
      
      source.start(0)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Play audio blob through the browser with volume normalization
 * Queues audio to prevent interrupting currently playing speech
 */
export async function playAudio(audioBlob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    audioQueue.push({ blob: audioBlob, resolve, reject })
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
 * Pre-fetch audio and get its duration
 * Returns the blob and duration so components can sync typing with playback
 */
export async function prefetchAudio(
  text: string,
  apiKey: string,
  options: TTSOptions = {}
): Promise<{ blob: Blob; duration: number } | null> {
  const audioBlob = await textToSpeech(text, apiKey, options)
  
  if (!audioBlob) {
    return null
  }
  
  try {
    const ctx = getAudioContext()
    // Clone the array buffer so we don't consume the blob
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
    
    // Create a new blob from the original data for playback
    const newBlob = new Blob([arrayBuffer], { type: audioBlob.type })
    
    return {
      blob: newBlob,
      duration: audioBuffer.duration
    }
  } catch (error) {
    console.error('Error getting audio duration:', error)
    return { blob: audioBlob, duration: 5 } // Fallback duration estimate
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
): Promise<{ blob: Blob; duration: number } | null> {
  const charConfig = CHARACTER_VOICES[character]
  
  const voiceId = character === 'mainframe'
    ? (apiKeys.mainframeVoiceId || charConfig.defaultVoiceId)
    : (apiKeys.drGlitchVoiceId || charConfig.defaultVoiceId)
  
  const options: TTSOptions = {
    voiceId,
    ...charConfig.defaultSettings,
  }
  
  return prefetchAudio(text, apiKey, options)
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
    ...charConfig.defaultSettings,
  }
  
  return speak(text, apiKey, options)
}

