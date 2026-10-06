import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeys } from '../../types'

const { chatJson, getParaphrase, saveParaphrase } = vi.hoisted(() => ({
  chatJson: vi.fn(),
  getParaphrase: vi.fn(),
  saveParaphrase: vi.fn(),
}))

vi.mock('../llmClient', () => ({
  chatJson,
  resolveBedrockFromApiKeys: () => ({ region: 'us-east-1', modelId: 'test-model' }),
}))

vi.mock('../storage', () => ({
  storage: { getParaphrase, saveParaphrase },
}))

import {
  getKidFriendlyParaphrase,
  normalizeParagraphText,
  paraphraseCacheKey,
} from '../paragraphParaphrase'

const API_KEYS = {} as ApiKeys
const PARAGRAPH = 'The mitochondria is the powerhouse of the cell.'

describe('paraphraseCacheKey', () => {
  it('ignores whitespace and case differences', () => {
    const key = paraphraseCacheKey(PARAGRAPH)
    expect(paraphraseCacheKey('  the MITOCHONDRIA is\nthe   powerhouse of the cell. ')).toBe(key)
    expect(key).toMatch(/^paraphrase:v1:[0-9a-z]+$/)
  })

  it('gives different text a different key', () => {
    expect(paraphraseCacheKey(PARAGRAPH)).not.toBe(
      paraphraseCacheKey('The nucleus is the control center of the cell.')
    )
    expect(paraphraseCacheKey('Stop at 50 feet.')).not.toBe(paraphraseCacheKey('Stop at 60 feet.'))
  })
})

describe('getKidFriendlyParaphrase', () => {
  beforeEach(() => {
    chatJson.mockReset()
    getParaphrase.mockReset()
    saveParaphrase.mockReset()
    getParaphrase.mockResolvedValue(null)
    saveParaphrase.mockResolvedValue(undefined)
  })

  it('returns a cached paraphrase without calling the LLM', async () => {
    getParaphrase.mockResolvedValue({
      source: normalizeParagraphText(PARAGRAPH),
      paraphrase: 'Cached simple version.',
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    await expect(getKidFriendlyParaphrase(PARAGRAPH, API_KEYS)).resolves.toBe(
      'Cached simple version.'
    )
    expect(getParaphrase).toHaveBeenCalledWith(paraphraseCacheKey(PARAGRAPH))
    expect(chatJson).not.toHaveBeenCalled()
  })

  it('ignores a cache entry whose source text does not match (hash collision)', async () => {
    getParaphrase.mockResolvedValue({
      source: 'something else entirely',
      paraphrase: 'Wrong paragraph.',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    chatJson.mockResolvedValue({ paraphrase: 'Fresh version.' })

    await expect(getKidFriendlyParaphrase(PARAGRAPH, API_KEYS)).resolves.toBe('Fresh version.')
  })

  it('calls the LLM once on a miss and stores the result', async () => {
    chatJson.mockResolvedValue({ paraphrase: '  Cells get energy from mitochondria.  ' })

    await expect(getKidFriendlyParaphrase(PARAGRAPH, API_KEYS)).resolves.toBe(
      'Cells get energy from mitochondria.'
    )
    expect(chatJson).toHaveBeenCalledTimes(1)
    expect(chatJson.mock.calls[0][0].user).toContain(PARAGRAPH)
    expect(saveParaphrase).toHaveBeenCalledWith(paraphraseCacheKey(PARAGRAPH), {
      source: normalizeParagraphText(PARAGRAPH),
      paraphrase: 'Cells get energy from mitochondria.',
      createdAt: expect.any(String),
    })
  })

  it('dedupes concurrent requests for the same paragraph', async () => {
    let resolve!: (value: { paraphrase: string }) => void
    chatJson.mockReturnValue(new Promise((r) => (resolve = r)))

    const first = getKidFriendlyParaphrase(PARAGRAPH, API_KEYS)
    const second = getKidFriendlyParaphrase(`  ${PARAGRAPH.toUpperCase()} `, API_KEYS)
    expect(second).toBe(first)

    await vi.waitFor(() => expect(chatJson).toHaveBeenCalled())
    resolve({ paraphrase: 'Simple.' })
    await expect(Promise.all([first, second])).resolves.toEqual(['Simple.', 'Simple.'])
    expect(chatJson).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['empty string', { paraphrase: '   ' }],
    ['wrong type', { paraphrase: 42 }],
    ['missing field', { text: 'hi' }],
  ])('throws and does not cache on an invalid response (%s)', async (_label, response) => {
    chatJson.mockResolvedValue(response)

    await expect(getKidFriendlyParaphrase(PARAGRAPH, API_KEYS)).rejects.toThrow()
    expect(saveParaphrase).not.toHaveBeenCalled()
  })

  it('does not cache a Bedrock failure, so a retry calls the LLM again', async () => {
    chatJson.mockRejectedValue(new Error('Bedrock request failed (500)'))
    await expect(getKidFriendlyParaphrase(PARAGRAPH, API_KEYS)).rejects.toThrow(
      'Bedrock request failed (500)'
    )
    expect(saveParaphrase).not.toHaveBeenCalled()

    chatJson.mockReset()
    chatJson.mockResolvedValue({ paraphrase: 'Worked this time.' })
    await expect(getKidFriendlyParaphrase(PARAGRAPH, API_KEYS)).resolves.toBe('Worked this time.')
    expect(chatJson).toHaveBeenCalledTimes(1)
  })
})
