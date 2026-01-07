import { useState, useCallback, useEffect } from 'react'
import type { Screen } from '../../App'
import { useApp } from '../../context/AppContext'
import type { DictationPhase } from '../../types'
import MainframeMessage from '../ui/MainframeMessage'
import GlitchMessage from '../ui/GlitchMessage'
import ReadyButton from '../ui/ReadyButton'
import ProgressIndicator from '../ui/ProgressIndicator'
import { speak, stopSpeech } from '../../services/textToSpeech'
import { compareTexts, type ComparisonResult } from '../../services/textComparison'

interface LogicBombProps {
  onNavigate: (screen: Screen) => void
}

export default function LogicBomb({ onNavigate }: LogicBombProps) {
  const { state } = useApp()
  const dictation = state.currentIntel?.dictation

  // Split into sentences
  const sentences = dictation?.content
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim()) || []

  // State
  const [currentPhase, setCurrentPhase] = useState<DictationPhase>('study')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [showGlitch, setShowGlitch] = useState(false)
  const [trapWords, setTrapWords] = useState<string[]>([])

  const currentSentence = sentences[currentIndex] || ''
  const totalSentences = sentences.length

  // Identify "trap words" (words that might be tricky to spell)
  useEffect(() => {
    const words = currentSentence.split(/\s+/)
    const traps = words.filter(word => {
      const clean = word.toLowerCase().replace(/[^\w]/g, '')
      // Words with common spelling challenges
      return (
        clean.length > 6 ||
        /ie|ei|ough|tion|sion|ght|ph|silent/.test(clean) ||
        /([a-z])\1/.test(clean) // double letters
      )
    })
    setTrapWords(traps.slice(0, 3)) // Show max 3 trap words
  }, [currentSentence])

  // Handle speaking the sentence
  const handleSpeak = useCallback(async () => {
    if (!currentSentence) return

    setIsSpeaking(true)
    
    if (state.apiKeys.elevenLabs) {
      await speak(currentSentence, state.apiKeys.elevenLabs, {
        voiceId: state.apiKeys.elevenLabsVoiceId || undefined,
        speed: 0.85, // Slightly slower for dictation
      })
    } else {
      // Browser TTS fallback
      const utterance = new SpeechSynthesisUtterance(currentSentence)
      utterance.rate = 0.8
      await new Promise<void>(resolve => {
        utterance.onend = () => resolve()
        window.speechSynthesis.speak(utterance)
      })
    }
    
    setIsSpeaking(false)
  }, [currentSentence, state.apiKeys])

  // Check user input
  const handleCheck = () => {
    const result = compareTexts(currentSentence, userInput)
    setComparison(result)
    
    if (result.isMatch) {
      setCorrectCount(prev => prev + 1)
      setShowGlitch(true)
      setTimeout(() => setShowGlitch(false), 3000)
    }
    
    setCurrentPhase('check')
  }

  // Move to next sentence
  const handleNext = () => {
    if (currentIndex < totalSentences - 1) {
      setCurrentIndex(currentIndex + 1)
      setCurrentPhase('study')
      setUserInput('')
      setComparison(null)
    } else {
      setCurrentPhase('complete')
    }
  }

  // No dictation loaded
  if (!dictation || sentences.length === 0) {
    return (
      <div className="min-h-screen p-6">
        <header className="max-w-3xl mx-auto mb-6">
          <button
            onClick={() => onNavigate('home')}
            className="text-mainframe hover:text-mainframe-light transition-colors mb-4 flex items-center gap-2"
          >
            <span>←</span>
            <span>Return to Mission Control</span>
          </button>
        </header>
        <main className="max-w-3xl mx-auto">
          <MainframeMessage
            message="No dictation passage loaded. Please upload intel first."
            showTyping={false}
          />
          <div className="mt-6">
            <ReadyButton label="Upload Intel" onClick={() => onNavigate('upload')} />
          </div>
        </main>
      </div>
    )
  }

  // Mission complete
  if (currentPhase === 'complete') {
    const percentage = Math.round((correctCount / totalSentences) * 100)
    
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="text-6xl mb-4">💣</div>
          <h1 className="font-display text-4xl text-success text-glow-success">
            LOGIC BOMB DEFUSED
          </h1>
          <div className="text-2xl font-display text-mainframe">
            {correctCount}/{totalSentences} ({percentage}%)
          </div>
          <MainframeMessage
            message={
              percentage >= 90
                ? "Exceptional work, Agent! Your spelling precision has neutralized Dr. Glitch's logic bomb. The language systems are secure."
                : percentage >= 70
                ? "Good effort, Agent. The bomb is defused, but continue practicing to strengthen your spelling defenses."
                : "Mission complete, Agent. Keep training to improve your accuracy against Dr. Glitch's traps."
            }
          />
          <GlitchMessage
            message={
              percentage >= 90
                ? "IMPOSSIBLE! My beautiful spelling chaos, defeated by... PROPER EDUCATION?! I'll be back with trickier words!"
                : "Ha! You think you've won? I've planted MORE spelling traps in your future! Mwahahaha!"
            }
          />
          <div className="pt-6">
            <ReadyButton label="Return to Base" onClick={() => onNavigate('home')} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <header className="max-w-3xl mx-auto mb-6">
        <button
          onClick={() => onNavigate('home')}
          className="text-mainframe hover:text-mainframe-light transition-colors mb-4 flex items-center gap-2"
        >
          <span>←</span>
          <span>Abort Mission</span>
        </button>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-display text-2xl text-mainframe text-glow-mainframe">
              PROTOCOL B: LOGIC BOMB
            </h1>
            <p className="text-gray-400 font-mono text-sm mt-1">
              {dictation.title}
            </p>
          </div>
          <div className="text-right">
            <p className="text-mainframe font-display text-lg uppercase">
              {currentPhase === 'study' ? 'STUDY' : 
               currentPhase === 'hide' ? 'HIDDEN' :
               currentPhase === 'input' ? 'TRANSMIT' : 'VERIFY'}
            </p>
            <p className="text-gray-400 text-sm">
              Sentence {currentIndex + 1}/{totalSentences}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto space-y-6">
        {/* Progress */}
        <ProgressIndicator
          current={currentIndex + (currentPhase === 'check' ? 1 : 0.5)}
          total={totalSentences}
          label="Bomb Defusal Progress"
        />

        {/* Phase-specific content */}
        {currentPhase === 'study' && (
          <>
            <MainframeMessage
              message="Study phase. Memorize this sentence. Identify the Trap Words - tricky spellings that Dr. Glitch might use against you."
              showTyping={false}
            />
            
            <div className="card">
              <pre className="whitespace-pre-wrap font-mono text-xl text-gray-200 leading-relaxed">
                {currentSentence}
              </pre>
              
              {trapWords.length > 0 && (
                <div className="mt-4 pt-4 border-t border-mainframe/20">
                  <p className="text-sm text-glitch mb-2 font-semibold">⚠️ TRAP WORDS DETECTED:</p>
                  <div className="flex flex-wrap gap-2">
                    {trapWords.map((word, i) => (
                      <span 
                        key={i}
                        className="px-3 py-1 bg-glitch/10 border border-glitch/30 rounded text-glitch font-mono"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <ReadyButton 
                label="Ready - Hide the Data" 
                onClick={() => setCurrentPhase('hide')} 
              />
            </div>
          </>
        )}

        {currentPhase === 'hide' && (
          <>
            <MainframeMessage
              message="Data hidden. Listen to the dictation and type what you hear. Take your time, Agent."
              showTyping={false}
            />

            <div className="card bg-void-lighter border-glitch/30 text-center py-12">
              <p className="text-glitch font-mono text-xl mb-4">
                [ DATA HIDDEN - DO NOT SCROLL UP ]
              </p>
              <button
                onClick={() => setCurrentPhase('input')}
                className="btn btn-mainframe"
              >
                Begin Dictation
              </button>
            </div>
          </>
        )}

        {currentPhase === 'input' && (
          <>
            <MainframeMessage
              message="Listen and type. Press the play button to hear the sentence, then type it below."
              showTyping={false}
            />

            {/* Audio controls */}
            <div className="flex justify-center gap-4">
              <button
                onClick={handleSpeak}
                disabled={isSpeaking}
                className="btn btn-mainframe text-xl"
              >
                {isSpeaking ? '🔊 Speaking...' : '▶️ Play Dictation'}
              </button>
              {isSpeaking && (
                <button
                  onClick={() => { stopSpeech(); setIsSpeaking(false); }}
                  className="btn btn-glitch"
                >
                  Stop
                </button>
              )}
            </div>

            {/* Input area */}
            <div className="card">
              <label className="block text-mainframe font-semibold mb-2">
                Type the sentence:
              </label>
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className="textarea-field min-h-[120px] text-xl"
                placeholder="Type what you hear..."
                autoFocus
              />
            </div>

            <div className="flex justify-center">
              <ReadyButton 
                label="Check My Answer" 
                onClick={handleCheck}
                disabled={!userInput.trim()}
              />
            </div>
          </>
        )}

        {currentPhase === 'check' && comparison && (
          <>
            {comparison.isMatch ? (
              <>
                <div className="text-center mb-4">
                  <span className="text-6xl">✓</span>
                  <p className="text-success text-2xl font-display mt-2">
                    BOMB DEFUSED!
                  </p>
                  <p className="text-gray-400">Left hand stability: 100%</p>
                </div>

                {showGlitch && (
                  <GlitchMessage
                    message="What?! That was PERFECT?! My spelling traps are useless against your training!"
                  />
                )}
              </>
            ) : (
              <>
                <MainframeMessage
                  message={`Correction needed. ${Math.round(comparison.matchPercentage)}% match. Study the correct version below.`}
                  showTyping={false}
                />

                <div className="card">
                  <p className="text-sm text-gray-400 mb-2">YOUR INPUT:</p>
                  <p className="font-mono text-lg text-danger mb-4 line-through opacity-70">
                    {userInput}
                  </p>
                  
                  <p className="text-sm text-gray-400 mb-2">CORRECT:</p>
                  <p className="font-mono text-lg text-success">
                    {currentSentence}
                  </p>

                  {/* Highlight differences */}
                  <div className="mt-4 pt-4 border-t border-mainframe/20">
                    <p className="text-sm text-mainframe mb-2">Visualize these corrections:</p>
                    <div className="flex flex-wrap gap-2">
                      {comparison.wordResults
                        .filter(w => !w.isCorrect && w.original)
                        .map((word, i) => (
                          <span 
                            key={i}
                            className="px-3 py-1 bg-success/10 border border-success/30 rounded text-success font-mono text-lg"
                          >
                            {word.original}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-center">
              <ReadyButton 
                label={currentIndex < totalSentences - 1 ? "Next Sentence" : "Complete Mission"} 
                onClick={handleNext}
              />
            </div>
          </>
        )}
      </main>
    </div>
  )
}

