export interface RuntimeConfig {
  aws: {
    region: string
    secretName: string
    hasEnvCredentials: boolean
    secretsLoaded: boolean
    secretKeys: string[]
    error: string | null
  }
  services: {
    elevenLabs: boolean
    assemblyAI: boolean
    textract: boolean
    bedrock: boolean
  }
  voices: {
    tutor: string | null
    mainframe: string | null
    glitch: string | null
  }
}

export async function fetchRuntimeConfig(): Promise<RuntimeConfig | null> {
  try {
    const response = await fetch('/api/runtime-config')
    if (!response.ok) return null
    return (await response.json()) as RuntimeConfig
  } catch {
    return null
  }
}
