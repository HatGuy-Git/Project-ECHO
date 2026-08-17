import * as pdfjsLib from 'pdfjs-dist'
import { TN_DL_MANUAL_PDF_PROXY } from '../constants/tennesseeDriver'
import { looksLikePoorScanText } from './ocrCleanup'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export interface ExtractedPdfPage {
  pageNumber: number
  text: string
  usedOcr: boolean
}

export interface ExtractPdfPagesOptions {
  onProgress?: (message: string) => void
  /** OCR pages that have little or no embedded text */
  ocrIfNeeded?: boolean
  /** Use AWS Textract via the local server (default AWS credentials). */
  textract?: boolean
}

export async function extractTextFromPdf(data: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const structuredPages: string[] = []
  const simplePages: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const textItems: { str: string; transform?: number[] }[] = []
    for (const item of textContent.items) {
      if (!('str' in item)) continue
      const textItem = item as { str: string; transform?: number[] }
      textItems.push(textItem)
    }

    structuredPages.push(`---PAGE ${pageNum}---\n${extractStructuredLines(textItems)}`)
    simplePages.push(`---PAGE ${pageNum}---\n${textItems.map((item) => item.str).join(' ')}`)
  }

  const structured = normalizeExtractedText(structuredPages.join('\n\n'))
  const simple = normalizeExtractedText(simplePages.join('\n\n'))

  // Prefer structured layout; fall back if chapter markers are missing
  if (hasSectionBMarkers(structured)) {
    return structured
  }
  if (hasSectionBMarkers(simple)) {
    return simple
  }

  return structured.length >= simple.length ? structured : simple
}

/** Extract text page-by-page. Uses OCR for scanned/image-only pages when enabled. */
export async function extractPdfPages(
  data: ArrayBuffer,
  options: ExtractPdfPagesOptions = {}
): Promise<ExtractedPdfPage[]> {
  const { onProgress, ocrIfNeeded = true, textract } = options
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const pages: ExtractedPdfPage[] = []
  const sparsePageNumbers: number[] = []

  onProgress?.(`Reading ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}…`)

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const textItems: { str: string; transform?: number[] }[] = []
    for (const item of textContent.items) {
      if (!('str' in item)) continue
      textItems.push(item as { str: string; transform?: number[] })
    }

    const structured = normalizeExtractedText(extractStructuredLines(textItems))
    const simple = normalizeExtractedText(textItems.map((item) => item.str).join(' '))
    const text = structured.length >= simple.length ? structured : simple

    if (textItems.length < 8 || looksLikePoorScanText(text)) {
      sparsePageNumbers.push(pageNum)
    }

    pages.push({ pageNumber: pageNum, text, usedOcr: false })
  }

  if (ocrIfNeeded && sparsePageNumbers.length > 0) {
    onProgress?.(
      `OCR needed for ${sparsePageNumbers.length} scanned page${sparsePageNumbers.length === 1 ? '' : 's'}…`
    )
    const { ocrPdfPages } = await import('./pdfOcr')
    const ocrResults = await ocrPdfPages(pdf, sparsePageNumbers, onProgress, textract)
    for (const result of ocrResults) {
      const page = pages.find((p) => p.pageNumber === result.pageNumber)
      if (!page) continue
      if (result.text.length > page.text.length || looksLikePoorScanText(page.text)) {
        page.text = result.text
        page.usedOcr = true
      }
    }
  }

  return pages
}

function extractStructuredLines(
  items: { str: string; transform?: number[] }[]
): string {
  const lineBuckets = new Map<number, string[]>()

  for (const item of items) {
    const y = Math.round((item.transform?.[5] ?? 0) / 4) * 4
    const bucket = lineBuckets.get(y) ?? []
    bucket.push(item.str)
    lineBuckets.set(y, bucket)
  }

  const sortedYs = [...lineBuckets.keys()].sort((a, b) => b - a)
  const lines: string[] = []

  for (const y of sortedYs) {
    const line = lineBuckets.get(y)!.join(' ').replace(/\s+/g, ' ').trim()
    if (line) lines.push(line)
  }

  return lines.join('\n')
}

function hasSectionBMarkers(text: string): boolean {
  return (
    /Section\s+B\s*[-–]\s*1\b/i.test(text) ||
    /Section\s+B-1\b/i.test(text)
  )
}

export async function fetchPdfAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  try {
    const proxyResponse = await fetch(buildPdfProxyUrl(url))
    if (proxyResponse.ok) {
      return proxyResponse.arrayBuffer()
    }
  } catch {
    // Proxy unavailable (e.g. static production build) — try direct fetch
  }

  try {
    return await readArrayBufferFromResponse(await fetch(url))
  } catch {
    throw new Error(
      'Browser blocked the PDF download. Use Upload PDF Manually instead — open the official manual link, save DL_Manual.pdf to your computer, then upload it here.'
    )
  }
}

function buildPdfProxyUrl(url: string): string {
  return `${TN_DL_MANUAL_PDF_PROXY}?url=${encodeURIComponent(url)}`
}

async function readArrayBufferFromResponse(response: Response): Promise<ArrayBuffer> {
  if (!response.ok) {
    throw new Error(`Failed to download PDF (${response.status})`)
  }
  return response.arrayBuffer()
}

export async function readPdfFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer()
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}
