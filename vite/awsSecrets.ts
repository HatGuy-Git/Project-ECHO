import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager'

export const DEFAULT_SECRET_NAME = 'ace-mode/config'

export interface AppSecrets {
  ELEVENLABS_API_KEY?: string
  ASSEMBLYAI_API_KEY?: string
  ELEVENLABS_TUTOR_VOICE_ID?: string
  ELEVENLABS_MAINFRAME_VOICE_ID?: string
  ELEVENLABS_GLITCH_VOICE_ID?: string
  BEDROCK_MODEL_ID?: string
  [key: string]: string | undefined
}

export interface AwsRuntimeStatus {
  region: string
  secretName: string
  hasEnvCredentials: boolean
  secretsLoaded: boolean
  secretKeys: string[]
  error: string | null
}

let cached: AppSecrets | null = null
let loadError: string | null = null
let loadPromise: Promise<AppSecrets> | null = null

export function getAwsRegion(): string {
  return process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim() || 'us-east-1'
}

export function getSecretName(): string {
  return process.env.AWS_SECRET_NAME?.trim() || DEFAULT_SECRET_NAME
}

export function hasEnvAwsCredentials(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() && process.env.AWS_SECRET_ACCESS_KEY?.trim()
  )
}

export function getAppSecrets(): AppSecrets {
  return cached ?? {}
}

export function getAwsRuntimeStatus(): AwsRuntimeStatus {
  const secrets = getAppSecrets()
  return {
    region: getAwsRegion(),
    secretName: getSecretName(),
    hasEnvCredentials: hasEnvAwsCredentials(),
    secretsLoaded: Object.keys(secrets).length > 0,
    secretKeys: Object.keys(secrets),
    error: loadError,
  }
}

export async function ensureAppSecrets(): Promise<AppSecrets> {
  if (cached) return cached
  if (loadPromise) return loadPromise
  loadPromise = fetchSecrets()
  cached = await loadPromise
  return cached
}

async function fetchSecrets(): Promise<AppSecrets> {
  const secretName = getSecretName()
  const region = getAwsRegion()

  try {
    const client = new SecretsManagerClient({ region })
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    )
    const parsed = JSON.parse(response.SecretString || '{}') as Record<string, unknown>
    const secrets: AppSecrets = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.trim()) {
        secrets[key] = value.trim()
      }
    }
    loadError = null
    console.log(
      `[aws-secrets] Loaded ${Object.keys(secrets).length} keys from ${secretName}`
    )
    return secrets
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load AWS secrets'
    loadError = message
    console.warn(`[aws-secrets] ${message}. App secrets will be unavailable.`)
    return {}
  }
}
