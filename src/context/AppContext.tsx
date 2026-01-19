import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import type { Intel, ApiKeys, RecitationProgress, DictationProgress } from '../types'
import { storage } from '../services/storage'

// Environment variable defaults (set in .env file)
const ENV_API_KEYS: ApiKeys = {
  assemblyAI: import.meta.env.VITE_ASSEMBLYAI_API_KEY || null,
  elevenLabs: import.meta.env.VITE_ELEVENLABS_API_KEY || null,
  elevenLabsVoiceId: null,
  mainframeVoiceId: import.meta.env.VITE_MAINFRAME_VOICE_ID || null,
  drGlitchVoiceId: import.meta.env.VITE_DR_GLITCH_VOICE_ID || null,
}

interface AppState {
  // Current intel (poem and dictation passages)
  currentIntel: Intel | null
  
  // API keys for speech services
  apiKeys: ApiKeys
  
  // Progress tracking
  recitationProgress: RecitationProgress | null
  dictationProgress: DictationProgress | null
  
  // UI state
  isLoading: boolean
  error: string | null
}

type AppAction =
  | { type: 'SET_INTEL'; payload: Intel }
  | { type: 'CLEAR_INTEL' }
  | { type: 'SET_API_KEYS'; payload: Partial<ApiKeys> }
  | { type: 'SET_RECITATION_PROGRESS'; payload: RecitationProgress | null }
  | { type: 'SET_DICTATION_PROGRESS'; payload: DictationProgress | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }

const initialState: AppState = {
  currentIntel: null,
  apiKeys: ENV_API_KEYS, // Use environment variables as initial defaults
  recitationProgress: null,
  dictationProgress: null,
  isLoading: true,
  error: null,
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_INTEL':
      return { ...state, currentIntel: action.payload }
    case 'CLEAR_INTEL':
      return { ...state, currentIntel: null, recitationProgress: null, dictationProgress: null }
    case 'SET_API_KEYS':
      return { ...state, apiKeys: { ...state.apiKeys, ...action.payload } }
    case 'SET_RECITATION_PROGRESS':
      return { ...state, recitationProgress: action.payload }
    case 'SET_DICTATION_PROGRESS':
      return { ...state, dictationProgress: action.payload }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'LOAD_STATE':
      return { ...state, ...action.payload, isLoading: false }
    default:
      return state
  }
}

interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  
  // Convenience methods
  setIntel: (intel: Intel) => Promise<void>
  clearIntel: () => Promise<void>
  setApiKeys: (keys: Partial<ApiKeys>) => Promise<void>
  hasApiKeys: () => boolean
  hasIntel: () => boolean
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // Load saved state on mount
  useEffect(() => {
    async function loadSavedState() {
      try {
        const [savedIntel, savedApiKeys] = await Promise.all([
          storage.getCurrentIntel(),
          storage.getApiKeys(),
        ])
        
        // Merge saved keys with environment defaults (saved keys take priority)
        const mergedApiKeys: ApiKeys = {
          assemblyAI: savedApiKeys?.assemblyAI || ENV_API_KEYS.assemblyAI,
          elevenLabs: savedApiKeys?.elevenLabs || ENV_API_KEYS.elevenLabs,
          elevenLabsVoiceId: savedApiKeys?.elevenLabsVoiceId || ENV_API_KEYS.elevenLabsVoiceId,
          mainframeVoiceId: savedApiKeys?.mainframeVoiceId || ENV_API_KEYS.mainframeVoiceId,
          drGlitchVoiceId: savedApiKeys?.drGlitchVoiceId || ENV_API_KEYS.drGlitchVoiceId,
        }
        
        dispatch({
          type: 'LOAD_STATE',
          payload: {
            currentIntel: savedIntel,
            apiKeys: mergedApiKeys,
          },
        })
      } catch (error) {
        console.error('Failed to load saved state:', error)
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }
    
    loadSavedState()
  }, [])

  const setIntel = async (intel: Intel) => {
    await storage.saveIntel(intel)
    dispatch({ type: 'SET_INTEL', payload: intel })
  }

  const clearIntel = async () => {
    await storage.clearCurrentIntel()
    dispatch({ type: 'CLEAR_INTEL' })
  }

  const setApiKeys = async (keys: Partial<ApiKeys>) => {
    const newKeys = { ...state.apiKeys, ...keys }
    await storage.saveApiKeys(newKeys)
    dispatch({ type: 'SET_API_KEYS', payload: keys })
  }

  const hasApiKeys = () => {
    return !!(state.apiKeys.assemblyAI && state.apiKeys.elevenLabs)
  }

  const hasIntel = () => {
    return !!(state.currentIntel?.poem || state.currentIntel?.dictation)
  }

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        setIntel,
        clearIntel,
        setApiKeys,
        hasApiKeys,
        hasIntel,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}

