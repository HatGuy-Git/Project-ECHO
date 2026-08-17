import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { ensureAppSecrets, getAppSecrets } from './awsSecrets'

const SPEECH_ROUTE = '/api/elevenlabs/speech'
const VOICES_ROUTE = '/api/elevenlabs/voices'
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1'

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function requireElevenLabsKey(): Promise<string> {
  await ensureAppSecrets()
  const key = getAppSecrets().ELEVENLABS_API_KEY
  if (!key) {
    throw new Error(
      'ElevenLabs API key is not in AWS Secrets Manager (ace-mode/config → ELEVENLABS_API_KEY).'
    )
  }
  return key
}

async function handleVoices(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const apiKey = await requireElevenLabsKey()
    const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      headers: { 'xi-api-key': apiKey },
    })
    const body = await response.text()
    res.statusCode = response.status
    res.setHeader('Content-Type', 'application/json')
    res.end(body)
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Voices request failed' }))
  }
}

async function handleSpeech(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }

  try {
    const apiKey = await requireElevenLabsKey()
    const payload = JSON.parse(await readBody(req)) as {
      text?: string
      voiceId?: string
      modelId?: string
      withTimestamps?: boolean
      voiceSettings?: { stability?: number; similarity_boost?: number }
    }

    if (!payload.text?.trim() || !payload.voiceId) {
      res.statusCode = 400
      res.end('Missing text or voiceId')
      return
    }

    const path = payload.withTimestamps
      ? `/text-to-speech/${payload.voiceId}/with-timestamps`
      : `/text-to-speech/${payload.voiceId}`

    const response = await fetch(`${ELEVENLABS_API_URL}${path}`, {
      method: 'POST',
      headers: {
        Accept: payload.withTimestamps ? 'application/json' : 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: payload.text,
        model_id: payload.modelId,
        voice_settings: payload.voiceSettings,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      res.statusCode = response.status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: errorText, status: response.status }))
      return
    }

    if (payload.withTimestamps) {
      const json = await response.text()
      res.setHeader('Content-Type', 'application/json')
      res.end(json)
      return
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Length', buffer.length)
    res.end(buffer)
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Speech request failed' }))
  }
}

export function elevenLabsPlugin(): Plugin {
  return {
    name: 'elevenlabs-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0]
        if (path === VOICES_ROUTE) {
          void handleVoices(req, res)
          return
        }
        if (path === SPEECH_ROUTE) {
          void handleSpeech(req, res)
          return
        }
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0]
        if (path === VOICES_ROUTE) {
          void handleVoices(req, res)
          return
        }
        if (path === SPEECH_ROUTE) {
          void handleSpeech(req, res)
          return
        }
        next()
      })
    },
  }
}
