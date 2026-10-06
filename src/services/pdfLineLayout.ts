/** Turn positioned pdf.js text items into lines (and optionally paragraphs). */

export interface PositionedTextItem {
  str: string
  transform?: number[]
}

export interface LayoutTextOptions {
  /** Insert a blank line where the vertical gap between lines is unusually large. */
  paragraphBreaks?: boolean
}

const LINE_BUCKET = 4
// Body text sits at ~1.2x font size line pitch; a paragraph gap is usually at
// least half a line extra (~1.5x+). 1.4 clears jitter from mixed font sizes
// and sub/superscripts while still catching modest "space after" styling.
const PARAGRAPH_GAP_RATIO = 1.4
const MIN_GAPS_FOR_MEDIAN = 3

export function layoutTextLines(
  items: PositionedTextItem[],
  options: LayoutTextOptions = {}
): string {
  const buckets = new Map<number, { y: number; parts: string[] }>()

  for (const item of items) {
    const rawY = item.transform?.[5] ?? 0
    const key = Math.round(rawY / LINE_BUCKET) * LINE_BUCKET
    const bucket = buckets.get(key) ?? { y: rawY, parts: [] }
    bucket.parts.push(item.str)
    buckets.set(key, bucket)
  }

  const lines = [...buckets.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, bucket]) => ({
      y: bucket.y,
      text: bucket.parts.join(' ').replace(/\s+/g, ' ').trim(),
    }))
    .filter((line) => line.text)

  if (lines.length === 0) return ''

  const gaps = lines.slice(1).map((line, i) => lines[i].y - line.y)
  const median = medianOf(gaps)
  const splitParagraphs =
    options.paragraphBreaks === true && gaps.length >= MIN_GAPS_FOR_MEDIAN && median > 0

  let text = lines[0].text
  for (let i = 1; i < lines.length; i++) {
    const separator =
      splitParagraphs && gaps[i - 1] > median * PARAGRAPH_GAP_RATIO ? '\n\n' : '\n'
    text += separator + lines[i].text
  }
  return text
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}
