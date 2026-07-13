import type { Screen } from '../../App'
import type { DriverManualData, StudySection } from '../../types'
import { sectionPreview } from '../../services/driverManualCurator'
import { DRIVER_MANUAL_CURATOR_VERSION } from '../../constants/tennesseeDriver'

interface SectionListProps {
  manual: DriverManualData
  onSelectSection: (index: number) => void
  onBack: () => void
  onReset: () => void
  onNavigate: (screen: Screen) => void
}

interface ChapterGroup {
  chapterNumber: number
  chapterTitle: string
  testFocus: string
  sections: { section: StudySection; index: number }[]
}

function groupSectionsByChapter(manual: DriverManualData): ChapterGroup[] {
  const groups = new Map<number, ChapterGroup>()

  manual.sections.forEach((section, index) => {
    const chapterNumber = section.chapterNumber ?? index + 1
    const existing = groups.get(chapterNumber)

    if (existing) {
      existing.sections.push({ section, index })
      return
    }

    groups.set(chapterNumber, {
      chapterNumber,
      chapterTitle: section.chapterTitle ?? section.title,
      testFocus: section.testFocus ?? '',
      sections: [{ section, index }],
    })
  })

  return [...groups.values()].sort((a, b) => a.chapterNumber - b.chapterNumber)
}

export default function SectionList({
  manual,
  onSelectSection,
  onBack,
  onReset,
  onNavigate,
}: SectionListProps) {
  const isStale =
    (manual.curatorVersion ?? 1) < DRIVER_MANUAL_CURATOR_VERSION
  const chapterGroups = groupSectionsByChapter(manual)

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto mb-6">
        <button
          onClick={onBack}
          className="text-sky-300 hover:text-sky-200 transition-colors mb-4 flex items-center gap-2"
        >
          <span>←</span>
          <span>Back to Modules</span>
        </button>
        <h1 className="font-display text-3xl text-sky-300 mb-2">Written Test Study Guide</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          Full Section B content from the official manual — {manual.sections.length} study
          sections across {chapterGroups.length} chapters. Administrative sections, practice
          answer keys, and supplemental Section C material are excluded.
        </p>
      </header>

      {isStale && (
        <div className="max-w-2xl mx-auto mb-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
          A newer study guide format is available. Tap <strong>Reload Manual</strong> to
          re-extract the full Section B content.
        </div>
      )}

      <main className="max-w-2xl mx-auto space-y-6">
        {chapterGroups.map((group) => (
          <section key={group.chapterNumber}>
            <div className="mb-2 px-1">
              <p className="text-sky-400/60 font-mono text-xs mb-1">
                Section B · Chapter {group.chapterNumber}
              </p>
              <h2 className="text-gray-100 font-semibold">{group.chapterTitle}</h2>
              {group.testFocus && (
                <p className="text-sky-400/70 text-xs mt-1">{group.testFocus}</p>
              )}
            </div>

            <div className="space-y-2">
              {group.sections.map(({ section, index }) => {
                const isSubsection = group.sections.length > 1

                return (
                  <button
                    key={section.id}
                    onClick={() => onSelectSection(index)}
                    className="card w-full text-left p-4 hover:border-sky-400/40 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-sky-400 font-mono text-sm mt-1 shrink-0 w-8">
                        B-{group.chapterNumber}
                        {isSubsection && section.subsectionIndex !== undefined
                          ? `.${section.subsectionIndex + 1}`
                          : ''}
                      </span>
                      <div className="min-w-0 flex-1">
                        {isSubsection && (
                          <p className="text-sky-400/60 font-mono text-xs mb-1">
                            {section.sectionLabel ?? section.title}
                          </p>
                        )}
                        <h3 className="text-gray-100 font-semibold mb-1">
                          {isSubsection ? section.title : group.chapterTitle}
                        </h3>
                        <p className="text-gray-500 text-xs line-clamp-2">
                          {sectionPreview(section)}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ))}

        <div className="flex gap-3 pt-4">
          <button onClick={() => onNavigate('settings')} className="btn btn-glitch flex-1">
            ⚙️ Settings
          </button>
          <button onClick={onReset} className="btn flex-1 border-gray-600 text-gray-400">
            Reload Manual
          </button>
        </div>
      </main>
    </div>
  )
}
