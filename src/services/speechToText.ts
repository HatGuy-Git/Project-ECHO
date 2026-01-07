/**
 * Speech-to-Text Service using AssemblyAI
 * 
 * This service handles audio transcription for understanding the user's speech.
 * Designed to be swappable - can later point to our own backend instead of AssemblyAI directly.
 */

import type { TranscriptionResult } from '../types'

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

/**
 * Upload audio file to AssemblyAI and get transcription
 */
export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string
): Promise<TranscriptionResult> {
  try {
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

    // Step 2: Create transcription request
    const transcriptResponse = await fetch(`${ASSEMBLYAI_API_URL}/transcript`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: uploadData.upload_url,
        language_code: 'en',
      }),
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

