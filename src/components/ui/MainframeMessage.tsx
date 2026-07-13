import { useApp } from '../../context/AppContext'
import { useCharacterMessage } from '../../hooks/useCharacterMessage'
import HighlightedText from './HighlightedText'

interface MainframeMessageProps {
  message: string
  showTyping?: boolean
  speakOnType?: boolean
  hideText?: boolean
  onComplete?: () => void
}

export default function MainframeMessage({
  message,
  showTyping = true,
  speakOnType = false,
  hideText = false,
  onComplete,
}: MainframeMessageProps) {
  const { state } = useApp()

  const { isLoading, isSpeaking, activeWordIndex, showPlainText } = useCharacterMessage({
    message,
    character: 'mainframe',
    speakOnType,
    showTyping,
    elevenLabsApiKey: state.apiKeys.elevenLabs,
    apiKeys: state.apiKeys,
    onComplete,
  })

  if (hideText) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className={`w-16 h-16 rounded-lg bg-mainframe/20 border-2 border-mainframe/50 flex items-center justify-center ${
          isSpeaking ? 'ring-4 ring-mainframe/50 scale-110' : ''
        }`}>
          <span className="text-3xl">🖥️</span>
        </div>
        {(isSpeaking || isLoading) && (
          <div className="ml-4 flex items-center gap-2">
            <span className="text-mainframe font-semibold">MAINFRAME</span>
            {isLoading && (
              <span className="text-sm text-mainframe/70">Establishing secure channel...</span>
            )}
            {isSpeaking && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-1 h-4 bg-mainframe animate-sound-wave" style={{ animationDelay: '0ms' }} />
                <span className="inline-block w-1 h-6 bg-mainframe animate-sound-wave" style={{ animationDelay: '150ms' }} />
                <span className="inline-block w-1 h-3 bg-mainframe animate-sound-wave" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex gap-4 items-start p-4 bg-void-light/50 border border-mainframe/30 rounded-lg">
      <div className={`flex-shrink-0 w-12 h-12 rounded-lg bg-mainframe/20 border border-mainframe/50 flex items-center justify-center ${
        isSpeaking ? 'ring-2 ring-mainframe/50' : ''
      }`}>
        <span className="text-2xl">🖥️</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-mainframe font-semibold text-sm mb-1 flex items-center gap-2 min-h-[1.25rem]">
          MAINFRAME
          <span className="inline-block w-2 h-2 rounded-full bg-mainframe" />
          {isLoading && (
            <span className="text-xs font-normal text-mainframe/70">
              Establishing secure channel...
            </span>
          )}
          {isSpeaking && (
            <span className="text-xs font-normal text-mainframe/70 flex items-center gap-1">
              <span className="inline-block w-1 h-3 bg-mainframe animate-sound-wave" style={{ animationDelay: '0ms' }} />
              <span className="inline-block w-1 h-4 bg-mainframe animate-sound-wave" style={{ animationDelay: '150ms' }} />
              <span className="inline-block w-1 h-2 bg-mainframe animate-sound-wave" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </div>
        <p className="text-gray-200 text-lg leading-relaxed min-h-[1.75rem]">
          {showPlainText ? (
            message
          ) : (
            <HighlightedText
              message={message}
              activeWordIndex={activeWordIndex}
              theme="mainframe"
            />
          )}
        </p>
      </div>
    </div>
  )
}
