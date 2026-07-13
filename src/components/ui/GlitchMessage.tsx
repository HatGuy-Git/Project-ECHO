import { useApp } from '../../context/AppContext'
import { useCharacterMessage } from '../../hooks/useCharacterMessage'
import HighlightedText from './HighlightedText'

interface GlitchMessageProps {
  message: string
  showTyping?: boolean
  speakOnType?: boolean
  onComplete?: () => void
}

export default function GlitchMessage({
  message,
  showTyping = true,
  speakOnType = false,
  onComplete,
}: GlitchMessageProps) {
  const { state } = useApp()

  const { isLoading, isSpeaking, activeWordIndex, showPlainText } = useCharacterMessage({
    message,
    character: 'glitch',
    speakOnType,
    showTyping,
    elevenLabsApiKey: state.apiKeys.elevenLabs,
    apiKeys: state.apiKeys,
    onComplete,
  })

  return (
    <div className="flex gap-4 items-start p-4 bg-glitch/5 border border-glitch/30 rounded-lg">
      <div className={`flex-shrink-0 w-12 h-12 rounded-lg bg-glitch/20 border border-glitch/50 flex items-center justify-center ${
        isSpeaking ? 'ring-2 ring-glitch/50' : ''
      }`}>
        <span className="text-2xl">⚡</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-glitch font-semibold text-sm mb-1 flex items-center gap-2 min-h-[1.25rem]">
          DR. GLITCH
          <span className="inline-block w-2 h-2 rounded-full bg-glitch" />
          {isLoading && (
            <span className="text-xs font-normal text-glitch/70">
              Intercepting signal...
            </span>
          )}
          {isSpeaking && (
            <span className="text-xs font-normal text-glitch/70 flex items-center gap-1">
              <span className="inline-block w-1 h-3 bg-glitch animate-sound-wave" style={{ animationDelay: '0ms' }} />
              <span className="inline-block w-1 h-4 bg-glitch animate-sound-wave" style={{ animationDelay: '150ms' }} />
              <span className="inline-block w-1 h-2 bg-glitch animate-sound-wave" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </div>
        <p className="text-gray-200 text-lg leading-relaxed italic min-h-[1.75rem]">
          {showPlainText ? (
            message
          ) : (
            <HighlightedText
              message={message}
              activeWordIndex={activeWordIndex}
              theme="glitch"
              italic
            />
          )}
        </p>
      </div>
    </div>
  )
}
