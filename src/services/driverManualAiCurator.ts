import type { StudyBlock } from '../types'
import { SECTION_B_CHAPTERS } from '../constants/tennesseeDriver'
import type { RawChapter } from './sectionBExtractor'
import { chatJson, type BedrockLlmConfig } from './llmClient'

const VALID_BLOCK_TYPES = new Set<StudyBlock['type']>([
  'heading',
  'subheading',
  'paragraph',
  'bullet',
  'numbered',
  'law',
  'warning',
  'keyPoint',
])

const MAX_CHAPTER_INPUT_CHARS = 90000

const SYSTEM_PROMPT = `You prepare Tennessee DMV written knowledge test study guides from raw PDF text extracts.

Your job:
1. KEEP facts, laws, numbers, distances, penalties, and rules that could appear on the 30-question written test.
2. REMOVE irrelevant material: sample test questions and answer keys, page numbers, table of contents, licensing paperwork (Section A), Section C cross-references, organ donation, application forms, website promos, and narrative filler that does not help pass the test.
3. DO NOT invent, guess, or alter facts. Only reorganize and clarify what is in the source text.
4. FORMAT for a student using read-along narration — clear subheadings, short paragraphs, and bullet/numbered lists where appropriate.
5. Mark Tennessee-specific laws and hard requirements as type "law". Mark DO NOT / NEVER / danger content as "warning". Mark exam-critical facts (passing score, BAC limits, distances, ages) as "keyPoint".

Respond with JSON only:
{
  "testFocus": "one sentence describing what this chapter covers on the written test",
  "blocks": [
    { "type": "subheading", "text": "..." },
    { "type": "paragraph", "text": "..." },
    { "type": "bullet", "items": ["...", "..."] },
    { "type": "numbered", "items": ["...", "..."] },
    { "type": "law", "text": "..." },
    { "type": "warning", "text": "..." },
    { "type": "keyPoint", "text": "..." }
  ]
}

Block types allowed: subheading, paragraph, bullet, numbered, law, warning, keyPoint.
For bullet and numbered blocks use "items" (not "text"). For all other types use "text".`

interface AiChapterResponse {
  testFocus?: string
  blocks?: unknown[]
}

export interface AiCuratedChapter {
  chapterNumber: number
  title: string
  testFocus: string
  blocks: StudyBlock[]
}

export async function curateChapterWithAi(
  chapter: RawChapter,
  bedrock: BedrockLlmConfig
): Promise<AiCuratedChapter> {
  const meta = SECTION_B_CHAPTERS.find((c) => c.number === chapter.number)
  const title = meta?.title ?? chapter.title

  const sourceText =
    chapter.body.length > MAX_CHAPTER_INPUT_CHARS
      ? chapter.body.slice(0, MAX_CHAPTER_INPUT_CHARS) +
        '\n\n[Text truncated — remaining content omitted from source extract]'
      : chapter.body

  const userPrompt = `Section B, Chapter ${chapter.number}: "${title}"

Raw PDF extract:
---
${sourceText}
---`

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await chatJson<AiChapterResponse>({
        bedrock,
        system: SYSTEM_PROMPT,
        user: userPrompt,
      })

      const blocks = normalizeAiBlocks(result.blocks)
      if (blocks.length === 0) {
        throw new Error('AI returned no study content.')
      }

      return {
        chapterNumber: chapter.number,
        title,
        testFocus: result.testFocus?.trim() || meta?.testFocus || title,
        blocks,
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('AI curation failed.')
    }
  }

  throw lastError ?? new Error('AI curation failed.')
}

export async function curateChaptersWithAi(
  chapters: RawChapter[],
  bedrock: BedrockLlmConfig,
  onProgress?: (message: string) => void
): Promise<AiCuratedChapter[]> {
  const curated: AiCuratedChapter[] = []

  for (const chapter of chapters) {
    const meta = SECTION_B_CHAPTERS.find((c) => c.number === chapter.number)
    const label = meta?.title ?? `Chapter ${chapter.number}`
    onProgress?.(`AI analyzing Section B · ${label}…`)

    const result = await curateChapterWithAi(chapter, bedrock)
    curated.push(result)
  }

  return curated.sort((a, b) => a.chapterNumber - b.chapterNumber)
}

function normalizeAiBlocks(raw: unknown): StudyBlock[] {
  if (!Array.isArray(raw)) return []

  const blocks: StudyBlock[] = []

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const block = entry as { type?: string; text?: string; items?: unknown }

    if (!block.type || !VALID_BLOCK_TYPES.has(block.type as StudyBlock['type'])) {
      continue
    }

    const type = block.type as StudyBlock['type']

    if (type === 'bullet' || type === 'numbered') {
      const items = Array.isArray(block.items)
        ? block.items.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : []
      if (items.length === 0) continue
      blocks.push({ type, text: '', items: items.map((item) => item.trim()) })
      continue
    }

    const text = typeof block.text === 'string' ? block.text.trim() : ''
    if (!text) continue
    blocks.push({ type, text })
  }

  return blocks
}
