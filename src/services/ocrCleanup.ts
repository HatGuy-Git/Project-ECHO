/** Clean Tesseract output from photographed / scanned book pages. */

export function cleanOcrText(text: string): string {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => cleanOcrLine(line))
    .filter((line) => isUsefulOcrLine(line))

  const dehyphenated = joinHyphenatedLines(lines)
  return reflowOcrParagraphs(dehyphenated)
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
    .replace(/^\s*[|Il]\s+/g, '')
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

function reflowOcrParagraphs(lines: string[]): string {
  const paragraphs: string[] = []
  let current = ''

  const flush = () => {
    if (current) paragraphs.push(current.trim())
    current = ''
  }

  for (const line of lines) {
    if (isHeadingLine(line)) {
      flush()
      paragraphs.push(line)
      continue
    }

    if (!current) {
      current = line
      continue
    }

    const prevEndsSentence = /[.!?]["']?$/.test(current)
    const nextStartsLower = /^[a-z]/.test(line)
    const prevLooksWrapped = current.length < 90 || !prevEndsSentence

    if (nextStartsLower || (prevLooksWrapped && !prevEndsSentence)) {
      current = `${current} ${line}`
      continue
    }

    flush()
    current = line
  }

  flush()
  return paragraphs.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
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
