import { describe, expect, it } from 'vitest'
import { layoutTextLines, type PositionedTextItem } from '../pdfLineLayout'

const SIZE = 12

function item(str: string, y: number, x = 72): PositionedTextItem {
  return { str, transform: [SIZE, 0, 0, SIZE, x, y] }
}

/** Lines laid out top-down from y=720 with the given gap before each line. */
function linesAt(texts: string[], gapsBefore: number[]): PositionedTextItem[] {
  let y = 720
  return texts.map((text, i) => {
    if (i > 0) y -= gapsBefore[i]
    return item(text, y)
  })
}

const TEXTS = ['Line one', 'Line two', 'Line three', 'Line four', 'Line five', 'Line six']

describe('layoutTextLines', () => {
  it('joins items on the same baseline and orders lines top to bottom', () => {
    const items = [item('second', 700), item('Hello', 720), item('world', 720.6, 120)]
    expect(layoutTextLines(items)).toBe('Hello world\nsecond')
  })

  it('inserts a paragraph break at a large vertical gap', () => {
    const items = linesAt(TEXTS, [0, 14, 14, 26, 14, 14])
    expect(layoutTextLines(items, { paragraphBreaks: true })).toBe(
      'Line one\nLine two\nLine three\n\nLine four\nLine five\nLine six'
    )
  })

  it('inserts no breaks for uniform spacing', () => {
    const items = linesAt(TEXTS, [0, 14, 14, 14, 14, 14])
    expect(layoutTextLines(items, { paragraphBreaks: true })).toBe(TEXTS.join('\n'))
  })

  it('measures gaps from real positions, not rounded buckets', () => {
    // 14.4pt leading rounds to alternating 12/16 buckets; must not look like breaks.
    const items = linesAt(TEXTS, [0, 14.4, 14.4, 14.4, 14.4, 14.4])
    expect(layoutTextLines(items, { paragraphBreaks: true })).toBe(TEXTS.join('\n'))
  })

  it('does not split paragraphs when there are too few lines for a median', () => {
    const items = linesAt(TEXTS.slice(0, 3), [0, 14, 40])
    expect(layoutTextLines(items, { paragraphBreaks: true })).toBe(
      'Line one\nLine two\nLine three'
    )
  })

  it('keeps single newlines when paragraph breaks are off', () => {
    const items = linesAt(TEXTS, [0, 14, 14, 26, 14, 14])
    expect(layoutTextLines(items)).toBe(TEXTS.join('\n'))
  })
})
