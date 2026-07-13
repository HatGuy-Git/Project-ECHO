/**
 * Extract Section B (written knowledge test prep) from raw TN manual text.
 */

import { SECTION_B_CHAPTERS } from '../constants/tennesseeDriver'

const SAMPLE_QUESTIONS_START =
  /(?:^|\n)\s*Chapter\s+\d+\s*[-–]?\s*Chapter\s+Sample\s+Test\s+Questions\b/i

export interface RawChapter {
  number: number
  title: string
  body: string
}

export function extractSectionBText(rawText: string): string {
  const normalized = preprocessRawText(rawText)
  const startIndex = findSectionBBodyStart(normalized)

  if (startIndex < 0) {
    throw new Error(
      'Could not find Section B in this PDF. Upload the official Tennessee Driver License Manual.'
    )
  }

  const endIndex = findSectionBBodyEnd(normalized, startIndex)
  const sectionB = normalized.slice(startIndex, endIndex).trim()

  if (sectionB.length < 500) {
    throw new Error(
      'Section B content looks incomplete. Upload the official Tennessee DL_Manual.pdf file.'
    )
  }

  return stripSectionBIntro(sectionB)
}

export function splitSectionBChapters(sectionBText: string): RawChapter[] {
  const text = preprocessRawText(sectionBText)
  let markers = findCanonicalBodyChapterMarkers(text)

  if (markers.length < 4) {
    markers = findChapterMarkersFromLines(text)
  }

  if (markers.length < 4) {
    markers = findChapterMarkersByKnownTitles(text)
  }

  if (markers.length === 0) {
    throw new Error(
      'Could not identify Section B chapters in the manual. Try uploading the official Tennessee DL_Manual.pdf file.'
    )
  }

  markers.sort((a, b) => a.index - b.index)

  const chapters: RawChapter[] = []
  for (let i = 0; i < markers.length; i++) {
    const { index, number, title } = markers[i]
    const nextIndex = markers[i + 1]?.index ?? text.length
    let body = text.slice(index, nextIndex)

    body = stripChapterHeaderLine(body, number, title)
    body = stripSampleTestQuestions(body)
    body = stripIrrelevantContent(body)

    if (body.trim().length >= 80) {
      chapters.push({
        number,
        title: title || getDefaultChapterTitle(number),
        body: body.trim(),
      })
    }
  }

  const deduped = dedupeChapters(chapters)
  if (deduped.length === 0) {
    throw new Error('Could not identify Section B chapters in the manual.')
  }

  return ensureAllChapters(deduped, text)
}

interface ChapterMarker {
  index: number
  number: number
  title: string
}

/**
 * Find where Section B body content begins.
 * Avoid the TOC blurb ("Section B. This section is designed…") near the front of the manual.
 */
function findSectionBBodyStart(text: string): number {
  const candidates: number[] = []

  const b1Patterns = [
    /(?:^|\n)\s*Section\s+B\s*[-–]\s*1\s+GETTING\s+FAMILIAR/gi,
    /(?:^|\n)\s*Section\s+B-1\s+/gi,
    /(?:^|\n)\s*Section\s+B\s*[-–.]\s*(?:Chapter\s*)?1\s+GETTING\s+FAMILIAR/gi,
    /(?:^|\n)\s*Section\s+B\s*[-–.]\s*(?:Chapter\s*)?1\s+/gi,
  ]

  for (const pattern of b1Patterns) {
    const matches = [...text.matchAll(pattern)]
    if (matches.length > 0) {
      candidates.push(matches[matches.length - 1].index!)
    }
  }

  const sectionHeader = /(?:^|\n)\s*SECTION\s+B\s*(?:\n|$)/gi
  const headerMatches = [...text.matchAll(sectionHeader)]
  if (headerMatches.length > 0) {
    candidates.push(headerMatches[headerMatches.length - 1].index!)
  }

  if (candidates.length === 0) {
    return -1
  }

  return Math.min(...candidates)
}

/**
 * End Section B before the answer key or Section C body — not inline "Section C" references.
 */
function findSectionBBodyEnd(text: string, startIndex: number): number {
  const slice = text.slice(startIndex)
  const endPatterns = [
    /(?:^|\n)\s*STUDY\s+QUESTIONS\s+ANSWER\s+KEY\b/i,
    /(?:^|\n)\s*SECTION\s+C\s*(?:\n|$)/i,
    /(?:^|\n)\s*Chapter\s+C-1\b/i,
    /(?:^|\n)\s*Section\s+C-1\b/i,
  ]

  let earliest = text.length
  for (const pattern of endPatterns) {
    const match = pattern.exec(slice)
    if (match?.index !== undefined) {
      earliest = Math.min(earliest, startIndex + match.index)
    }
  }

  return earliest
}

/**
 * Body chapters appear as "Section B-1 …" — use the last match per number
 * to skip table-of-contents duplicates at the front of the manual.
 */
function findCanonicalBodyChapterMarkers(text: string): ChapterMarker[] {
  const markers: ChapterMarker[] = []

  for (const meta of SECTION_B_CHAPTERS) {
    const pattern = new RegExp(
      `(?:^|\\n)\\s*Section\\s+B\\s*[-–]\\s*${meta.number}\\s+`,
      'gi'
    )
    const indices: number[] = []
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      indices.push(match.index)
    }

    if (indices.length > 0) {
      markers.push({
        index: indices[indices.length - 1],
        number: meta.number,
        title: meta.title,
      })
    }
  }

  return markers.sort((a, b) => a.index - b.index)
}

/** Line-by-line scan for alternate heading formats */
function findChapterMarkersFromLines(text: string): ChapterMarker[] {
  const lines = text.split('\n')
  const markers: ChapterMarker[] = []
  let charIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineStart = charIndex
    charIndex += line.length + 1

    const trimmed = line.trim()
    if (!trimmed) continue

    const parsed = parseChapterHeadingLine(trimmed)
    if (!parsed) continue

    let title = parsed.title
    if (!title && i + 1 < lines.length) {
      const next = lines[i + 1].trim()
      if (isLikelyTitleLine(next)) title = next
    }
    if (title && i + 1 < lines.length) {
      const next = lines[i + 1].trim()
      if (isLikelyTitleContinuation(title, next) && !parseChapterHeadingLine(next)) {
        title = `${title} ${next}`.trim()
      }
    }

    markers.push({
      index: lineStart,
      number: parsed.number,
      title: cleanChapterTitle(title) || getDefaultChapterTitle(parsed.number),
    })
  }

  return dedupeMarkersByLastIndex(markers)
}

/** Fallback: locate chapters by known titles (handles odd PDF line breaks). */
function findChapterMarkersByKnownTitles(text: string): ChapterMarker[] {
  const markers: ChapterMarker[] = []

  for (const meta of SECTION_B_CHAPTERS) {
    const titleVariants = buildTitleSearchVariants(meta.title)
    let bestIndex = -1

    for (const variant of titleVariants) {
      const pattern = new RegExp(
        `(?:^|\\n)\\s*${escapeRegex(variant)}\\b`,
        'gi'
      )
      const matches = [...text.matchAll(pattern)]
      if (matches.length > 0) {
        const index = matches[matches.length - 1].index!
        if (index > bestIndex) bestIndex = index
      }
    }

    if (bestIndex >= 0) {
      markers.push({
        index: bestIndex,
        number: meta.number,
        title: meta.title,
      })
    }
  }

  return dedupeMarkersByLastIndex(markers)
}

function buildTitleSearchVariants(title: string): string[] {
  const upper = title.toUpperCase().replace(/\s+/g, ' ').trim()
  const variants = new Set<string>([upper])

  if (upper.includes(' INCLEMENT WEATHER')) {
    variants.add(upper.replace(' INCLEMENT WEATHER', ' INCLEMENT'))
    variants.add(`${upper} CONDITIONS`)
  }

  if (upper.endsWith(' RESPONSIBILITY')) {
    variants.add(upper.replace(' RESPONSIBILITY', ' RESPONSIBILITIES'))
  }

  const words = upper.split(' ')
  if (words.length >= 4) {
    variants.add(words.slice(0, 4).join(' '))
  }

  return [...variants]
}

function dedupeMarkersByLastIndex(markers: ChapterMarker[]): ChapterMarker[] {
  const byNumber = new Map<number, ChapterMarker>()
  for (const marker of markers) {
    const existing = byNumber.get(marker.number)
    if (!existing || marker.index > existing.index) {
      byNumber.set(marker.number, marker)
    }
  }
  return [...byNumber.values()].sort((a, b) => a.index - b.index)
}

function parseChapterHeadingLine(line: string): { number: number; title: string } | null {
  const patterns = [
    /^Section\s+B\s*[-–]\s*(?:Chapter\s*)?(\d+)\s+(.+)$/i,
    /^Section\s+B\s*[-–.]\s*(?:Chapter\s*)?(\d+)\s*[-–:.]?\s*(.*)$/i,
    /^SECTION\s+B\s*[-–.]\s*(\d+)\s*(.*)$/i,
    /^Section\s+B\s+(\d+)\s*[-–:.]?\s*(.*)$/i,
  ]

  for (const pattern of patterns) {
    const match = line.match(pattern)
    if (!match) continue
    const number = parseInt(match[1], 10)
    if (number < 1 || number > 8) continue
    return { number, title: (match[2] || '').trim() }
  }

  return null
}

function isLikelyTitleLine(line: string): boolean {
  if (!line || line.length > 100) return false
  if (parseChapterHeadingLine(line)) return false
  return /^[A-Z][A-Za-z0-9\s,'()/-]{4,}$/.test(line)
}

function isLikelyTitleContinuation(title: string, nextLine: string): boolean {
  if (!nextLine || nextLine.length > 60) return false
  if (parseChapterHeadingLine(nextLine)) return false
  const endsPartial =
    /\b(AND|IN|OF|THE|WITH|FOR|AT|ON|TO)$/i.test(title.trim()) ||
    title.length < 25
  return endsPartial && /^[A-Z][A-Z\s,'()-]+$/.test(nextLine)
}

function ensureAllChapters(chapters: RawChapter[], _fullText: string): RawChapter[] {
  return chapters.sort((a, b) => a.number - b.number)
}

function getDefaultChapterTitle(number: number): string {
  return SECTION_B_CHAPTERS.find((c) => c.number === number)?.title ?? `Chapter ${number}`
}

function stripChapterHeaderLine(body: string, number: number, title: string): string {
  const patterns = [
    new RegExp(
      `^\\s*Section\\s+B\\s*[-–]\\s*${number}\\s+${escapeRegex(title.toUpperCase().split(' ').slice(0, 3).join(' '))}`,
      'i'
    ),
    new RegExp(`^\\s*Section\\s+B\\s*[-–.]\\s*(?:Chapter\\s*)?${number}\\b[^\\n]*`, 'i'),
    new RegExp(`^\\s*SECTION\\s+B\\s*[-–.]\\s*${number}\\b[^\\n]*`, 'i'),
    new RegExp(`^\\s*${escapeRegex(title.toUpperCase())}\\b[^\\n]*`, 'i'),
  ]

  for (const pattern of patterns) {
    if (pattern.test(body)) {
      return body.replace(pattern, '').trimStart()
    }
  }

  return body
}

function preprocessRawText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/---PAGE\s+\d+---/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
}

function stripSectionBIntro(text: string): string {
  const firstChapter =
    /(?:^|\n)\s*Section\s+B\s*[-–]\s*1\s+/i
  const match = firstChapter.exec(text)
  if (match?.index !== undefined) {
    return text.slice(match.index).trimStart()
  }
  return text
}

function stripSampleTestQuestions(text: string): string {
  const match = SAMPLE_QUESTIONS_START.exec(text)
  if (!match || match.index === undefined) return text
  return text.slice(0, match.index)
}

function stripIrrelevantContent(text: string): string {
  const lines = text.split('\n')
  const kept: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (kept.length > 0 && kept[kept.length - 1] !== '') kept.push('')
      continue
    }
    if (isNoiseLine(trimmed)) continue
    kept.push(trimmed)
  }

  return kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isNoiseLine(line: string): boolean {
  if (/^TABLE OF CONTENTS$/i.test(line)) return true
  if (/^Page\s+\d+$/i.test(line)) return true
  if (/^\d{1,3}$/.test(line)) return true
  if (/^Website Resources:/i.test(line)) return true
  if (/^www\.tn\.gov/i.test(line)) return true
  if (/^Practice test topics/i.test(line)) return true
  if (/^Chapter\s+\d+\s*[-–]?\s*Chapter\s+Sample\s+Test\s+Questions/i.test(line)) return true
  if (/^Here are some sample test questions/i.test(line)) return true
  if (/^STUDY QUESTIONS ANSWER KEY/i.test(line)) return true
  return false
}

function cleanChapterTitle(raw: string): string {
  if (!raw) return ''
  return raw.replace(/\s+/g, ' ').trim()
}

function dedupeChapters(chapters: RawChapter[]): RawChapter[] {
  const byNumber = new Map<number, RawChapter>()
  for (const chapter of chapters) {
    const existing = byNumber.get(chapter.number)
    if (!existing || chapter.body.length > existing.body.length) {
      byNumber.set(chapter.number, chapter)
    }
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
