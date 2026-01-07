import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { speakAsCharacter, stopSpeech, hasSpokenMessage, markMessageSpoken } from '../../services/textToSpeech'

interface GlitchMessageProps {
  message: string
  showTyping?: boolean
  speakOnType?: boolean // Whether to speak the message with TTS
  onComplete?: () => void
}

export default function GlitchMessage({ 
  message, 
  showTyping = true,
  speakOnType = false,
  onComplete 
}: GlitchMessageProps) {
  const { state } = useApp()
  
  // Create a stable ID for this message to track across HMR
  const messageId = useMemo(() => `glitch:${message.slice(0, 50)}`, [message])
  
  // Check if already spoken this session (survives HMR)
  const alreadySpoken = hasSpokenMessage(messageId)
  
  const [displayedText, setDisplayedText] = useState(showTyping ? '' : message)
  const [isTypingComplete, setIsTypingComplete] = useState(!showTyping)
  const [isGlitching, setIsGlitching] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSpeechComplete, setIsSpeechComplete] = useState(!speakOnType || alreadySpoken)
  const onCompleteRef = useRef(onComplete)
  
  // Track if this effect instance is still valid (not cleaned up)
  const isMountedRef = useRef(true)
  
  // Keep onComplete ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // Fire onComplete when both typing AND speech are done
  const checkComplete = useCallback(() => {
    if (isTypingComplete && isSpeechComplete) {
      onCompleteRef.current?.()
    }
  }, [isTypingComplete, isSpeechComplete])

  useEffect(() => {
    checkComplete()
  }, [checkComplete])

  // Speak the message when component mounts (if enabled)
  useEffect(() => {
    isMountedRef.current = true
    
    if (!speakOnType) {
      setIsSpeechComplete(true)
      return
    }
    
    // Check session-level tracking (survives HMR)
    if (hasSpokenMessage(messageId)) {
      setIsSpeechComplete(true)
      return
    }
    
    // Mark as spoken immediately to prevent race conditions
    markMessageSpoken(messageId)
    setIsSpeaking(true)
    setIsSpeechComplete(false)
    
    if (state.apiKeys.elevenLabs) {
      speakAsCharacter(message, 'glitch', state.apiKeys.elevenLabs, state.apiKeys)
        .finally(() => {
          // Only update state if still mounted
          if (isMountedRef.current) {
            setIsSpeaking(false)
            setIsSpeechComplete(true)
          }
        })
    } else {
      // No API key, mark as complete immediately
      setIsSpeaking(false)
      setIsSpeechComplete(true)
    }
    
    return () => {
      isMountedRef.current = false
    }
  }, [message, messageId, speakOnType, state.apiKeys])

  useEffect(() => {
    if (!showTyping) {
      setDisplayedText(message)
      setIsTypingComplete(true)
      return
    }

    setDisplayedText('')
    setIsTypingComplete(false)
    
    let index = 0
    const interval = setInterval(() => {
      if (index < message.length) {
        // Random glitch effect
        if (Math.random() > 0.9) {
          setIsGlitching(true)
          setTimeout(() => setIsGlitching(false), 100)
        }
        setDisplayedText(message.slice(0, index + 1))
        index++
      } else {
        clearInterval(interval)
        setIsTypingComplete(true)
      }
    }, 25) // Faster, more chaotic typing

    return () => clearInterval(interval)
  }, [message, showTyping])

  const isComplete = isTypingComplete && isSpeechComplete

  return (
    <div 
      className={`flex gap-4 items-start p-4 bg-glitch/5 border border-glitch/30 rounded-lg transition-transform ${
        isGlitching ? 'animate-glitch' : ''
      }`}
    >
      {/* Dr. Glitch avatar */}
      <div className={`flex-shrink-0 w-12 h-12 rounded-lg bg-glitch/20 border border-glitch/50 flex items-center justify-center transition-all ${
        isSpeaking ? 'animate-pulse ring-2 ring-glitch/50' : ''
      }`}>
        <span className="text-2xl">⚡</span>
      </div>
      
      {/* Message content */}
      <div className="flex-1 min-w-0">
        <div className="text-glitch font-semibold text-sm mb-1 flex items-center gap-2">
          DR. GLITCH
          <span className="inline-block w-2 h-2 rounded-full bg-glitch animate-pulse" />
          {isSpeaking && (
            <span className="text-xs font-normal text-glitch/70 flex items-center gap-1">
              <span className="inline-block w-1 h-3 bg-glitch animate-sound-wave" style={{ animationDelay: '0ms' }} />
              <span className="inline-block w-1 h-4 bg-glitch animate-sound-wave" style={{ animationDelay: '150ms' }} />
              <span className="inline-block w-1 h-2 bg-glitch animate-sound-wave" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </div>
        <p className="text-gray-200 text-lg leading-relaxed italic">
          {displayedText}
          {!isComplete && (
            <span className="inline-block w-2 h-5 bg-glitch ml-1 animate-blink" />
          )}
        </p>
      </div>
    </div>
  )
}

