import { describe, expect, it } from 'vitest'
import type { StudyBlock } from '../../types'
import { parseChapterIntoBlocks, splitTextIntoBlocks } from '../studyContentParser'
import { countWords, tokenizeMessage } from '../../utils/wordHighlight'

function words(text: string): string[] {
  return tokenizeMessage(text)
    .filter((token) => token.isWord)
    .map((token) => token.text)
}

// Mirrors how StudyContent derives each block's highlight text.
function renderedWords(blocks: StudyBlock[]): string[] {
  return blocks.flatMap((block) =>
    words(block.items && block.items.length > 0 ? block.items.join(' ') : block.text)
  )
}

const READING_SAMPLES = [
  'One single paragraph with no breaks at all.',
  `Chapter One

It was a bright cold day in April , and the clocks were striking thirteen.

Winston Smith slipped quickly through the glass doors.`,
  `Things you need

• A pencil
• Two erasers , please
• Paper

Steps to follow:

1. Read the question.
2) Underline key words.
3. Answer in full sentences.

- dash item one
- dash item two

Afterword
The end — almost.`,
  `  Leading spaces and   odd   spacing

\n\n\nExtra blank lines between paragraphs.\n\n\n`,
  `1. A paragraph that starts with a number but keeps going for a while.

2. Another one, which merges into the same numbered list.

Normal text resumes here.`,
]

describe('splitTextIntoBlocks', () => {
  it('classifies paragraphs, lists and subheadings', () => {
    const blocks = splitTextIntoBlocks(
      'Safety Rules\n\nAlways look both ways.\n\n• Stop\n• Look\n\n1. First\n2. Second'
    )
    expect(blocks).toEqual([
      { type: 'subheading', text: 'Safety Rules' },
      { type: 'paragraph', text: 'Always look both ways.' },
      { type: 'bullet', text: '', items: ['Stop', 'Look'] },
      { type: 'numbered', text: '', items: ['First', 'Second'] },
    ])
  })

  it('never applies Tennessee-specific classifiers or merges paragraphs', () => {
    const blocks = splitTextIntoBlocks(
      'Tennessee law says so.\n\nDO NOT do that.\n\nRemember this.'
    )
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'paragraph', 'paragraph'])
  })

  it('keeps list markers when asked', () => {
    const blocks = splitTextIntoBlocks('• Stop\n• Look\n\n1. First\n2) Second', {
      keepMarkers: true,
    })
    expect(blocks).toEqual([
      { type: 'bullet', text: '', items: ['• Stop', '• Look'] },
      { type: 'numbered', text: '', items: ['1. First', '2) Second'] },
    ])
  })

  it.each(READING_SAMPLES.map((sample, i) => [i, sample] as const))(
    'keeps word count and order aligned with the narrated text (sample %i)',
    (_i, content) => {
      const blocks = splitTextIntoBlocks(content, { keepMarkers: true })
      const total = blocks.reduce(
        (sum, block) =>
          sum + countWords(block.items?.length ? block.items.join(' ') : block.text),
        0
      )
      expect(total).toBe(countWords(content))
      expect(renderedWords(blocks)).toEqual(words(content))
    }
  )
})

const SAMPLE_CHAPTER = `Traffic Signals

A steady red light means stop. You must come to a complete stop at the marked stop line .

You may turn right on red after stopping , unless a sign prohibits it.

• Yield to pedestrians in the crosswalk
• Yield to vehicles already in the intersection

- Check mirrors
- Signal early

1. Stop at the line.
2. Look left, right, then left again.

Tennessee law requires all passengers to wear seat belts.

DO NOT pass a stopped school bus with its red lights flashing.

Remember to signal at least 50 feet before turning.

Applicants must answer 24 correct out of 30 questions.

Speed Limits

Drive at a speed that is safe for conditions.
Even if the posted limit is higher.`

describe('parseChapterIntoBlocks', () => {
  it('produces the same driver blocks as before the generic splitter refactor', () => {
    expect(parseChapterIntoBlocks(SAMPLE_CHAPTER)).toMatchSnapshot()
  })
})
