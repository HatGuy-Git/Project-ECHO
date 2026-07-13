import type { StudySection } from '../types'
import { SECTION_B_CHAPTERS } from '../constants/tennesseeDriver'
import { storage } from './storage'
import { extractSectionBText, splitSectionBChapters } from './sectionBExtractor'
import { splitChapterIntoSubsections } from './subsectionSplitter'
import {
  blocksToPreview,
  blocksToSpeechText,
  parseChapterIntoBlocks,
} from './studyContentParser'

export interface CurateDriverManualOptions {
  onProgress?: (message: string) => void
}

export interface CurateDriverManualResult {
  sections: StudySection[]
  aiCurated: boolean
}

/**
 * Comprehensive Section B extraction:
 * 1. Read full PDF text (caller provides rawText)
 * 2. Isolate Section B
 * 3. Split into 8 chapters using body markers (not TOC)
 * 4. Split each chapter into subsections — full text preserved
 */
export async function curateDriverManualText(
  rawText: string,
  options: CurateDriverManualOptions = {}
): Promise<CurateDriverManualResult> {
  const { onProgress } = options

  onProgress?.('Reading full manual text…')
  onProgress?.('Locating Section B (written test content)…')
  const sectionBText = extractSectionBText(rawText)

  onProgress?.('Splitting Section B into chapters…')
  const rawChapters = splitSectionBChapters(sectionBText)

  if (rawChapters.length === 0) {
    throw new Error(
      'No Section B study chapters found. Ensure you uploaded the official Tennessee Driver License Manual.'
    )
  }

  onProgress?.('Organizing subsections and formatting…')
  const sections = buildComprehensiveSections(rawChapters)

  if (sections.length === 0) {
    throw new Error('No study content extracted from Section B.')
  }

  onProgress?.(`Prepared ${sections.length} study sections from Section B.`)

  return { sections, aiCurated: false }
}

function buildComprehensiveSections(
  rawChapters: ReturnType<typeof splitSectionBChapters>
): StudySection[] {
  const sections: StudySection[] = []
  let order = 0

  for (const chapter of rawChapters.sort((a, b) => a.number - b.number)) {
    const meta = SECTION_B_CHAPTERS.find((c) => c.number === chapter.number)
    const chapterTitle = meta?.title ?? chapter.title
    const testFocus = meta?.testFocus ?? chapterTitle

    const subsections = splitChapterIntoSubsections(chapterTitle, chapter.body)

    for (let subIndex = 0; subIndex < subsections.length; subIndex++) {
      const sub = subsections[subIndex]
      const blocks = parseChapterIntoBlocks(sub.body)
      const content = blocksToSpeechText(blocks)

      if (content.length < 80) continue

      const isMultiPart = subsections.length > 1
      const displayTitle = isMultiPart ? sub.title : chapterTitle

      sections.push({
        id: storage.generateId(),
        title: displayTitle,
        sectionLabel: isMultiPart
          ? `Section B · Ch ${chapter.number} · ${sub.title}`
          : `Section B · Chapter ${chapter.number}`,
        chapterNumber: chapter.number,
        chapterTitle,
        subsectionTitle: isMultiPart ? sub.title : undefined,
        subsectionIndex: isMultiPart ? subIndex : undefined,
        testFocus,
        content,
        blocks,
        order: order++,
      })
    }
  }

  return sections
}

/** Short preview for section list cards */
export function sectionPreview(section: StudySection): string {
  if (section.blocks?.length) {
    return blocksToPreview(section.blocks)
  }
  const words = section.content.split(/\s+/).filter(Boolean)
  if (words.length <= 24) return section.content
  return words.slice(0, 24).join(' ') + '…'
}
