export type BedrockAuth =
  | {
      type: 'iam'
      accessKeyId: string
      secretAccessKey: string
      sessionToken?: string
    }
  | { type: 'apiKey'; apiKey: string }

export interface BedrockConverseRequest {
  region?: string
  modelId?: string
  system: string
  user: string
  maxTokens?: number
  auth: BedrockAuth
}
