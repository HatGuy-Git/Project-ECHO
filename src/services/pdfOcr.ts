import type { PDFDocumentProxy } from 'pdfjs-dist'
import { PSM } from 'tesseract.js'
import { cleanOcrText } from './ocrCleanup'
import { detectTextWithTextract } from './textractClient'

export interface OcrPageResult {
  pageNumber: number
  text: string
}

const TARGET_WIDTH = 2000
const MIN_SCALE = 2.5
const MAX_SCALE = 4

export async function ocrPdfPages(
  pdf: PDFDocumentProxy,
  pageNumbers: number[],
  onProgress?: (message: string) => void,
  textract?: boolean
): Promise<OcrPageResult[]> {
  if (textract) {
    return ocrWithTextract(pdf, pageNumbers, onProgress)
  }
  return ocrWithTesseract(pdf, pageNumbers, onProgress)
}

async function ocrWithTextract(
  pdf: PDFDocumentProxy,
  pageNumbers: number[],
  onProgress: ((message: string) => void) | undefined
): Promise<OcrPageResult[]> {
  const results: OcrPageResult[] = []

  for (let i = 0; i < pageNumbers.length; i++) {
    const pageNumber = pageNumbers[i]
    onProgress?.(
      `Textract OCR page ${pageNumber} (${i + 1} of ${pageNumbers.length})…`
    )
    const image = await renderPageJpeg(pdf, pageNumber)
    const recognized = await detectTextWithTextract(image)
    results.push({
      pageNumber,
      text: cleanOcrText(recognized),
    })
  }

  return results
}

async function ocrWithTesseract(
  pdf: PDFDocumentProxy,
  pageNumbers: number[],
  onProgress?: (message: string) => void
): Promise<OcrPageResult[]> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1)
  const results: OcrPageResult[] = []

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
    })

    for (let i = 0; i < pageNumbers.length; i++) {
      const pageNumber = pageNumbers[i]
      onProgress?.(
        `OCR page ${pageNumber} (${i + 1} of ${pageNumbers.length})…`
      )
      const image = await renderPageForOcr(pdf, pageNumber)
      const recognized = await recognizeBest(worker, image)
      results.push({
        pageNumber,
        text: cleanOcrText(recognized),
      })
    }
  } finally {
    await worker.terminate()
  }

  return results
}

async function recognizeBest(
  worker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>,
  image: string
): Promise<string> {
  const first = await worker.recognize(image)
  if ((first.data.confidence ?? 0) >= 62) {
    return first.data.text ?? ''
  }

  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN })
  const second = await worker.recognize(image)
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })

  return (second.data.confidence ?? 0) > (first.data.confidence ?? 0)
    ? second.data.text ?? ''
    : first.data.text ?? ''
}

async function renderPageForOcr(
  pdf: PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  const page = await pdf.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, TARGET_WIDTH / Math.max(base.width, 1))
  )
  const viewport = page.getViewport({ scale })
  const source = document.createElement('canvas')
  const context = source.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('Could not create a canvas for OCR.')
  }

  source.width = Math.ceil(viewport.width)
  source.height = Math.ceil(viewport.height)
  await page.render({ canvasContext: context, viewport, canvas: source }).promise
  return preprocessForOcr(source).toDataURL('image/png')
}

async function renderPageJpeg(
  pdf: PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  const page = await pdf.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, TARGET_WIDTH / Math.max(base.width, 1))
  )
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not create a canvas for OCR.')
  }

  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvasContext: context, viewport, canvas }).promise
  return canvas.toDataURL('image/jpeg', 0.9)
}

/** Contrast-stretch grayscale so photographed pages read more like a scan. */
function preprocessForOcr(source: HTMLCanvasElement): HTMLCanvasElement {
  const width = source.width
  const height = source.height
  const srcCtx = source.getContext('2d', { willReadFrequently: true })
  if (!srcCtx) return source

  const { data } = srcCtx.getImageData(0, 0, width, height)
  const gray = new Uint8Array(width * height)

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
  }

  const { low, high } = percentileBounds(gray, 0.02, 0.98)
  const range = Math.max(1, high - low)
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const outCtx = out.getContext('2d')
  if (!outCtx) return source

  const image = outCtx.createImageData(width, height)
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    const stretched = Math.max(0, Math.min(255, ((gray[p] - low) * 255) / range))
    // Mild threshold toward paper-white / ink-black without crushing italics
    const value = stretched > 210 ? 255 : stretched < 70 ? 0 : stretched
    image.data[i] = value
    image.data[i + 1] = value
    image.data[i + 2] = value
    image.data[i + 3] = 255
  }

  outCtx.putImageData(image, 0, 0)
  return out
}

function percentileBounds(
  values: Uint8Array,
  lowPct: number,
  highPct: number
): { low: number; high: number } {
  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i < values.length; i++) hist[values[i]]++

  const total = values.length
  const lowTarget = total * lowPct
  const highTarget = total * highPct
  let seen = 0
  let low = 0
  let high = 255

  for (let i = 0; i < 256; i++) {
    seen += hist[i]
    if (seen >= lowTarget) {
      low = i
      break
    }
  }

  seen = 0
  for (let i = 255; i >= 0; i--) {
    seen += hist[i]
    if (seen >= total - highTarget) {
      high = i
      break
    }
  }

  if (high - low < 40) {
    return { low: 0, high: 255 }
  }

  return { low, high }
}
