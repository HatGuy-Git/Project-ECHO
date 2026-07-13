/**
 * Split a chapter body into subsections by PDF subheadings.
 */

export interface RawSubsection {
  title: string
  body: string
}

const BULLET_PATTERN = /^[•●▪-]\s+/
const NUMBERED_LIST_PATTERN = /^\d{1,2}[.)]\s+/
const LETTERED_HEADING = /^[A-D]\.\s+[A-Z]/

export function splitChapterIntoSubsections(
  chapterTitle: string,
  body: string
): RawSubsection[] {
  const lines = body.split('\n')
  const parts: RawSubsection[] = []
  let currentTitle = chapterTitle
  let currentLines: string[] = []

  const flush = () => {
    const text = currentLines.join('\n').trim()
    if (text.length >= 40) {
      parts.push({ title: currentTitle, body: text })
    }
    currentLines = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (currentLines.length > 0) currentLines.push('')
      continue
    }

    if (
      isSubsectionHeading(trimmed) &&
      (currentLines.length > 0 || currentTitle !== chapterTitle)
    ) {
      flush()
      currentTitle = cleanSubsectionTitle(trimmed)
      continue
    }

    if (isSubsectionHeading(trimmed) && currentLines.length === 0) {
      currentTitle = cleanSubsectionTitle(trimmed)
      continue
    }

    currentLines.push(trimmed)
  }

  flush()

  if (parts.length === 0) {
    return [{ title: chapterTitle, body: body.trim() }]
  }

  const merged = mergeSmallSubsections(parts)
  return splitOversizedSubsections(merged)
}

function isSubsectionHeading(line: string): boolean {
  if (line.length < 4 || line.length > 90) return false
  if (BULLET_PATTERN.test(line)) return false
  if (NUMBERED_LIST_PATTERN.test(line)) return false
  if (parseChapterHeadingLike(line)) return false
  if (LETTERED_HEADING.test(line)) return true

  // Short title-case or ALL-CAPS line without sentence ending
  if (line.endsWith('.') && line.length > 50) return false
  if (/\.\s+[A-Z]/.test(line)) return false

  if (/^[A-Z][A-Z0-9\s,'()/-]{3,}$/.test(line) && !line.endsWith('.')) {
    return true
  }

  if (
    line.length <= 55 &&
    /^[A-Z]/.test(line) &&
    !/\b(is|are|was|were|must|shall|will|can|should)\b/i.test(line)
  ) {
    const words = line.split(/\s+/)
    if (words.length <= 10) return true
  }

  return false
}

function parseChapterHeadingLike(line: string): boolean {
  return /^Section\s+B\s*[-–.]/i.test(line)
}

function cleanSubsectionTitle(line: string): string {
  return line
    .replace(/^[A-D]\.\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function mergeSmallSubsections(parts: RawSubsection[]): RawSubsection[] {
  const merged: RawSubsection[] = []

  for (const part of parts) {
    const prev = merged[merged.length - 1]
    if (prev && part.body.length < 250) {
      prev.body = `${prev.body}\n\n${part.body}`
      if (part.title !== prev.title && !prev.title.includes(part.title)) {
        prev.title = prev.title
      }
      continue
    }
    merged.push({ ...part })
  }

  return merged
}

/** Keep narration chunks under ~12k chars — split on paragraph boundaries */
function splitOversizedSubsections(
  parts: RawSubsection[],
  maxChars = 12000
): RawSubsection[] {
  const result: RawSubsection[] = []

  for (const part of parts) {
    if (part.body.length <= maxChars) {
      result.push(part)
      continue
    }

    const paragraphs = part.body.split(/\n\n+/)
    let chunk: string[] = []
    let chunkLen = 0
    let partIndex = 1

    const flushChunk = () => {
      if (chunk.length === 0) return
      const suffix = partIndex > 1 ? ` (${partIndex})` : ''
      result.push({
        title: `${part.title}${suffix}`,
        body: chunk.join('\n\n'),
      })
      partIndex++
      chunk = []
      chunkLen = 0
    }

    for (const para of paragraphs) {
      if (chunkLen + para.length > maxChars && chunk.length > 0) {
        flushChunk()
      }
      chunk.push(para)
      chunkLen += para.length
    }
    flushChunk()
  }

  return result
}
