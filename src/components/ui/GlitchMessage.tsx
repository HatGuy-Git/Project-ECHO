import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { prefetchCharacterAudio, playAudio, hasSpokenMessage, markMessageSpoken } from '../../services/textToSpeech'

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
  // Use full message to ensure unique messages are unique
  const messageId = useMemo(() => `glitch:${message}`, [message])
  
  // Check if already spoken this session (survives HMR)
  const alreadySpoken = hasSpokenMessage(messageId)
  
  const [displayedText, setDisplayedText] = useState(showTyping && !alreadySpoken ? '' : message)
  const [isTypingComplete, setIsTypingComplete] = useState(!showTyping || alreadySpoken)
  const [isGlitching, setIsGlitching] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSpeechComplete, setIsSpeechComplete] = useState(!speakOnType || alreadySpoken)
  const [isLoading, setIsLoading] = useState(speakOnType && !alreadySpoken && !!state.apiKeys.elevenLabs)
  const onCompleteRef = useRef(onComplete)
  
  // Track if this effect instance is still valid (not cleaned up)
  const isMountedRef = useRef(true)
  // Track the typing interval so we can sync it with audio
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Track if we're already fetching audio to prevent duplicate fetches
  const isFetchingRef = useRef(false)
  
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

  // Start typing animation synced with audio duration (with glitch effects)
  const startTypingAnimation = useCallback((duration: number) => {
    if (!showTyping) {
      setDisplayedText(message)
      setIsTypingComplete(true)
      return
    }
    
    // Calculate typing speed to finish just before audio ends
    // Leave 0.5s buffer at the end
    const effectiveDuration = Math.max(duration - 0.5, 1) * 1000 // Convert to ms
    const charDelay = effectiveDuration / message.length
    // Clamp between 15ms and 60ms per character (faster, more chaotic for Glitch)
    const clampedDelay = Math.max(15, Math.min(60, charDelay))
    
    setDisplayedText('')
    setIsTypingComplete(false)
    
    let index = 0
    typingIntervalRef.current = setInterval(() => {
      if (index < message.length) {
        // Random glitch effect
        if (Math.random() > 0.9) {
          setIsGlitching(true)
          setTimeout(() => setIsGlitching(false), 100)
        }
        setDisplayedText(message.slice(0, index + 1))
        index++
      } else {
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current)
          typingIntervalRef.current = null
        }
        setIsTypingComplete(true)
      }
    }, clampedDelay)
  }, [message, showTyping])

  // Prefetch audio, then start both playback and typing together
  useEffect(() => {
    isMountedRef.current = true
    
    // Reset fetching flag when message changes
    isFetchingRef.current = false
    
    // Clear any existing typing interval
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current)
      typingIntervalRef.current = null
    }
    
    if (!speakOnType) {
      setIsSpeechComplete(true)
      setIsLoading(false)
      // Start typing without audio sync
      if (showTyping) {
        setDisplayedText('')
        setIsTypingComplete(false)
        let index = 0
        typingIntervalRef.current = setInterval(() => {
          if (index < message.length) {
            if (Math.random() > 0.9) {
              setIsGlitching(true)
              setTimeout(() => setIsGlitching(false), 100)
            }
            setDisplayedText(message.slice(0, index + 1))
            index++
          } else {
            if (typingIntervalRef.current) {
              clearInterval(typingIntervalRef.current)
              typingIntervalRef.current = null
            }
            setIsTypingComplete(true)
          }
        }, 25)
      } else {
        setDisplayedText(message)
        setIsTypingComplete(true)
      }
      return
    }
    
    // Check session-level tracking (survives HMR)
    if (hasSpokenMessage(messageId)) {
      setIsSpeechComplete(true)
      setIsLoading(false)
      setDisplayedText(message)
      setIsTypingComplete(true)
      return
    }
    
    if (!state.apiKeys.elevenLabs) {
      // No API key - just do typing animation without speech
      setIsSpeaking(false)
      setIsSpeechComplete(true)
      setIsLoading(false)
      if (showTyping) {
        setDisplayedText('')
        setIsTypingComplete(false)
        let index = 0
        typingIntervalRef.current = setInterval(() => {
          if (index < message.length) {
            if (Math.random() > 0.9) {
              setIsGlitching(true)
              setTimeout(() => setIsGlitching(false), 100)
            }
            setDisplayedText(message.slice(0, index + 1))
            index++
          } else {
            if (typingIntervalRef.current) {
              clearInterval(typingIntervalRef.current)
              typingIntervalRef.current = null
            }
            setIsTypingComplete(true)
          }
        }, 25)
      } else {
        setDisplayedText(message)
        setIsTypingComplete(true)
      }
      return
    }
    
    // Prevent duplicate fetches
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    setIsLoading(true)
    
    // Prefetch audio, then start both playback and typing together
    prefetchCharacterAudio(message, 'glitch', state.apiKeys.elevenLabs, state.apiKeys)
      .then(async (result) => {
        if (!isMountedRef.current) return
        
        // Mark as spoken only after we've committed to playing
        markMessageSpoken(messageId)
        
        if (result) {
          setIsLoading(false)
          setIsSpeaking(true)
          
          // Start typing synced with audio duration
          startTypingAnimation(result.duration)
          
          // Play audio and wait for completion
          try {
            await playAudio(result.blob)
          } catch (error) {
            console.error('Audio playback error:', error)
          }
          
          if (isMountedRef.current) {
            setIsSpeaking(false)
            setIsSpeechComplete(true)
          }
        } else {
          // Audio fetch failed - just do typing animation
          setIsLoading(false)
          setIsSpeechComplete(true)
          startTypingAnimation(4) // Default 4 second duration for Glitch
        }
      })
      .catch(() => {
        if (isMountedRef.current) {
          // Mark as spoken even on failure to prevent retry loops
          markMessageSpoken(messageId)
          setIsLoading(false)
          setIsSpeechComplete(true)
          startTypingAnimation(4)
        }
      })
    
    return () => {
      isMountedRef.current = false
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current)
        typingIntervalRef.current = null
      }
    }
  }, [message, messageId, speakOnType, showTyping, state.apiKeys, startTypingAnimation])

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
      } ${isLoading ? 'animate-pulse' : ''}`}>
        <span className="text-2xl">⚡</span>
      </div>
      
      {/* Message content */}
      <div className="flex-1 min-w-0">
        <div className="text-glitch font-semibold text-sm mb-1 flex items-center gap-2">
          DR. GLITCH
          <span className="inline-block w-2 h-2 rounded-full bg-glitch animate-pulse" />
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
        <p className="text-gray-200 text-lg leading-relaxed italic">
          {isLoading ? (
            <span className="inline-block w-2 h-5 bg-glitch animate-blink" />
          ) : (
            <>
              {displayedText}
              {!isComplete && (
                <span className="inline-block w-2 h-5 bg-glitch ml-1 animate-blink" />
              )}
            </>
          )}
        </p>
      </div>
    </div>
  )
}

