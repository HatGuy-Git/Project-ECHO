import { useState, useCallback, useEffect } from 'react'
import type { Screen } from '../../App'
import { useApp } from '../../context/AppContext'
import type { RecitationStep } from '../../types'
import MainframeMessage from '../ui/MainframeMessage'
import GlitchMessage from '../ui/GlitchMessage'
import ReadyButton from '../ui/ReadyButton'
import ProgressIndicator from '../ui/ProgressIndicator'
import RecordButton from '../ui/RecordButton'
import { speak, stopSpeech } from '../../services/textToSpeech'
import { transcribeAudio } from '../../services/speechToText'
import { compareTexts } from '../../services/textComparison'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'

interface VoiceLockProps {
  onNavigate: (screen: Screen) => void
}

const REPS_REQUIRED = 3
const STEP_NAMES: Record<RecitationStep, string> = {
  'signal-sync': 'SIGNAL SYNC',
  'blind-transmission': 'BLIND TRANSMISSION',
  'sector-clearance': 'SECTOR CLEARANCE',
  'master-broadcast': 'MASTER BROADCAST',
  'complete': 'MISSION COMPLETE',
}

export default function VoiceLock({ onNavigate }: VoiceLockProps) {
  const { state, setRecitationProgress } = useApp()
  const poem = state.currentIntel?.poem
  const intelId = state.currentIntel?.id ?? ''
  const saved = state.recitationProgress

  const stanzas = poem?.content.split(/\n\s*\n/).filter(s => s.trim()) || []
  const totalStanzas = stanzas.length || 1
  const resumeFromSaved = saved?.intelId === intelId && saved.currentStep !== 'complete'
  
  // State
  const [currentStep, setCurrentStep] = useState<RecitationStep>(
    resumeFromSaved ? saved.currentStep : 'signal-sync'
  )
  const [currentRep, setCurrentRep] = useState(resumeFromSaved ? saved.currentRep : 1)
  const [currentStanza, setCurrentStanza] = useState(resumeFromSaved ? saved.currentStanza : 0)
  const [isReady, setIsReady] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showGlitch, setShowGlitch] = useState(false)
  const [comparisonResult, setComparisonResult] = useState<string | null>(null)
  const [, setShowSuccess] = useState(false)

  const { isRecording, audioBlob, startRecording, stopRecording, clearRecording } = useAudioRecorder()

  const currentText = stanzas[currentStanza] || poem?.content || ''

  // Persist progress as the student advances
  useEffect(() => {
    if (!intelId || !poem || currentStep === 'complete') return

    void setRecitationProgress({
      intelId,
      currentStep,
      currentStanza,
      totalStanzas,
      currentRep,
      repsRequired: REPS_REQUIRED,
      sectorsCleared: currentStanza,
    })
  }, [intelId, poem, currentStep, currentStanza, totalStanzas, currentRep, setRecitationProgress])

  // Handle speaking the text
  const handleSpeak = useCallback(async () => {
    if (!state.apiKeys.elevenLabs) {
      // Use browser TTS as fallback
      setIsSpeaking(true)
      const utterance = new SpeechSynthesisUtterance(currentText)
      utterance.rate = 0.85
      utterance.onend = () => setIsSpeaking(false)
      window.speechSynthesis.speak(utterance)
      return
    }

    setIsSpeaking(true)
    await speak(currentText, state.apiKeys.elevenLabs, {
      voiceId: state.apiKeys.elevenLabsVoiceId || undefined,
      speed: 0.9,
    })
    setIsSpeaking(false)
  }, [currentText, state.apiKeys])

  // Handle transcription and comparison
  const handleTranscription = useCallback(async () => {
    if (!audioBlob || !state.apiKeys.assemblyAI) return

    setIsProcessing(true)
    setComparisonResult(null)

    try {
      const expectedText = currentStep === 'master-broadcast' ? (poem?.content ?? currentText) : currentText
      const result = await transcribeAudio(audioBlob, state.apiKeys.assemblyAI, {
        expectedText,
      })
      
      if (!result.success) {
        setComparisonResult('signal-static')
        return
      }

      const comparison = compareTexts(currentText, result.text)
      
      if (comparison.isMatch) {
        setComparisonResult('match')
        setShowSuccess(true)
      } else {
        setComparisonResult(`mismatch:${Math.round(comparison.matchPercentage)}%`)
      }
    } catch (error) {
      console.error('Transcription error:', error)
      setComparisonResult('signal-static')
    } finally {
      setIsProcessing(false)
      clearRecording()
    }
  }, [audioBlob, currentText, currentStep, poem?.content, state.apiKeys.assemblyAI, clearRecording])

  // Proceed to next rep or step
  const handleNext = () => {
    setComparisonResult(null)
    setShowSuccess(false)
    setIsReady(false)

    if (currentStep === 'signal-sync' || currentStep === 'blind-transmission') {
      if (currentRep < REPS_REQUIRED) {
        setCurrentRep(currentRep + 1)
      } else {
        // Move to next step
        setCurrentRep(1)
        if (currentStep === 'signal-sync') {
          setCurrentStep('blind-transmission')
          setShowGlitch(true)
          setTimeout(() => setShowGlitch(false), 5000)
        } else {
          setCurrentStep('sector-clearance')
        }
      }
    } else if (currentStep === 'sector-clearance') {
      if (currentStanza < totalStanzas - 1) {
        setCurrentStanza(currentStanza + 1)
      } else {
        setCurrentStep('master-broadcast')
        setCurrentStanza(0)
      }
    } else if (currentStep === 'master-broadcast') {
      setCurrentStep('complete')
      void setRecitationProgress(null)
    }
  }

  // Retry current step
  const handleRetry = () => {
    setComparisonResult(null)
    setShowSuccess(false)
    setIsReady(false)
    
    if (currentStep === 'sector-clearance' || currentStep === 'master-broadcast') {
      // Go back to signal sync for the current stanza
      setCurrentStep('signal-sync')
      setCurrentRep(1)
    }
  }

  // No poem loaded
  if (!poem) {
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
            message="No recitation passage loaded. Please upload intel first."
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
  if (currentStep === 'complete') {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="font-display text-4xl text-success text-glow-success">
            VOICE LOCK ACTIVATED
          </h1>
          <MainframeMessage
            message="Outstanding work, Agent! You've successfully completed the Voice Lock protocol. Dr. Glitch's audio corruption has been neutralized. Your recitation skills are now certified."
            speakOnType={true}
          />
          <GlitchMessage
            message="NOOOO! My perfectly chaotic plans, ruined by your... your... ORGANIZED MEMORIZATION! This isn't over, Agent!"
            speakOnType={true}
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
              PROTOCOL A: VOICE LOCK
            </h1>
            <p className="text-gray-400 font-mono text-sm mt-1">
              {poem.title}
            </p>
          </div>
          <div className="text-right">
            <p className="text-mainframe font-display text-lg">
              {STEP_NAMES[currentStep]}
            </p>
            <p className="text-gray-400 text-sm">
              Rep {currentRep}/{REPS_REQUIRED}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto space-y-6">
        {/* Progress */}
        <ProgressIndicator
          current={
            (currentStep === 'signal-sync' ? 0 : currentStep === 'blind-transmission' ? 1 : currentStep === 'sector-clearance' ? 2 : 3) + 
            (currentRep - 1) / REPS_REQUIRED
          }
          total={4}
          label="Mission Progress"
          showNumbers={false}
        />

        {/* Instructions based on current step - audio only */}
        <MainframeMessage
          message={
            currentStep === 'signal-sync'
              ? `Step 1: SIGNAL SYNC. Eyes on screen. I will broadcast the text. Read it ALOUD along with me to sync frequencies. Rep ${currentRep} of ${REPS_REQUIRED}.`
              : currentStep === 'blind-transmission'
              ? `Step 2: BLIND TRANSMISSION. Toss the dossier! Look away from the screen. I will feed you the lines, you say them with me. Rep ${currentRep} of ${REPS_REQUIRED}.`
              : currentStep === 'sector-clearance'
              ? `Step 3: SECTOR CLEARANCE. Solo broadcast. Say stanza ${currentStanza + 1} yourself. I am listening.`
              : `Step 4: MASTER BROADCAST. Final test. Transmit the full message from memory.`
          }
          speakOnType={true}
          hideText={true}
        />

        {/* Dr. Glitch interruption */}
        {showGlitch && (
          <GlitchMessage
            message="Stop reading it together! It's too organized! I can feel my chaos powers weakening!"
            speakOnType={true}
          />
        )}

        {/* Text display (hidden in blind transmission and solo modes) */}
        {(currentStep === 'signal-sync' || !isReady) && (
          <div className="card">
            <pre className="whitespace-pre-wrap font-mono text-lg text-gray-200 leading-relaxed">
              {currentStep === 'master-broadcast' ? poem.content : currentText}
            </pre>
          </div>
        )}

        {/* Hidden data overlay for blind transmission */}
        {currentStep === 'blind-transmission' && isReady && (
          <div className="card bg-void-lighter border-glitch/30 text-center py-12">
            <p className="text-glitch font-mono text-xl">
              [ DATA HIDDEN - LOOK AWAY FROM SCREEN ]
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col items-center gap-6 py-6">
          {!isReady ? (
            <ReadyButton 
              label="I'm Ready" 
              onClick={() => setIsReady(true)} 
            />
          ) : currentStep === 'signal-sync' || currentStep === 'blind-transmission' ? (
            // Read along mode - just listen and repeat
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleSpeak}
                disabled={isSpeaking}
                className="btn btn-mainframe text-xl"
              >
                {isSpeaking ? '🔊 Speaking...' : '▶️ Play Audio'}
              </button>
              <button
                onClick={handleNext}
                disabled={isSpeaking}
                className="btn btn-solid"
              >
                Completed Rep {currentRep} ✓
              </button>
              {isSpeaking && (
                <button
                  onClick={() => { stopSpeech(); setIsSpeaking(false); }}
                  className="btn btn-glitch text-sm"
                >
                  Stop Audio
                </button>
              )}
            </div>
          ) : (
            // Recording mode for sector clearance and master broadcast
            <div className="flex flex-col items-center gap-6">
              <RecordButton
                isRecording={isRecording}
                isProcessing={isProcessing}
                onStart={startRecording}
                onStop={() => {
                  stopRecording()
                  // Trigger transcription after a short delay
                  setTimeout(handleTranscription, 500)
                }}
              />

              {/* Comparison result */}
              {comparisonResult === 'match' && (
                <div className="text-center">
                  <p className="text-success text-xl font-display mb-4">
                    ✓ SECTOR {currentStanza + 1} CLEAR
                  </p>
                  <ReadyButton label="Proceed" onClick={handleNext} variant="solid" />
                </div>
              )}

              {comparisonResult === 'signal-static' && (
                <div className="text-center space-y-4">
                  <MainframeMessage
                    message="Signal static detected. Glitch is jamming the frequency. Did you say it correctly, or would you like to try again?"
                    speakOnType={true}
                  />
                  <div className="flex gap-4 justify-center">
                    <ReadyButton label="I said it right" onClick={handleNext} variant="mainframe" size="normal" />
                    <ReadyButton label="Try again" onClick={handleRetry} variant="glitch" size="normal" />
                  </div>
                </div>
              )}

              {comparisonResult?.startsWith('mismatch') && (
                <div className="text-center space-y-4">
                  <MainframeMessage
                    message={`Partial transmission received (${comparisonResult.split(':')[1]} match). Let's return to Signal Sync to clear the channel.`}
                    speakOnType={true}
                  />
                  <ReadyButton label="Return to Signal Sync" onClick={handleRetry} variant="glitch" />
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}


