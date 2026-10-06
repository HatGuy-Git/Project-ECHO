import { describe, expect, it } from 'vitest'
import {
  cleanOcrText,
  looksLikePoorScanText,
  reattachDropCaps,
  stripHeadersAndFooters,
} from '../ocrCleanup'

const paragraphs = (text: string) => text.split('\n\n')

describe('drop caps', () => {
  it('reattaches a drop cap on its own line', () => {
    expect(cleanOcrText('T\nhe rain fell on the quiet town all night long.')).toBe(
      'The rain fell on the quiet town all night long.'
    )
  })

  it('reattaches a drop cap separated by a blank line', () => {
    expect(cleanOcrText('W\n\nhen the bell rang, everyone ran outside.')).toBe(
      'When the bell rang, everyone ran outside.'
    )
  })

  it('reattaches a drop cap split off on the same line', () => {
    expect(cleanOcrText('T he rain fell on the quiet town all night long.')).toBe(
      'The rain fell on the quiet town all night long.'
    )
  })

  it('reattaches a quoted drop cap', () => {
    expect(cleanOcrText('“T\nhe end,” she said quietly to the room.')).toBe(
      '"The end," she said quietly to the room.'
    )
  })

  it('reattaches split "I" and "A" drop caps that form common words', () => {
    expect(cleanOcrText('I t was a bright cold day in April.')).toBe(
      'It was a bright cold day in April.'
    )
    expect(cleanOcrText('A fter the storm, the river rose quickly.')).toBe(
      'After the storm, the river rose quickly.'
    )
  })

  it('does not mangle real single-letter words', () => {
    expect(cleanOcrText('I am here.')).toBe('I am here.')
    expect(cleanOcrText('A dog ran.')).toBe('A dog ran.')
    expect(cleanOcrText('O ye of little faith.')).toBe('O ye of little faith.')
    expect(reattachDropCaps(['I', 'am going home now, she said.'])).toEqual([
      'I',
      'am going home now, she said.',
    ])
  })

  it('does not merge a lone letter used as a label', () => {
    expect(cleanOcrText('B and C are the two options we have left.')).toBe(
      'B and C are the two options we have left.'
    )
  })

  it('only merges same-line splits at a paragraph start', () => {
    const lines = ['He picked the letter', 'X marks the spot on the map.']
    expect(reattachDropCaps(lines)).toEqual(lines)
  })

  it('leaves a lone capital alone when the next line starts uppercase', () => {
    expect(reattachDropCaps(['T', 'The rain'])).toEqual(['T', 'The rain'])
  })
})

describe('paragraph breaks', () => {
  it('treats a blank line as a paragraph break', () => {
    const text = cleanOcrText(
      'The first paragraph is short and ends here\n\nThe second paragraph starts after a blank line.'
    )
    expect(paragraphs(text)).toEqual([
      'The first paragraph is short and ends here',
      'The second paragraph starts after a blank line.',
    ])
  })

  it('ignores a blank line that falls mid-sentence', () => {
    expect(cleanOcrText('The river ran past the old\n\nmill and into the valley.')).toBe(
      'The river ran past the old mill and into the valley.'
    )
  })

  it('keeps two sentences wrapped across full-width lines in one paragraph', () => {
    const raw = [
      'The committee met on Tuesday to review the budget for the coming year.',
      'After a long debate, the members agreed to postpone the final vote on it.',
      'More figures would be available to everyone involved by the next month.',
      'Nobody objected, and the chair closed the meeting a little after nine.',
    ].join('\n')
    expect(paragraphs(cleanOcrText(raw))).toHaveLength(1)
  })

  it('still breaks after a short sentence-ending line with no blank line', () => {
    const raw = [
      'The committee met on Tuesday to review the budget for the coming year',
      'and, after a long debate, the members agreed to postpone the final vote',
      'until next month.',
      'The following morning the treasurer resigned without any explanation',
      'and left the town before anyone could ask her a single question about it.',
    ].join('\n')
    expect(paragraphs(cleanOcrText(raw))).toEqual([
      'The committee met on Tuesday to review the budget for the coming year and, after a long debate, the members agreed to postpone the final vote until next month.',
      'The following morning the treasurer resigned without any explanation and left the town before anyone could ask her a single question about it.',
    ])
  })

  it('does not guess breaks from punctuation when there are too few lines', () => {
    expect(paragraphs(cleanOcrText('It rained.\nThe end.'))).toHaveLength(1)
  })

  it('keeps headings as their own paragraph', () => {
    const text = cleanOcrText('CHAPTER ONE\nThe story begins on a cold morning in late autumn.')
    expect(paragraphs(text)).toEqual([
      'CHAPTER ONE',
      'The story begins on a cold morning in late autumn.',
    ])
  })
})

describe('hyphenation', () => {
  it('joins a word split by a hyphen', () => {
    expect(cleanOcrText('Scientists use many meth-\nods to study the ocean floor.')).toBe(
      'Scientists use many methods to study the ocean floor.'
    )
  })

  it('joins a hyphen that OCR read as a period', () => {
    expect(cleanOcrText('Scientists use many meth.\nods to study the ocean floor.')).toBe(
      'Scientists use many methods to study the ocean floor.'
    )
  })
})

describe('stripHeadersAndFooters', () => {
  it('strips repeated running headers and page numbers', () => {
    const body = (n: number) =>
      `This is the body text of page ${n}, which talks about many different things.`
    const pages = [1, 2, 3].map((n) => ({
      text: `The Long Road Home\n\n${body(n)}\n\n${n + 10}`,
    }))
    expect(stripHeadersAndFooters(pages).map((page) => page.text)).toEqual([
      body(1),
      body(2),
      body(3),
    ])
  })
})

describe('looksLikePoorScanText', () => {
  it('flags text with fused words', () => {
    const fused =
      'Theschoolboardmetonmonday to discuss the newBudget and theyAgreed on several items for next year including funding for the library and the gym.'
    expect(looksLikePoorScanText(fused)).toBe(true)
  })

  it('accepts clean prose', () => {
    const clean =
      'The school board met on Monday to discuss the new budget, and they agreed on several items for next year, including funding for the library and the gym.'
    expect(looksLikePoorScanText(clean)).toBe(false)
  })
})
