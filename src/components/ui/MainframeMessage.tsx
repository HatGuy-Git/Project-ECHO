import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { prefetchCharacterAudio, playAudio, hasSpokenMessage, markMessageSpoken, isAudioReady, initAudioContext } from '../../services/textToSpeech'

interface MainframeMessageProps {
  message: string
  showTyping?: boolean
  speakOnType?: boolean // Whether to speak the message with TTS
  hideText?: boolean // Hide text display entirely (audio only)
  onComplete?: () => void
}

export default function MainframeMessage({ 
  message, 
  showTyping = true,
  speakOnType = false,
  hideText = false,
  onComplete 
}: MainframeMessageProps) {
  const { state } = useApp()
  
  // Create a stable ID for this message to track across HMR
  // Use full message to ensure different reps/stanzas are unique
  const messageId = useMemo(() => `mainframe:${message}`, [message])
  
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
    
    // Reset fetching flag when message changes
    isFetchingRef.current = false
    
    // Clear any existing typing interval
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current)
      typingIntervalRef.current = null
    }
    
    // Debug logging
    console.log('[MainframeMessage] Effect running:', {
      speakOnType,
      hideText,
      hasApiKey: !!state.apiKeys.elevenLabs,
      messagePreview: message.slice(0, 50),
      alreadySpoken: hasSpokenMessage(messageId),
    })
    
    if (!speakOnType) {
      console.log('[MainframeMessage] Skipping speech: speakOnType is false')
      setIsSpeechComplete(true)
      setIsLoading(false)
      // Start typing without audio sync
      if (showTyping && !hideText) {
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
      console.log('[MainframeMessage] Skipping speech: already spoken this session')
      setIsSpeechComplete(true)
      setIsLoading(false)
      setDisplayedText(message)
      setIsTypingComplete(true)
      return
    }
    
    if (!state.apiKeys.elevenLabs) {
      // No API key - just do typing animation without speech
      console.log('[MainframeMessage] Skipping speech: no ElevenLabs API key')
      setIsSpeaking(false)
      setIsSpeechComplete(true)
      setIsLoading(false)
      if (showTyping && !hideText) {
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
    if (isFetchingRef.current) {
      console.log('[MainframeMessage] Skipping speech: already fetching')
      return
    }
    isFetchingRef.current = true
    setIsLoading(true)
    
    console.log('[MainframeMessage] Starting audio fetch...')
    
    // Prefetch audio, then start both playback and typing together
    prefetchCharacterAudio(message, 'mainframe', state.apiKeys.elevenLabs, state.apiKeys)
      .then(async (result) => {
        if (!isMountedRef.current) {
          console.log('[MainframeMessage] Component unmounted, aborting')
          return
        }
        
        // Mark as spoken only after we've committed to playing
        markMessageSpoken(messageId)
        
        if (result) {
          console.log('[MainframeMessage] Audio fetched, duration:', result.duration)
          
          // Ensure audio context is ready (may need to wait for user interaction)
          if (!isAudioReady()) {
            console.log('[MainframeMessage] Waiting for audio context to be ready...')
            // Wait up to 2 seconds for user interaction to initialize audio
            for (let i = 0; i < 20; i++) {
              await new Promise(resolve => setTimeout(resolve, 100))
              if (isAudioReady()) break
            }
            // Try to init one more time
            if (!isAudioReady()) {
              try {
                await initAudioContext()
              } catch {
                console.log('[MainframeMessage] Could not initialize audio context')
              }
            }
          }
          
          setIsLoading(false)
          setIsSpeaking(true)
          
          // Start typing synced with audio duration
          startTypingAnimation(result.duration)
          
          // Play audio and wait for completion
          try {
            await playAudio(result.blob)
            console.log('[MainframeMessage] Audio playback complete')
          } catch (error) {
            console.error('[MainframeMessage] Audio playback error:', error)
          }
          
          if (isMountedRef.current) {
            setIsSpeaking(false)
            setIsSpeechComplete(true)
          }
        } else {
          // Audio fetch failed - just do typing animation
          console.log('[MainframeMessage] Audio fetch returned null')
          setIsLoading(false)
          setIsSpeechComplete(true)
          startTypingAnimation(5) // Default 5 second duration
        }
      })
      .catch((error) => {
        console.error('[MainframeMessage] Audio fetch error:', error)
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

  // Audio-only mode: just show avatar with speaking indicator
  if (hideText) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className={`w-16 h-16 rounded-lg bg-mainframe/20 border-2 border-mainframe/50 flex items-center justify-center transition-all ${
          isSpeaking ? 'animate-pulse ring-4 ring-mainframe/50 scale-110' : ''
        } ${isLoading ? 'animate-pulse' : ''}`}>
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

