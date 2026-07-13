import type { StudyBlock } from '../../types'
import { countWords } from '../../utils/wordHighlight'
import HighlightedText from './HighlightedText'

interface StudyContentProps {
  blocks: StudyBlock[]
  activeWordIndex: number | null
  theme?: 'tutor'
  onWordClick?: (wordIndex: number) => void
  wordClickEnabled?: boolean
}

export default function StudyContent({
  blocks,
  activeWordIndex,
  theme = 'tutor',
  onWordClick,
  wordClickEnabled = false,
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
          handleWordClick,
          wordClickEnabled
        )

        wordOffset += wordCount
        return <div key={index}>{element}</div>
      })}
    </div>
  )
}

function renderBlock(
  block: StudyBlock,
  speechText: string,
  activeWordIndex: number | null,
  theme: 'tutor',
  onWordClick: ((wordIndex: number) => void) | undefined,
  wordClickEnabled: boolean
) {
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
        <h3 className="font-display text-lg text-sky-300 mt-6 first:mt-0 border-b border-sky-400/20 pb-2">
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
          {block.items?.map((_item, i) => (
            <li key={i} className="flex gap-3 text-base leading-relaxed">
              <span className="text-sky-400 shrink-0 mt-1.5">•</span>
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
          {block.items?.map((_item, i) => (
            <li key={i} className="flex gap-3 text-base leading-relaxed">
              <span className="text-sky-400 font-mono text-sm shrink-0 mt-0.5 w-6">
                {i + 1}.
              </span>
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
