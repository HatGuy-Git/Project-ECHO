/**
 * Speech-to-Text Service using AssemblyAI
 * 
 * This service handles audio transcription for understanding the user's speech.
 * Designed to be swappable - can later point to our own backend instead of AssemblyAI directly.
 */

import type { TranscriptionOptions, TranscriptionResult } from '../types'

const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2'

interface AssemblyAIUploadResponse {
  upload_url: string
}

interface AssemblyAITranscriptResponse {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'error'
  text?: string
  confidence?: number
  error?: string
}

const MAX_KEYTERMS = 200

/**
 * Build keyterms from expected recitation text to boost STT accuracy.
 * Includes individual words and line/stanza phrases (max 6 words per phrase).
 */
export function buildKeytermsFromText(expectedText: string): string[] {
  const terms = new Set<string>()

  // Add line/stanza phrases (up to 6 words each, per AssemblyAI limits)
  for (const line of expectedText.split(/\n+/)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const words = trimmed.split(/\s+/)
    if (words.length <= 6) {
      terms.add(trimmed)
    } else {
      // Split long lines into 6-word chunks
      for (let i = 0; i < words.length; i += 6) {
        terms.add(words.slice(i, i + 6).join(' '))
      }
    }
  }

  // Add distinctive individual words (skip very short/common ones)
  for (const word of expectedText.split(/\s+/)) {
    const clean = word.replace(/[^\w'-]/g, '')
    if (clean.length >= 3) {
      terms.add(clean)
    }
  }

  return [...terms].slice(0, MAX_KEYTERMS)
}

/**
 * Upload audio file to AssemblyAI and get transcription
 */
export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  try {
    const keyterms = options.keyterms
      ?? (options.expectedText ? buildKeytermsFromText(options.expectedText) : undefined)

    // Step 1: Upload the audio file
    const uploadResponse = await fetch(`${ASSEMBLYAI_API_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/octet-stream',
      },
      body: audioBlob,
    })

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`)
    }

    const uploadData: AssemblyAIUploadResponse = await uploadResponse.json()

    // Step 2: Create transcription request with Universal-3 Pro + keyterms
    const transcriptBody: Record<string, unknown> = {
      audio_url: uploadData.upload_url,
      speech_models: ['universal-3-pro', 'universal-2'],
    }

    if (keyterms && keyterms.length > 0) {
      transcriptBody.keyterms_prompt = keyterms
    }

    const transcriptResponse = await fetch(`${ASSEMBLYAI_API_URL}/transcript`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transcriptBody),
    })

    if (!transcriptResponse.ok) {
      throw new Error(`Transcription request failed: ${transcriptResponse.status}`)
    }

    const transcriptData: AssemblyAITranscriptResponse = await transcriptResponse.json()
    const transcriptId = transcriptData.id

    // Step 3: Poll for completion
    const result = await pollForTranscription(transcriptId, apiKey)
    
    return result
  } catch (error) {
    console.error('Transcription error:', error)
    return {
      text: '',
      confidence: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown transcription error',
    }
  }
}

/**
 * Poll AssemblyAI for transcription completion
 */
async function pollForTranscription(
  transcriptId: string,
  apiKey: string,
  maxAttempts = 60,
  intervalMs = 1000
): Promise<TranscriptionResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`, {
      headers: {
        'Authorization': apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`Polling failed: ${response.status}`)
    }

    const data: AssemblyAITranscriptResponse = await response.json()

    if (data.status === 'completed') {
      return {
        text: data.text || '',
        confidence: data.confidence || 0,
        success: true,
      }
    }

    if (data.status === 'error') {
      return {
        text: '',
        confidence: 0,
        success: false,
        error: data.error || 'Transcription failed',
      }
    }

    // Still processing, wait and try again
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  return {
    text: '',
    confidence: 0,
    success: false,
    error: 'Transcription timed out',
  }
}

/**
 * Validate an AssemblyAI API key by making a test request
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript`, {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
      },
    })
    
    // A 200 response means the key is valid
    return response.ok
  } catch {
    return false
  }
}
