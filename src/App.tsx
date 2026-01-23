import { useState, useEffect, useCallback } from 'react'
import { AppProvider } from './context/AppContext'
import HomeScreen from './components/HomeScreen'
import UploadIntel from './components/UploadIntel'
import Settings from './components/Settings'
import VoiceLock from './components/ProtocolA/VoiceLock'
import LogicBomb from './components/ProtocolB/LogicBomb'
import { initAudioContext } from './services/textToSpeech'

export type Screen = 'home' | 'upload' | 'settings' | 'protocol-a' | 'protocol-b'

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [audioInitialized, setAudioInitialized] = useState(false)

  // Initialize audio context on first user interaction
  const handleFirstInteraction = useCallback(async () => {
    if (!audioInitialized) {
      await initAudioContext()
      setAudioInitialized(true)
    }
  }, [audioInitialized])

  // Add global click listener to initialize audio on first interaction
  useEffect(() => {
    const handler = () => {
      handleFirstInteraction()
    }
    
    document.addEventListener('click', handler, { once: false })
    document.addEventListener('keydown', handler, { once: false })
    
    return () => {
      document.removeEventListener('click', handler)
      document.removeEventListener('keydown', handler)
    }
  }, [handleFirstInteraction])

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen onNavigate={setCurrentScreen} />
      case 'upload':
        return <UploadIntel onNavigate={setCurrentScreen} />
      case 'settings':
        return <Settings onNavigate={setCurrentScreen} />
      case 'protocol-a':
        return <VoiceLock onNavigate={setCurrentScreen} />
      case 'protocol-b':
        return <LogicBomb onNavigate={setCurrentScreen} />
      default:
        return <HomeScreen onNavigate={setCurrentScreen} />
    }
  }

  return (
    <AppProvider>
      <div className="min-h-screen bg-void grid-bg scanlines">
        <div className="relative z-10">
          {renderScreen()}
        </div>
      </div>
    </AppProvider>
  )
}

export default App


