import * as pdfjsLib from 'pdfjs-dist'
import { TN_DL_MANUAL_PDF_PROXY } from '../constants/tennesseeDriver'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

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
