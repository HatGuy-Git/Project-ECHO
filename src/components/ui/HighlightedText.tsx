import { useMemo } from 'react'
import { tokenizeMessage } from '../../utils/wordHighlight'

interface HighlightedTextProps {
  message: string
  activeWordIndex: number | null
  theme: 'mainframe' | 'glitch' | 'tutor'
  italic?: boolean
  onWordClick?: (wordIndex: number) => void
  wordClickEnabled?: boolean
}

export default function HighlightedText({
  message,
  activeWordIndex,
  theme,
  italic = false,
  onWordClick,
  wordClickEnabled = false,
}: HighlightedTextProps) {
  const tokens = useMemo(() => tokenizeMessage(message), [message])

  const activeHighlightClass =
    theme === 'mainframe'
      ? 'bg-mainframe/30 text-mainframe font-semibold rounded-sm px-0.5 box-decoration-clone'
      : theme === 'glitch'
      ? 'bg-glitch/30 text-glitch font-semibold rounded-sm px-0.5 box-decoration-clone'
      : 'bg-sky-400/25 text-sky-300 font-semibold rounded-sm px-0.5 box-decoration-clone'

  let wordIndex = 0

  return (
    <span className={italic ? 'italic' : undefined}>
      {tokens.map((token, index) => {
        if (!token.isWord) {
          return <span key={index}>{token.text}</span>
        }

        const currentWordIndex = wordIndex
        wordIndex++
        const isActive = activeWordIndex === currentWordIndex
        const isClickable = wordClickEnabled && onWordClick

        return (
          <span
            key={index}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={isClickable ? () => onWordClick(currentWordIndex) : undefined}
            onKeyDown={
              isClickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onWordClick(currentWordIndex)
                    }
                  }
                : undefined
            }
            className={`transition-colors duration-100 ${
              isActive ? activeHighlightClass : 'text-gray-200'
            } ${isClickable ? 'cursor-pointer hover:text-sky-200' : ''}`}
          >
            {token.text}
          </span>
        )
      })}
    </span>
  )
}
