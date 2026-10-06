/** Clean Tesseract output from photographed / scanned book pages. */

export function cleanOcrText(text: string): string {
  const rawLines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())

  // Blank lines are the OCR engine's own paragraph signal, so they split blocks.
  const blocks: string[][] = [[]]
  // Drop caps go first: cleanOcrLine strips a leading "I " and the short-line
  // filter drops a lone "T", either of which would lose the letter.
  for (const raw of reattachDropCaps(rawLines)) {
    const block = blocks[blocks.length - 1]
    if (!raw) {
      if (block.length > 0) blocks.push([])
      continue
    }
    const line = cleanOcrLine(raw)
    if (isUsefulOcrLine(line)) block.push(line)
  }

  return mergeContinuedBlocks(blocks)
    .flatMap((block) => reflowOcrParagraphs(joinHyphenatedLines(block)))
    .join('\n\n')
    .trim()
}

const SINGLE_LETTER_WORDS = new Set(['A', 'I', 'O'])

// Words a drop cap commonly starts; merging into one of these is always safe.
const COMMON_MERGED_WORDS = new Set([
  'about', 'above', 'across', 'after', 'again', 'against', 'all', 'almost',
  'along', 'already', 'also', 'although', 'always', 'among', 'an', 'and',
  'another', 'any', 'are', 'around', 'as', 'at', 'be', 'because', 'before',
  'being', 'both', 'but', 'by', 'can', 'do', 'each', 'even', 'ever', 'every',
  'few', 'for', 'from', 'good', 'great', 'had', 'has', 'have', 'he', 'her',
  'here', 'his', 'how', 'if', 'in', 'indeed', 'instead', 'into', 'is', 'it',
  'its', 'just', 'last', 'let', 'like', 'long', 'many', 'more', 'most',
  'much', 'my', 'never', 'no', 'not', 'nothing', 'now', 'of', 'on', 'once',
  'one', 'only', 'or', 'our', 'out', 'over', 'perhaps', 'she', 'since', 'so',
  'some', 'still', 'such', 'than', 'that', 'the', 'their', 'them', 'then',
  'there', 'these', 'they', 'this', 'those', 'though', 'through', 'thus',
  'to', 'today', 'very', 'was', 'we', 'well', 'were', 'what', 'when',
  'where', 'which', 'while', 'who', 'why', 'with', 'would', 'yet', 'you',
  'your',
])

// Words that read naturally after a lone letter ("B and C", "X is ..."),
// so "B and" is more likely a label than a split drop cap.
const FOLLOWS_LONE_LETTER = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'for', 'from',
  'had', 'has', 'if', 'in', 'is', 'of', 'on', 'or', 'the', 'to', 'vs',
  'was', 'were', 'will', 'with',
])

function isPlausibleDropCap(letter: string, fragment: string): boolean {
  if (COMMON_MERGED_WORDS.has(`${letter}${fragment}`.toLowerCase())) return true
  // "I am", "A dog", "O ye" are real phrases; only whitelisted merges are safe.
  if (SINGLE_LETTER_WORDS.has(letter)) return false
  return !FOLLOWS_LONE_LETTER.has(fragment.toLowerCase())
}

const LONE_DROP_CAP = /^(["'“‘]?)\s*([A-Z])\s*["'”’]?$/
const SPLIT_DROP_CAP = /^(["'“‘]?)([A-Z]) ([a-z]+)(.*)$/

/** Rejoin a decorative first letter that OCR / layout split from its word. */
export function reattachDropCaps(lines: string[]): string[] {
  const out: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const prev = out[out.length - 1]
    const atParagraphStart = !prev || /[.!?:]["')\]]?$/.test(prev)

    const lone = line.match(LONE_DROP_CAP)
    if (lone) {
      // Allow one blank line between the letter and its word.
      const nextIndex = lines[i + 1] === '' ? i + 2 : i + 1
      const next = lines[nextIndex] ?? ''
      const fragment = next.match(/^[a-z]+/)?.[0]
      if (fragment && isPlausibleDropCap(lone[2], fragment)) {
        out.push(`${lone[1]}${lone[2]}${next}`)
        i = nextIndex
        continue
      }
    }

    // "X marks the spot" looks exactly like a split drop cap, so only merge
    // same-line splits into known words.
    const split = atParagraphStart ? line.match(SPLIT_DROP_CAP) : null
    if (split && COMMON_MERGED_WORDS.has(`${split[2]}${split[3]}`.toLowerCase())) {
      out.push(`${split[1]}${split[2]}${split[3]}${split[4]}`)
      continue
    }

    out.push(line)
  }

  return out
}

export function looksLikePoorScanText(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 40) return true

  const letters = (trimmed.match(/[A-Za-z]/g) ?? []).length
  if (letters < 24) return true

  const pipes = (trimmed.match(/\|/g) ?? []).length
  if (pipes / trimmed.length > 0.015) return true

  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length === 0) return true

  const junk = words.filter((word) => /^[|Il1\/\\]{1,3}$/.test(word)).length
  if (junk / words.length > 0.08) return true

  if (looksLikeFusedWords(words)) return true

  return false
}

/**
 * Detects PDFs with a pre-existing invisible text layer (e.g. "OCR for search"
 * done before upload) where words were run together without spaces. pdf.js's
 * own space-insertion heuristic trusts that layer's glyph spacing, so this
 * passes the ordinary letter-density checks above and needs its own signal.
 */
function looksLikeFusedWords(words: string[]): boolean {
  const fused = words.filter(
    (word) => /[a-z]{2,}[A-Z]/.test(word) || /^[a-z]{14,}$/.test(word)
  ).length

  return fused >= 2 && fused / words.length > 0.015
}

function cleanOcrLine(line: string): string {
  return line
    .replace(/[ \t]+/g, ' ')
    // A page-edge bar reads as "|", "l" or "I"; keep "I" when it is the pronoun.
    .replace(/^\s*(?:[|l]|I(?!\s+[a-z]))\s+/g, '')
    .replace(/\s+[|Il]\s*$/g, '')
    .replace(/\s+\|\s+/g, ' ')
    .replace(/\s+BN\s*$/g, '')
    .replace(/\s+[|]\s*/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, '—')
    .replace(/\s+—\s*/g, '—')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function isUsefulOcrLine(line: string): boolean {
  if (!line) return false
  if (/^[|Il1\/\\.,;:'"`~\-]+$/.test(line)) return false
  if (line.length <= 2 && !/^(a|I|A|an|to|of|or|in|on)$/i.test(line)) return false
  const letters = (line.match(/[A-Za-z]/g) ?? []).length
  return letters > 0
}

function joinHyphenatedLines(lines: string[]): string[] {
  const joined: string[] = []

  for (const line of lines) {
    const prev = joined[joined.length - 1]
    if (!prev) {
      joined.push(line)
      continue
    }

    const hyphen = prev.match(/^(.*\w)[‐‑‒–—-]\s*$/)
    if (hyphen && /^[A-Za-z]/.test(line)) {
      joined[joined.length - 1] = `${hyphen[1]}${line}`
      continue
    }

    // Tesseract often reads a hyphen as a period: "meth." + "ods"
    const broken = prev.match(/^(.*[A-Za-z]{3,})\.\s*$/)
    const continuation = line.match(/^([a-z]{2,4})(\b.*)$/)
    if (broken && continuation && !/[.!?]$/.test(prev.slice(0, -1))) {
      joined[joined.length - 1] = `${broken[1]}${continuation[1]}${continuation[2]}`
      continue
    }

    joined.push(line)
  }

  return joined
}

/** A blank line followed by a mid-sentence continuation is a layout gap, not a paragraph. */
function mergeContinuedBlocks(blocks: string[][]): string[][] {
  const merged: string[][] = []

  for (const block of blocks) {
    if (block.length === 0) continue
    const prev = merged[merged.length - 1]
    const last = prev?.[prev.length - 1]
    if (prev && last && continuesAcrossBreak(last, block[0])) {
      prev.push(...block)
      continue
    }
    merged.push([...block])
  }

  return merged
}

function continuesAcrossBreak(prev: string, next: string): boolean {
  if (isHeadingLine(prev) || isHeadingLine(next)) return false
  if (/\w[‐‑‒–—-]$/.test(prev) && /^[A-Za-z]/.test(next)) return true
  return !/[.!?:;]["')\]]?$/.test(prev) && /^[a-z]/.test(next)
}

// A sentence-ending line shorter than this fraction of the block's typical
// line is treated as the last line of a paragraph.
const SHORT_LINE_RATIO = 0.75
const MIN_LINES_FOR_WIDTH = 3

function reflowOcrParagraphs(lines: string[]): string[] {
  const bodyLengths = lines.filter((line) => !isHeadingLine(line)).map((line) => line.length)
  const typicalLength = bodyLengths.length >= MIN_LINES_FOR_WIDTH ? medianOf(bodyLengths) : 0
  const paragraphs: string[] = []
  let current = ''
  let prevLine = ''

  const flush = () => {
    if (current) paragraphs.push(current.trim())
    current = ''
  }

  for (const line of lines) {
    if (isHeadingLine(line)) {
      flush()
      paragraphs.push(line)
      prevLine = ''
      continue
    }

    if (!current) {
      current = line
      prevLine = line
      continue
    }

    if (startsNewParagraph(prevLine, line, typicalLength)) {
      flush()
      current = line
    } else {
      current = `${current} ${line}`
    }
    prevLine = line
  }

  flush()
  return paragraphs
}

function startsNewParagraph(prevLine: string, line: string, typicalLength: number): boolean {
  if (/^[a-z]/.test(line)) return false
  if (!/[.!?]["']?$/.test(prevLine)) return false
  // A sentence that ends on a near-full-width line is just wrapping. Without
  // enough lines to judge width, prefer one paragraph over a false break.
  return typicalLength > 0 && prevLine.length < typicalLength * SHORT_LINE_RATIO
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function isHeadingLine(line: string): boolean {
  return (
    line.length <= 40 &&
    /^[A-Z][A-Z0-9 \-']+$/.test(line) &&
    line.split(/\s+/).length <= 6
  )
}

export function stripHeadersAndFooters<T extends { text: string }>(
  pages: T[]
): T[] {
  if (pages.length === 0) return pages

  const blocks = pages.map((page) => splitBlocks(page.text))
  const repeating = findRepeatingEdges(blocks)

  return pages.map((page, index) => {
    let pageBlocks = blocks[index]
    while (pageBlocks.length > 1 && shouldStripEdge(pageBlocks[0], repeating.headers)) {
      pageBlocks = pageBlocks.slice(1)
    }
    while (
      pageBlocks.length > 1 &&
      shouldStripEdge(pageBlocks[pageBlocks.length - 1], repeating.footers)
    ) {
      pageBlocks = pageBlocks.slice(0, -1)
    }
    return { ...page, text: pageBlocks.join('\n\n') }
  })
}

export function stitchPages<T extends { text: string }>(pages: T[]): T[] {
  const next = pages.map((page) => ({ ...page, text: page.text.trim() }))

  for (let i = 0; i < next.length - 1; i++) {
    const current = next[i].text
    const following = next[i + 1].text
    if (!current || !following) continue

    const hyphen = current.match(/^(.*)(\w)[‐‑‒–—-]\s*$/)
    const continuation = following.match(/^([A-Za-z]+)([\s\S]*)$/)
    if (hyphen && continuation) {
      next[i].text = `${hyphen[1]}${hyphen[2]}${continuation[1]}`
      next[i + 1].text = continuation[2].replace(/^\s+/, '')
    }
  }

  return next
}

export function joinPageTexts(texts: string[]): string {
  let combined = ''

  for (const raw of texts) {
    const text = raw.trim()
    if (!text) continue
    if (!combined) {
      combined = text
      continue
    }

    if (/[‐‑‒–—-]$/.test(combined)) {
      combined = combined.replace(/[‐‑‒–—-]\s*$/, '') + text.replace(/^\s+/, '')
      continue
    }

    if (!/[.!?]"'?$/.test(combined) && /^[a-z]/.test(text)) {
      combined = `${combined} ${text}`
      continue
    }

    combined = `${combined}\n\n${text}`
  }

  return combined.trim()
}

function splitBlocks(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
}

function normalizeEdge(block: string): string {
  return block
    .toLowerCase()
    .replace(/[0-9]+/g, '#')
    .replace(/[^a-z#\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function findRepeatingEdges(pages: string[][]): { headers: Set<string>; footers: Set<string> } {
  const headerCounts = new Map<string, number>()
  const footerCounts = new Map<string, number>()

  for (const blocks of pages) {
    if (blocks[0]) bump(headerCounts, normalizeEdge(blocks[0]))
    const last = blocks[blocks.length - 1]
    if (last && last !== blocks[0]) bump(footerCounts, normalizeEdge(last))
  }

  const minRepeat = pages.length === 1 ? 2 : Math.max(2, Math.ceil(pages.length * 0.4))
  return {
    headers: keysAtLeast(headerCounts, minRepeat),
    footers: keysAtLeast(footerCounts, minRepeat),
  }
}

function shouldStripEdge(block: string, repeating: Set<string>): boolean {
  if (isPageNumberBlock(block)) return true
  if (repeating.has(normalizeEdge(block))) return true
  return looksLikeRunningHeader(block)
}

function looksLikeRunningHeader(block: string): boolean {
  const trimmed = block.trim()
  const words = trimmed.split(/\s+/)
  return (
    words.length <= 3 &&
    trimmed.length <= 28 &&
    /^[A-Z0-9][A-Z0-9 \-']+$/.test(trimmed)
  )
}

function isPageNumberBlock(block: string): boolean {
  const trimmed = block.trim()
  return /^\d{1,4}$/.test(trimmed) || /^page\s+\d{1,4}$/i.test(trimmed)
}

function bump(counts: Map<string, number>, key: string): void {
  if (!key) return
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

function keysAtLeast(counts: Map<string, number>, min: number): Set<string> {
  return new Set(
    [...counts.entries()].filter(([, count]) => count >= min).map(([key]) => key)
  )
}
