import type { DriverManualData, StudySection } from '../types'

/** Ensure saved manuals from older app versions don't crash the UI */
export function normalizeStudySection(
  section: StudySection,
  index: number
): StudySection {
  return {
    ...section,
    blocks: section.blocks ?? [],
    sectionLabel: section.sectionLabel ?? `Chapter ${index + 1}`,
    chapterNumber: section.chapterNumber ?? index + 1,
    chapterTitle: section.chapterTitle,
    subsectionTitle: section.subsectionTitle,
    subsectionIndex: section.subsectionIndex,
    testFocus: section.testFocus ?? '',
    content: section.content ?? '',
    title: section.title ?? `Section ${index + 1}`,
  }
}

export function normalizeDriverManual(manual: DriverManualData): DriverManualData {
  const sections = (manual.sections ?? []).map(normalizeStudySection)
  const maxIndex = Math.max(0, sections.length - 1)
  const currentSectionIndex = Math.min(
    Math.max(0, manual.currentSectionIndex ?? 0),
    maxIndex
  )

  return {
    ...manual,
    sections,
    currentSectionIndex,
    curatorVersion: manual.curatorVersion ?? 1,
  }
}
