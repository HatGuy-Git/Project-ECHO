import type { ApiKeys } from '../types'
import { chatJson, resolveBedrockFromApiKeys } from './llmClient'
import { storage } from './storage'

const SYSTEM_PROMPT = `You rewrite a single paragraph so a 12-year-old student can understand it.

Rules:
1. Use plain, everyday words and short sentences.
2. Keep every important fact, name, rule, and number from the original.
3. Do not add facts, opinions, examples, or advice that are not in the original.
4. Keep it about the same length as the original or shorter.
5. Plain text only: no markdown, no bullet points, no headings, no preamble such as "Here is".

Respond with JSON only:
{ "paraphrase": "..." }`

interface ParaphraseResponse {
  paraphrase?: unknown
}

const inFlight = new Map<string, Promise<string>>()

export function normalizeParagraphText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function hashParagraphText(text: string): string {
  return cyrb53(normalizeParagraphText(text)).toString(36)
}

export function paraphraseCacheKey(text: string): string {
  return `paraphrase:v1:${hashParagraphText(text)}`
}

export function getKidFriendlyParaphrase(
  paragraphText: string,
  apiKeys: ApiKeys
): Promise<string> {
  const key = paraphraseCacheKey(paragraphText)
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = loadParaphrase(key, paragraphText, apiKeys).finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, promise)
  return promise
}

async function loadParaphrase(
  key: string,
  paragraphText: string,
  apiKeys: ApiKeys
): Promise<string> {
  const source = normalizeParagraphText(paragraphText)

  const cached = await storage.getParaphrase(key).catch(() => null)
  if (cached && cached.source === source && cached.paraphrase.trim()) {
    return cached.paraphrase
  }

  const bedrock = resolveBedrockFromApiKeys(apiKeys)
  if (!bedrock) {
    throw new Error('Claude on Bedrock is not configured. Add AWS credentials in Settings.')
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await chatJson<ParaphraseResponse>({
        bedrock,
        system: SYSTEM_PROMPT,
        user: `Paragraph:\n---\n${paragraphText.trim()}\n---`,
        maxTokens: 1500,
      })
      const paraphrase =
        typeof result?.paraphrase === 'string' ? result.paraphrase.trim() : ''
      if (!paraphrase) {
        throw new Error('Claude returned an empty explanation.')
      }

      await storage
        .saveParaphrase(key, { source, paraphrase, createdAt: new Date().toISOString() })
        .catch((err: unknown) => console.warn('Could not cache paraphrase:', err))
      return paraphrase
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Could not explain this paragraph.')
    }
  }

  throw lastError ?? new Error('Could not explain this paragraph.')
}

// Synchronous 53-bit hash; crypto.subtle is unavailable when the dev server is opened over plain-HTTP LAN.
function cyrb53(text: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}
