import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime'
import {
  DEFAULT_BEDROCK_MODEL,
  DEFAULT_BEDROCK_REGION,
} from '../src/constants/bedrock'
import type { BedrockConverseRequest } from '../src/types/bedrock'

export async function invokeBedrockConverse(
  request: BedrockConverseRequest
): Promise<string> {
  const region = request.region?.trim() || DEFAULT_BEDROCK_REGION
  const modelId = request.modelId?.trim() || DEFAULT_BEDROCK_MODEL

  if (request.auth.type === 'apiKey') {
    return invokeWithApiKey(request, region, modelId)
  }

  const client = new BedrockRuntimeClient({
    region,
    credentials: {
      accessKeyId: request.auth.accessKeyId,
      secretAccessKey: request.auth.secretAccessKey,
      sessionToken: request.auth.sessionToken,
    },
  })

  const response = await client.send(
    new ConverseCommand({
      modelId,
      system: [{ text: request.system }],
      messages: [
        {
          role: 'user',
          content: [{ text: request.user }],
        },
      ],
      inferenceConfig: {
        maxTokens: request.maxTokens ?? 8000,
        temperature: 0.2,
      },
    })
  )

  const text = response.output?.message?.content
    ?.map((part) => part.text ?? '')
    .join('')

  if (!text?.trim()) {
    throw new Error('Bedrock returned an empty response.')
  }

  return text
}

async function invokeWithApiKey(
  request: BedrockConverseRequest,
  region: string,
  modelId: string
): Promise<string> {
  const encodedModel = encodeURIComponent(modelId)
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodedModel}/converse`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${request.auth.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system: [{ text: request.system }],
      messages: [
        {
          role: 'user',
          content: [{ text: request.user }],
        },
      ],
      inferenceConfig: {
        maxTokens: request.maxTokens ?? 8000,
        temperature: 0.2,
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Bedrock request failed (${response.status}): ${detail.slice(0, 300)}`)
  }

  const data = (await response.json()) as {
    output?: { message?: { content?: { text?: string }[] } }
  }

  const text = data.output?.message?.content?.map((part) => part.text ?? '').join('')
  if (!text?.trim()) {
    throw new Error('Bedrock returned an empty response.')
  }

  return text
}
