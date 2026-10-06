import { describe, expect, it } from 'vitest'
import { cleanPageText } from '../readingDocument'
import { layoutTextLines } from '../pdfLineLayout'

describe('cleanPageText', () => {
  it('flows wrapped lines into paragraphs separated by blank lines', () => {
    expect(
      cleanPageText('---PAGE 1---\nThe rain fell\non the town.\n\nNext came\nthe wind.')
    ).toBe('The rain fell on the town.\n\nNext came the wind.')
  })

  it('dehyphenates only lowercase word breaks', () => {
    expect(cleanPageText('a fine exam-\nple of COVID-\n19 rules')).toBe(
      'a fine example of COVID-19 rules'
    )
  })

  it('reattaches a drop cap laid out as its own line', () => {
    expect(cleanPageText('T\nhe rain fell\non the town.')).toBe('The rain fell on the town.')
  })

  it('keeps bullet items as separate paragraphs', () => {
    expect(cleanPageText('Bring:\n• a pencil\n• an eraser')).toBe(
      'Bring:\n\n• a pencil\n\n• an eraser'
    )
  })

  it('turns native PDF layout gaps into paragraphs end to end', () => {
    const lines: [string, number][] = [
      ['The rain fell', 720],
      ['on the town.', 706],
      ['It was cold.', 692],
      ['Next came', 666],
      ['the wind.', 652],
    ]
    const items = lines.map(([str, y]) => ({ str, transform: [12, 0, 0, 12, 72, y] }))
    expect(cleanPageText(layoutTextLines(items, { paragraphBreaks: true }))).toBe(
      'The rain fell on the town. It was cold.\n\nNext came the wind.'
    )
  })
})
