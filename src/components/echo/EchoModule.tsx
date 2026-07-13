import { useState } from 'react'
import type { Screen, EchoScreen } from '../../App'
import HomeScreen from '../HomeScreen'
import UploadIntel from '../UploadIntel'
import VoiceLock from '../ProtocolA/VoiceLock'
import LogicBomb from '../ProtocolB/LogicBomb'

type EchoScreenNav = EchoScreen | 'settings'

interface EchoModuleProps {
  onNavigate: (screen: Screen) => void
}

export default function EchoModule({ onNavigate }: EchoModuleProps) {
  const [echoScreen, setEchoScreen] = useState<EchoScreen>('home')

  const handleEchoNavigate = (screen: EchoScreenNav) => {
    if (screen === 'settings') {
      onNavigate('settings')
      return
    }
    setEchoScreen(screen)
  }

  switch (echoScreen) {
    case 'upload':
      return <UploadIntel onNavigate={handleEchoNavigate} onExit={() => onNavigate('hub')} />
    case 'protocol-a':
      return <VoiceLock onNavigate={handleEchoNavigate} onExit={() => onNavigate('hub')} />
    case 'protocol-b':
      return <LogicBomb onNavigate={handleEchoNavigate} onExit={() => onNavigate('hub')} />
    default:
      return <HomeScreen onNavigate={handleEchoNavigate} onExit={() => onNavigate('hub')} />
  }
}
