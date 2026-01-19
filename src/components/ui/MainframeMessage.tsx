import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { prefetchCharacterAudio, playAudio, hasSpokenMessage, markMessageSpoken } from '../../services/textToSpeech'

interface MainframeMessageProps {
  message: string
  showTyping?: boolean
  speakOnType?: boolean // Whether to speak the message with TTS
  onComplete?: () => void
}

export default function MainframeMessage({ 
  message, 
  showTyping = true,
  speakOnType = false,
  onComplete 
}: MainframeMessageProps) {
  const { state } = useApp()
  
  // Create a stable ID for this message to track across HMR
  const messageId = useMemo(() => `mainframe:${message.slice(0, 50)}`, [message])
  
  // Check if already spoken this session (survives HMR)
  const alreadySpoken = hasSpokenMessage(messageId)
  
  const [displayedText, setDisplayedText] = useState(showTyping && !alreadySpoken ? '' : message)
  const [isTypingComplete, setIsTypingComplete] = useState(!showTyping || alreadySpoken)
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

  // Start typing animation synced with audio duration
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
    // Clamp between 20ms and 80ms per character for readability
    const clampedDelay = Math.max(20, Math.min(80, charDelay))
    
    setDisplayedText('')
    setIsTypingComplete(false)
    
    let index = 0
    typingIntervalRef.current = setInterval(() => {
      if (index < message.length) {
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
            setDisplayedText(message.slice(0, index + 1))
            index++
          } else {
            if (typingIntervalRef.current) {
              clearInterval(typingIntervalRef.current)
              typingIntervalRef.current = null
            }
            setIsTypingComplete(true)
          }
        }, 30)
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
            setDisplayedText(message.slice(0, index + 1))
            index++
          } else {
            if (typingIntervalRef.current) {
              clearInterval(typingIntervalRef.current)
              typingIntervalRef.current = null
            }
            setIsTypingComplete(true)
          }
        }, 30)
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
    prefetchCharacterAudio(message, 'mainframe', state.apiKeys.elevenLabs, state.apiKeys)
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
          startTypingAnimation(5) // Default 5 second duration
        }
      })
      .catch(() => {
        if (isMountedRef.current) {
          // Mark as spoken even on failure to prevent retry loops
          markMessageSpoken(messageId)
          setIsLoading(false)
          setIsSpeechComplete(true)
          startTypingAnimation(5)
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
    <div className="flex gap-4 items-start p-4 bg-void-light/50 border border-mainframe/30 rounded-lg">
      {/* Mainframe avatar */}
      <div className={`flex-shrink-0 w-12 h-12 rounded-lg bg-mainframe/20 border border-mainframe/50 flex items-center justify-center transition-all ${
        isSpeaking ? 'animate-pulse ring-2 ring-mainframe/50' : ''
      } ${isLoading ? 'animate-pulse' : ''}`}>
        <span className="text-2xl">🖥️</span>
      </div>
      
      {/* Message content */}
      <div className="flex-1 min-w-0">
        <div className="text-mainframe font-semibold text-sm mb-1 flex items-center gap-2">
          MAINFRAME
          <span className="inline-block w-2 h-2 rounded-full bg-mainframe animate-pulse" />
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
        <p className="text-gray-200 text-lg leading-relaxed">
          {isLoading ? (
            <span className="inline-block w-2 h-5 bg-mainframe animate-blink" />
          ) : (
            <>
              {displayedText}
              {!isComplete && (
                <span className="inline-block w-2 h-5 bg-mainframe ml-1 animate-blink" />
              )}
            </>
          )}
        </p>
      </div>
    </div>
  )
}

