import type { StudyBlock } from '../../types'
import { BULLET_PATTERN, NUMBERED_PATTERN } from '../../services/studyContentParser'
import { countWords } from '../../utils/wordHighlight'
import HighlightedText from './HighlightedText'

type Accent = 'sky' | 'amber'

interface StudyContentProps {
  blocks: StudyBlock[]
  activeWordIndex: number | null
  theme?: 'tutor'
  accent?: Accent
  onWordClick?: (wordIndex: number) => void
  wordClickEnabled?: boolean
  onExplainBlock?: (text: string) => void
}

const ACCENT_CLASSES: Record<Accent, { heading: string; marker: string; explain: string }> = {
  sky: {
    heading: 'text-sky-300 border-sky-400/20',
    marker: 'text-sky-400',
    explain: 'hover:text-sky-300 hover:bg-sky-400/10 focus-visible:ring-sky-400/60',
  },
  amber: {
    heading: 'text-amber-300 border-amber-400/20',
    marker: 'text-amber-400',
    explain: 'hover:text-amber-300 hover:bg-amber-400/10 focus-visible:ring-amber-400/60',
  },
}

const EXPLAINABLE_TYPES = new Set<StudyBlock['type']>([
  'paragraph',
  'bullet',
  'numbered',
  'law',
  'warning',
  'keyPoint',
])

export default function StudyContent({
  blocks,
  activeWordIndex,
  theme = 'tutor',
  accent = 'sky',
  onWordClick,
  wordClickEnabled = false,
  onExplainBlock,
}: StudyContentProps) {
  let wordOffset = 0

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const text =
          block.items && block.items.length > 0
            ? block.items.join(' ')
            : block.text
        const wordCount = countWords(text)

        const localActiveIndex =
          activeWordIndex !== null &&
          activeWordIndex >= wordOffset &&
          activeWordIndex < wordOffset + wordCount
            ? activeWordIndex - wordOffset
            : null

        const handleWordClick = onWordClick
          ? (localIndex: number) => onWordClick(wordOffset + localIndex)
          : undefined

        const element = renderBlock(
          block,
          text,
          localActiveIndex,
          theme,
          accent,
          handleWordClick,
          wordClickEnabled
        )

        wordOffset += wordCount

        if (!onExplainBlock || !EXPLAINABLE_TYPES.has(block.type)) {
          return <div key={index}>{element}</div>
        }

        const explainText = block.items?.length ? block.items.join('\n') : block.text
        return (
          <div key={index} className="flex items-end gap-2">
            <div className="flex-1 min-w-0">{element}</div>
            <ExplainButton accent={accent} onClick={() => onExplainBlock(explainText)} />
          </div>
        )
      })}
    </div>
  )
}

function renderBlock(
  block: StudyBlock,
  speechText: string,
  activeWordIndex: number | null,
  theme: 'tutor',
  accent: Accent,
  onWordClick: ((wordIndex: number) => void) | undefined,
  wordClickEnabled: boolean
) {
  const colors = ACCENT_CLASSES[accent]
  const highlight = (
    <HighlightedText
      message={speechText}
      activeWordIndex={activeWordIndex}
      theme={theme}
      onWordClick={onWordClick}
      wordClickEnabled={wordClickEnabled}
    />
  )

  switch (block.type) {
    case 'subheading':
      return (
        <h3 className={`font-display text-lg mt-6 first:mt-0 border-b pb-2 ${colors.heading}`}>
          {highlight}
        </h3>
      )

    case 'law':
      return (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-xs font-mono uppercase tracking-wide text-amber-400/90 mb-2">
            Tennessee Law
          </p>
          <p className="text-base leading-relaxed">{highlight}</p>
        </div>
      )

    case 'warning':
      return (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3">
          <p className="text-xs font-mono uppercase tracking-wide text-danger/90 mb-2">
            Important Warning
          </p>
          <p className="text-base leading-relaxed">{highlight}</p>
        </div>
      )

    case 'keyPoint':
      return (
        <div className="rounded-lg border border-sky-400/25 bg-sky-400/5 px-4 py-3">
          <p className="text-xs font-mono uppercase tracking-wide text-sky-400/80 mb-2">
            Key Point
          </p>
          <p className="text-base leading-relaxed">{highlight}</p>
        </div>
      )

    case 'bullet':
      return (
        <ul className="space-y-2 pl-1">
          {block.items?.map((item, i) => (
            <li key={i} className="flex gap-3 text-base leading-relaxed">
              {!BULLET_PATTERN.test(item) && (
                <span className={`shrink-0 mt-1.5 ${colors.marker}`}>•</span>
              )}
              <span className="flex-1">
                <BlockItemHighlight
                  items={block.items!}
                  itemIndex={i}
                  activeWordIndex={activeWordIndex}
                  theme={theme}
                  onWordClick={onWordClick}
                  wordClickEnabled={wordClickEnabled}
                />
              </span>
            </li>
          ))}
        </ul>
      )

    case 'numbered':
      return (
        <ol className="space-y-2 pl-1 list-none counter-reset-none">
          {block.items?.map((item, i) => (
            <li key={i} className="flex gap-3 text-base leading-relaxed">
              {!NUMBERED_PATTERN.test(item) && (
                <span className={`font-mono text-sm shrink-0 mt-0.5 w-6 ${colors.marker}`}>
                  {i + 1}.
                </span>
              )}
              <span className="flex-1">
                <BlockItemHighlight
                  items={block.items!}
                  itemIndex={i}
                  activeWordIndex={activeWordIndex}
                  theme={theme}
                  onWordClick={onWordClick}
                  wordClickEnabled={wordClickEnabled}
                />
              </span>
            </li>
          ))}
        </ol>
      )

    default:
      return <p className="text-base leading-relaxed text-gray-200">{highlight}</p>
  }
}

/** Highlight a single list item with correct word offset within the joined speech text */
function BlockItemHighlight({
  items,
  itemIndex,
  activeWordIndex,
  theme,
  onWordClick,
  wordClickEnabled,
}: {
  items: string[]
  itemIndex: number
  activeWordIndex: number | null
  theme: 'tutor'
  onWordClick?: (wordIndex: number) => void
  wordClickEnabled: boolean
}) {
  let offset = 0
  for (let i = 0; i < itemIndex; i++) {
    offset += countWords(items[i])
  }

  const itemText = items[itemIndex]
  const itemWordCount = countWords(itemText)
  const localActive =
    activeWordIndex !== null &&
    activeWordIndex >= offset &&
    activeWordIndex < offset + itemWordCount
      ? activeWordIndex - offset
      : null

  return (
    <HighlightedText
      message={itemText}
      activeWordIndex={localActive}
      theme={theme}
      onWordClick={
        onWordClick ? (local) => onWordClick(offset + local) : undefined
      }
      wordClickEnabled={wordClickEnabled}
    />
  )
}

function ExplainButton({ accent, onClick }: { accent: Accent; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Explain simpler"
      aria-label="Explain this paragraph simpler"
      className={`shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-full text-gray-500 transition-colors focus:outline-none focus-visible:ring-2 ${ACCENT_CLASSES[accent].explain}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
      </svg>
    </button>
  )
}
