import type { StudyBlock } from '../types'
import { countWords } from '../utils/wordHighlight'

const SUBHEADING_PATTERN =
  /^[A-Z][A-Za-z0-9\s,'()/-]{3,70}$/

const BULLET_PATTERN = /^[•●▪-]\s+/
const NUMBERED_PATTERN = /^(\d{1,2})[.)]\s+/

export function parseChapterIntoBlocks(rawBody: string): StudyBlock[] {
  const paragraphs = splitIntoParagraphs(rawBody)
  const blocks: StudyBlock[] = []
  let pendingBullets: string[] = []
  let pendingNumbered: string[] = []

  const flushBullets = () => {
    if (pendingBullets.length > 0) {
      blocks.push({ type: 'bullet', text: '', items: [...pendingBullets] })
      pendingBullets = []
    }
  }

  const flushNumbered = () => {
    if (pendingNumbered.length > 0) {
      blocks.push({ type: 'numbered', text: '', items: [...pendingNumbered] })
      pendingNumbered = []
    }
  }

  for (const paragraph of paragraphs) {
    const lines = paragraph.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) continue

    // Multi-line bullet paragraph
    if (lines.every((l) => BULLET_PATTERN.test(l))) {
      flushNumbered()
      for (const line of lines) {
        pendingBullets.push(line.replace(BULLET_PATTERN, '').trim())
      }
      continue
    }

    // Single paragraph that's one bullet
    if (lines.length === 1 && BULLET_PATTERN.test(lines[0])) {
      flushNumbered()
      pendingBullets.push(lines[0].replace(BULLET_PATTERN, '').trim())
      continue
    }

    // Numbered list lines
    if (lines.every((l) => NUMBERED_PATTERN.test(l))) {
      flushBullets()
      for (const line of lines) {
        pendingNumbered.push(line.replace(NUMBERED_PATTERN, '').trim())
      }
      continue
    }

    flushBullets()
    flushNumbered()

    const text = lines.join(' ')
    const blockType = classifyParagraph(text)
    blocks.push({ type: blockType, text: polishText(text) })
  }

  flushBullets()
  flushNumbered()

  return mergeAdjacentParagraphs(blocks)
}

export function blocksToSpeechText(blocks: StudyBlock[]): string {
  return blocks
    .map((block) => {
      if (block.items && block.items.length > 0) {
        return block.items.join(' ')
      }
      return block.text
    })
    .filter((text) => text.length > 0)
    .join('\n\n')
}

export function blocksToPreview(blocks: StudyBlock[], maxWords = 24): string {
  const full = blocksToSpeechText(blocks)
  const words = full.split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return full
  return words.slice(0, maxWords).join(' ') + '…'
}

/** Word offset for each block — must match blocksToSpeechText joining */
export function blockWordOffsets(blocks: StudyBlock[]): number[] {
  const offsets: number[] = []
  let total = 0
  for (const block of blocks) {
    offsets.push(total)
    const text =
      block.items && block.items.length > 0
        ? block.items.join(' ')
        : block.text
    total += countWords(text)
    // blocksToSpeechText joins with \n\n — whitespace only, no extra words
    if (text.length > 0) {
      // next block exists — separator doesn't add words
    }
  }
  return offsets
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

function classifyParagraph(text: string): StudyBlock['type'] {
  if (isLawParagraph(text)) return 'law'
  if (isWarningParagraph(text)) return 'warning'
  if (isSubheading(text)) return 'subheading'
  if (isKeyPointParagraph(text)) return 'keyPoint'
  return 'paragraph'
}

function isSubheading(text: string): boolean {
  if (text.length > 72 || text.length < 6) return false
  if (text.endsWith('.')) return false
  if (SUBHEADING_PATTERN.test(text) && /[a-z]/.test(text) === false) return true
  // Title case short lines without period
  if (
    text.length < 55 &&
    !text.endsWith('.') &&
    /^[A-Z]/.test(text) &&
    !/\b(is|are|was|were|must|shall|the|and|or)\b/i.test(text.split(' ').slice(-3).join(' '))
  ) {
    const words = text.split(/\s+/)
    if (words.length <= 8 && words.every((w) => /^[A-Z]/.test(w) || /^(of|and|the|in|at|on|for|to|a|an)$/i.test(w))) {
      return true
    }
  }
  return false
}

function isLawParagraph(text: string): boolean {
  return (
    /\bTennessee law\b/i.test(text) ||
    /\bis required by law\b/i.test(text) ||
    /\bshall not\b/i.test(text) ||
    /\bis prohibited\b/i.test(text) ||
    /\bEffective January 1\b/i.test(text) ||
    /\bIt's the Law\b/i.test(text) ||
    /\bImplied Consent Law\b/i.test(text)
  )
}

function isWarningParagraph(text: string): boolean {
  return (
    /\bDO NOT\b/.test(text) ||
    /\bNEVER\b/.test(text) ||
    /\bDANGEROUS\b/i.test(text) ||
    /\bcan be fatal\b/i.test(text)
  )
}

function isKeyPointParagraph(text: string): boolean {
  return (
    /^Remember\b/i.test(text) ||
    /^Important\b/i.test(text) ||
    /^Note:\b/i.test(text) ||
    /\bminimum score of 80%/i.test(text) ||
    /\b24 correct/i.test(text)
  )
}

function polishText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
}

function mergeAdjacentParagraphs(blocks: StudyBlock[]): StudyBlock[] {
  const merged: StudyBlock[] = []

  for (const block of blocks) {
    const prev = merged[merged.length - 1]
    if (
      prev &&
      prev.type === 'paragraph' &&
      block.type === 'paragraph' &&
      prev.text.length + block.text.length < 1200
    ) {
      prev.text = `${prev.text} ${block.text}`
      continue
    }
    merged.push({ ...block })
  }

  return merged
}
