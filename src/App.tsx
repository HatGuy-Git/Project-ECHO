import { useState, useEffect, useCallback } from 'react'
import { AppProvider } from './context/AppContext'
import ModuleHub from './components/hub/ModuleHub'
import EchoModule from './components/echo/EchoModule'
import TNDriverModule from './components/driver/TNDriverModule'
import Settings from './components/Settings'
import { initAudioContext } from './services/textToSpeech'

export type Screen = 'hub' | 'settings' | 'echo' | 'tn-driver'
export type EchoScreen = 'home' | 'upload' | 'protocol-a' | 'protocol-b'

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('hub')
  const [settingsReturn, setSettingsReturn] = useState<Screen>('hub')
  const [audioInitialized, setAudioInitialized] = useState(false)

  const handleFirstInteraction = useCallback(async () => {
    if (!audioInitialized) {
      await initAudioContext()
      setAudioInitialized(true)
    }
  }, [audioInitialized])

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

  const navigateToSettings = (returnTo: Screen) => {
    setSettingsReturn(returnTo)
    setCurrentScreen('settings')
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'hub':
        return <ModuleHub onNavigate={setCurrentScreen} />
      case 'echo':
        return (
          <EchoModule
            onNavigate={(screen) => {
              if (screen === 'settings') {
                navigateToSettings('echo')
              } else {
                setCurrentScreen(screen)
              }
            }}
          />
        )
      case 'tn-driver':
        return (
          <TNDriverModule
            onNavigate={(screen) => {
              if (screen === 'settings') {
                navigateToSettings('tn-driver')
              } else {
                setCurrentScreen(screen)
              }
            }}
          />
        )
      case 'settings':
        return (
          <Settings
            onNavigate={(screen) => setCurrentScreen(screen)}
            returnTo={settingsReturn}
          />
        )
      default:
        return <ModuleHub onNavigate={setCurrentScreen} />
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
