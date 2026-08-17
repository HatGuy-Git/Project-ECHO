import type { ExtractedPdfPage } from './pdfExtractor'
import type { ReadingChunk, ReadingDocument } from '../types'
import { storage } from './storage'
import {
  cleanOcrText,
  joinPageTexts,
  stitchPages,
  stripHeadersAndFooters,
} from './ocrCleanup'

const TARGET_CHUNK_CHARS = 3500
const MIN_CHUNK_CHARS = 80

export function buildReadingDocument(
  pages: ExtractedPdfPage[],
  sourceName: string
): ReadingDocument {
  const cleaned = stitchPages(
    stripHeadersAndFooters(
      pages
        .map((page) => ({
          ...page,
          text: page.usedOcr ? cleanOcrText(page.text) : cleanPageText(page.text),
        }))
        .filter((page) => page.text.length > 0)
    )
  )

  if (cleaned.length === 0) {
    throw new Error(
      'No readable text found in this PDF. Try a text-based PDF, or a clearer scan.'
    )
  }

  const chunks = splitPagesIntoChunks(cleaned)
  const usedOcr = cleaned.some((page) => page.usedOcr)

  return {
    id: storage.generateId(),
    title: titleFromFileName(sourceName),
    sourceName,
    processedAt: new Date(),
    chunks,
    currentChunkIndex: 0,
    voiceId: null,
    usedOcr,
  }
}

function splitPagesIntoChunks(pages: ExtractedPdfPage[]): ReadingChunk[] {
  const chunks: ReadingChunk[] = []
  let buffer: ExtractedPdfPage[] = []
  let bufferLen = 0

  const flush = () => {
    if (buffer.length === 0) return
    const content = joinPageTexts(buffer.map((page) => page.text))
    if (content.length < MIN_CHUNK_CHARS) {
      buffer = []
      bufferLen = 0
      return
    }

    const pageStart = buffer[0].pageNumber
    const pageEnd = buffer[buffer.length - 1].pageNumber
    const usedOcr = buffer.some((page) => page.usedOcr)
    const order = chunks.length

    chunks.push({
      id: storage.generateId(),
      title: pageStart === pageEnd ? `Page ${pageStart}` : `Pages ${pageStart}–${pageEnd}`,
      content,
      pageStart,
      pageEnd,
      usedOcr,
      order,
    })

    buffer = []
    bufferLen = 0
  }

  for (const page of pages) {
    if (page.text.length > TARGET_CHUNK_CHARS) {
      flush()
      for (const part of splitLongText(page.text)) {
        chunks.push({
          id: storage.generateId(),
          title: `Page ${page.pageNumber}`,
          content: part,
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          usedOcr: page.usedOcr,
          order: chunks.length,
        })
      }
      continue
    }

    if (bufferLen + page.text.length > TARGET_CHUNK_CHARS && buffer.length > 0) {
      flush()
    }

    buffer.push(page)
    bufferLen += page.text.length
  }

  flush()
  return chunks
}

function splitLongText(text: string, maxChars = TARGET_CHUNK_CHARS): string[] {
  const paragraphs = text.split(/\n\n+/)
  const parts: string[] = []
  let chunk: string[] = []
  let chunkLen = 0

  const flushChunk = () => {
    if (chunk.length === 0) return
    parts.push(chunk.join('\n\n'))
    chunk = []
    chunkLen = 0
  }

  for (const paragraph of paragraphs) {
    if (chunkLen + paragraph.length > maxChars && chunk.length > 0) {
      flushChunk()
    }
    if (paragraph.length > maxChars) {
      flushChunk()
      for (const sentence of splitBySentence(paragraph, maxChars)) {
        parts.push(sentence)
      }
      continue
    }
    chunk.push(paragraph)
    chunkLen += paragraph.length
  }

  flushChunk()
  return parts
}

function splitBySentence(text: string, maxChars: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text]
  const parts: string[] = []
  let current = ''

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence.trim()}` : sentence.trim()
    if (next.length > maxChars && current) {
      parts.push(current.trim())
      current = sentence.trim()
    } else {
      current = next
    }
  }

  if (current.trim()) parts.push(current.trim())
  return parts
}

function cleanPageText(text: string): string {
  return text
    .replace(/---PAGE\s+\d+---/g, '')
    .replace(/\f/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function titleFromFileName(sourceName: string): string {
  const base = sourceName.replace(/\\/g, '/').split('/').pop() ?? sourceName
  return base.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Reading'
}
