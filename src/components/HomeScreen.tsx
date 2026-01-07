import { useState, useEffect } from 'react'
import type { Screen } from '../App'
import { useApp } from '../context/AppContext'
import MainframeMessage from './ui/MainframeMessage'
import GlitchMessage from './ui/GlitchMessage'
import ReadyButton from './ui/ReadyButton'
import { hasSpokenMessage } from '../services/textToSpeech'

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void
}

// Message IDs that match the ones used in the components
const MAINFRAME_INTRO_ID = 'mainframe:Welcome, Agent.'
const GLITCH_INTRO_ID = 'glitch:Mwahahaha! You think you can stop me? I\'ve s'

export default function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { state, hasApiKeys, hasIntel } = useApp()
  
  // Check if we've already done the intro this session (survives HMR)
  const introAlreadyDone = hasSpokenMessage(MAINFRAME_INTRO_ID)
  
  const [showGlitch, setShowGlitch] = useState(introAlreadyDone)
  const [introComplete, setIntroComplete] = useState(introAlreadyDone)

  // Show Dr. Glitch after intro
  useEffect(() => {
    if (introComplete && !showGlitch) {
      const timer = setTimeout(() => setShowGlitch(true), 500)
      return () => clearTimeout(timer)
    }
  }, [introComplete, showGlitch])

  const needsSetup = !hasApiKeys()
  const canResume = hasIntel()

  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-mainframe/30 border-t-mainframe rounded-full animate-spin mx-auto mb-4" />
          <p className="text-mainframe font-mono">INITIALIZING MAINFRAME...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 flex flex-col">
      {/* Header */}
      <header className="text-center mb-8">
        <h1 className="font-display text-4xl md:text-5xl text-mainframe text-glow-mainframe mb-2">
          PROJECT ECHO
        </h1>
        <p className="text-gray-400 font-mono text-sm">
          AGENCY MAINFRAME v1.0 // CLASSIFIED
        </p>
      </header>

      {/* Main content area */}
      <main className="flex-1 max-w-2xl mx-auto w-full space-y-6">
        {/* Mainframe greeting */}
        <MainframeMessage
          message={
            needsSetup
              ? "Welcome, Agent. Before we begin your training, we need to establish secure communication channels. Please configure your API keys in Settings."
              : canResume
              ? "Welcome back, Agent. Your previous intel is still loaded. Ready to continue training, or shall we upload new intel?"
              : "Welcome, Agent. I am the Mainframe. Dr. Glitch is attempting to corrupt the world's language systems. Your mission: master the art of precise speech and spelling. Are you ready to begin?"
          }
          speakOnType={true}
          onComplete={() => setIntroComplete(true)}
        />

        {/* Dr. Glitch interruption */}
        {showGlitch && (
          <GlitchMessage
            message="Mwahahaha! You think you can stop me? I've scrambled dictionaries, corrupted spellcheckers, and confused grammar everywhere! You'll NEVER defeat my chaos!"
            speakOnType={true}
          />
        )}

        {/* Action buttons */}
        <div className="space-y-4 pt-6">
          {/* Always show Upload Intel button */}
          <button
            onClick={() => onNavigate('upload')}
            className="btn btn-mainframe w-full text-xl flex items-center justify-center gap-3"
          >
            <span>📤</span>
            <span>Upload New Intel</span>
          </button>

          {canResume && (
            <button
              onClick={() => {
                // For now, go to a protocol selection
                // In a full implementation, this would show a choice
                onNavigate('protocol-a')
              }}
              className="btn btn-solid w-full text-xl flex items-center justify-center gap-3"
            >
              <span>▶️</span>
              <span>Resume Training</span>
            </button>
          )}

          {/* Settings link */}
          <button
            onClick={() => onNavigate('settings')}
            className={`btn w-full text-lg ${needsSetup ? 'btn-solid' : 'btn-glitch opacity-70 hover:opacity-100'}`}
          >
            ⚙️ {needsSetup ? 'Configure API Keys (Recommended)' : 'Settings'}
          </button>

          {/* Demo mode notice */}
          {needsSetup && (
            <p className="text-center text-gray-500 text-sm">
              You can start without API keys using browser voices (limited quality).
            </p>
          )}
        </div>

        {/* Protocol selection (if intel exists) */}
        {canResume && (
          <div className="mt-8 p-6 card">
            <h2 className="text-mainframe font-display text-xl mb-4">SELECT PROTOCOL</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => onNavigate('protocol-a')}
                className="btn btn-mainframe text-left p-4 h-auto flex-col items-start"
                disabled={!state.currentIntel?.poem}
              >
                <span className="text-2xl mb-2">🎤</span>
                <span className="font-display text-lg">PROTOCOL A</span>
                <span className="text-sm text-gray-400 mt-1">The Voice Lock (Recitation)</span>
              </button>
              
              <button
                onClick={() => onNavigate('protocol-b')}
                className="btn btn-mainframe text-left p-4 h-auto flex-col items-start"
                disabled={!state.currentIntel?.dictation}
              >
                <span className="text-2xl mb-2">💣</span>
                <span className="font-display text-lg">PROTOCOL B</span>
                <span className="text-sm text-gray-400 mt-1">The Logic Bomb (Dictation)</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center mt-8 text-gray-600 text-sm font-mono">
        <p>[ SECURE CONNECTION ESTABLISHED ]</p>
      </footer>
    </div>
  )
}

