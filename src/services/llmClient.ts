import {
  DEFAULT_BEDROCK_MODEL,
  DEFAULT_BEDROCK_REGION,
} from '../constants/bedrock'
import type { BedrockAuth } from '../types/bedrock'

export type { BedrockAuth }

export interface BedrockLlmConfig {
  auth?: BedrockAuth
  region: string
  modelId: string
}

export interface ChatJsonOptions {
  bedrock: BedrockLlmConfig
  system: string
  user: string
  maxTokens?: number
}

interface BedrockApiResponse {
  text?: string
  error?: string
}

export async function chatJson<T>(options: ChatJsonOptions): Promise<T> {
  const response = await fetch('/api/bedrock/converse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      region: options.bedrock.region,
      modelId: options.bedrock.modelId,
      system: options.system,
      user: options.user,
      maxTokens: options.maxTokens,
      ...(options.bedrock.auth ? { auth: options.bedrock.auth } : {}),
    }),
  })

  const data = (await response.json()) as BedrockApiResponse

  if (!response.ok) {
    throw new Error(data.error ?? `Bedrock request failed (${response.status})`)
  }

  if (!data.text?.trim()) {
    throw new Error('Bedrock returned an empty response.')
  }

  try {
    return parseJsonFromLlm(data.text) as T
  } catch {
    throw new Error('Bedrock returned invalid JSON.')
  }
}

function parseJsonFromLlm(text: string): unknown {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const jsonText = fenceMatch ? fenceMatch[1].trim() : trimmed
  return JSON.parse(jsonText)
}

const RETIRED_BEDROCK_MODELS = new Set([
  'us.anthropic.claude-3-5-haiku-20241022-v1:0',
  'anthropic.claude-3-5-haiku-20241022-v1:0',
])

function resolveModelId(modelId: string | null | undefined): string {
  const trimmed = modelId?.trim()
  if (!trimmed || RETIRED_BEDROCK_MODELS.has(trimmed)) {
    return DEFAULT_BEDROCK_MODEL
  }
  return trimmed
}

export function resolveBedrockFromApiKeys(keys: {
  bedrockAccessKeyId: string | null
  bedrockSecretAccessKey: string | null
  bedrockSessionToken: string | null
  bedrockApiKey: string | null
  bedrockRegion: string | null
  bedrockModelId: string | null
}): BedrockLlmConfig | null {
  const region = keys.bedrockRegion?.trim() || DEFAULT_BEDROCK_REGION
  const modelId = resolveModelId(keys.bedrockModelId)

  const accessKeyId = keys.bedrockAccessKeyId?.trim()
  const secretAccessKey = keys.bedrockSecretAccessKey?.trim()
  if (accessKeyId && secretAccessKey) {
    return {
      auth: {
        type: 'iam',
        accessKeyId,
        secretAccessKey,
        sessionToken: keys.bedrockSessionToken?.trim() || undefined,
      },
      region,
      modelId,
    }
  }

  const apiKey = keys.bedrockApiKey?.trim()
  if (apiKey) {
    return {
      auth: { type: 'apiKey', apiKey },
      region,
      modelId,
    }
  }

  return { region, modelId }
}

/** IAM credentials only — Textract cannot use a Bedrock API key. */
export function resolveIamFromApiKeys(keys: {
  bedrockAccessKeyId: string | null
  bedrockSecretAccessKey: string | null
  bedrockSessionToken: string | null
  bedrockRegion: string | null
}): { region: string; auth: Extract<BedrockAuth, { type: 'iam' }> } | null {
  const accessKeyId = keys.bedrockAccessKeyId?.trim()
  const secretAccessKey = keys.bedrockSecretAccessKey?.trim()
  if (!accessKeyId || !secretAccessKey) return null

  return {
    region: keys.bedrockRegion?.trim() || DEFAULT_BEDROCK_REGION,
    auth: {
      type: 'iam',
      accessKeyId,
      secretAccessKey,
      sessionToken: keys.bedrockSessionToken?.trim() || undefined,
    },
  }
}
