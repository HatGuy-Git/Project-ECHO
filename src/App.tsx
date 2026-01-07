import { useState } from 'react'
import { AppProvider } from './context/AppContext'
import HomeScreen from './components/HomeScreen'
import UploadIntel from './components/UploadIntel'
import Settings from './components/Settings'
import VoiceLock from './components/ProtocolA/VoiceLock'
import LogicBomb from './components/ProtocolB/LogicBomb'

export type Screen = 'home' | 'upload' | 'settings' | 'protocol-a' | 'protocol-b'

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')

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

