import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import type { Intel, ApiKeys, RecitationProgress, DictationProgress } from '../types'
import { storage } from '../services/storage'
import {
  DEFAULT_BEDROCK_MODEL,
  DEFAULT_BEDROCK_REGION,
} from '../constants/bedrock'

// Environment variable defaults (set in .env file)
const ENV_API_KEYS: ApiKeys = {
  assemblyAI: import.meta.env.VITE_ASSEMBLYAI_API_KEY || null,
  elevenLabs: import.meta.env.VITE_ELEVENLABS_API_KEY || null,
  elevenLabsVoiceId: null,
  mainframeVoiceId: import.meta.env.VITE_MAINFRAME_VOICE_ID || null,
  drGlitchVoiceId: import.meta.env.VITE_DR_GLITCH_VOICE_ID || null,
  tutorVoiceId: import.meta.env.VITE_TUTOR_VOICE_ID || null,
  bedrockAccessKeyId: import.meta.env.VITE_BEDROCK_ACCESS_KEY_ID || null,
  bedrockSecretAccessKey: import.meta.env.VITE_BEDROCK_SECRET_ACCESS_KEY || null,
  bedrockSessionToken: import.meta.env.VITE_BEDROCK_SESSION_TOKEN || null,
  bedrockApiKey: import.meta.env.VITE_BEDROCK_API_KEY || null,
  bedrockRegion: import.meta.env.VITE_BEDROCK_REGION || DEFAULT_BEDROCK_REGION,
  bedrockModelId: import.meta.env.VITE_BEDROCK_MODEL_ID || DEFAULT_BEDROCK_MODEL,
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
  apiKeys: ENV_API_KEYS,
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
  setRecitationProgress: (progress: RecitationProgress | null) => Promise<void>
  setDictationProgress: (progress: DictationProgress | null) => Promise<void>
  hasApiKeys: () => boolean
  hasIntel: () => boolean
  hasActiveRecitation: () => boolean
  hasActiveDictation: () => boolean
}

const AppContext = createContext<AppContextType | null>(null)

function isActiveRecitation(progress: RecitationProgress | null, intelId: string | undefined): boolean {
  return !!(
    progress &&
    intelId &&
    progress.intelId === intelId &&
    progress.currentStep !== 'complete'
  )
}

function isActiveDictation(progress: DictationProgress | null, intelId: string | undefined): boolean {
  return !!(
    progress &&
    intelId &&
    progress.intelId === intelId &&
    progress.currentPhase !== 'complete'
  )
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // Load saved state on mount
  useEffect(() => {
    async function loadSavedState() {
      try {
        const [savedIntel, savedApiKeys, savedRecitation, savedDictation] = await Promise.all([
          storage.getCurrentIntel(),
          storage.getApiKeys(),
          storage.getRecitationProgress(),
          storage.getDictationProgress(),
        ])
        
        const mergedApiKeys: ApiKeys = {
          assemblyAI: savedApiKeys?.assemblyAI || ENV_API_KEYS.assemblyAI,
          elevenLabs: savedApiKeys?.elevenLabs || ENV_API_KEYS.elevenLabs,
          elevenLabsVoiceId: savedApiKeys?.elevenLabsVoiceId || ENV_API_KEYS.elevenLabsVoiceId,
          mainframeVoiceId: savedApiKeys?.mainframeVoiceId || ENV_API_KEYS.mainframeVoiceId,
          drGlitchVoiceId: savedApiKeys?.drGlitchVoiceId || ENV_API_KEYS.drGlitchVoiceId,
          tutorVoiceId: savedApiKeys?.tutorVoiceId || ENV_API_KEYS.tutorVoiceId,
          bedrockAccessKeyId: savedApiKeys?.bedrockAccessKeyId || ENV_API_KEYS.bedrockAccessKeyId,
          bedrockSecretAccessKey:
            savedApiKeys?.bedrockSecretAccessKey || ENV_API_KEYS.bedrockSecretAccessKey,
          bedrockSessionToken:
            savedApiKeys?.bedrockSessionToken || ENV_API_KEYS.bedrockSessionToken,
          bedrockApiKey: savedApiKeys?.bedrockApiKey || ENV_API_KEYS.bedrockApiKey,
          bedrockRegion: savedApiKeys?.bedrockRegion || ENV_API_KEYS.bedrockRegion,
          bedrockModelId: savedApiKeys?.bedrockModelId || ENV_API_KEYS.bedrockModelId,
        }

        // Discard progress that doesn't match current intel
        const intelId = savedIntel?.id
        const recitationProgress = isActiveRecitation(savedRecitation, intelId) ? savedRecitation : null
        const dictationProgress = isActiveDictation(savedDictation, intelId) ? savedDictation : null
        
        dispatch({
          type: 'LOAD_STATE',
          payload: {
            currentIntel: savedIntel,
            apiKeys: mergedApiKeys,
            recitationProgress,
            dictationProgress,
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
    // New intel resets training progress
    await storage.clearProgress()
    dispatch({ type: 'SET_INTEL', payload: intel })
    dispatch({ type: 'SET_RECITATION_PROGRESS', payload: null })
    dispatch({ type: 'SET_DICTATION_PROGRESS', payload: null })
  }

  const clearIntel = async () => {
    await storage.clearCurrentIntel()
    await storage.clearProgress()
    dispatch({ type: 'CLEAR_INTEL' })
  }

  const setApiKeys = async (keys: Partial<ApiKeys>) => {
    const newKeys = { ...state.apiKeys, ...keys }
    await storage.saveApiKeys(newKeys)
    dispatch({ type: 'SET_API_KEYS', payload: keys })
  }

  const setRecitationProgress = async (progress: RecitationProgress | null) => {
    await storage.saveRecitationProgress(progress)
    dispatch({ type: 'SET_RECITATION_PROGRESS', payload: progress })
  }

  const setDictationProgress = async (progress: DictationProgress | null) => {
    await storage.saveDictationProgress(progress)
    dispatch({ type: 'SET_DICTATION_PROGRESS', payload: progress })
  }

  const hasApiKeys = () => {
    return !!(state.apiKeys.assemblyAI && state.apiKeys.elevenLabs)
  }

  const hasIntel = () => {
    return !!(state.currentIntel?.poem || state.currentIntel?.dictation)
  }

  const hasActiveRecitation = () => {
    return isActiveRecitation(state.recitationProgress, state.currentIntel?.id)
  }

  const hasActiveDictation = () => {
    return isActiveDictation(state.dictationProgress, state.currentIntel?.id)
  }

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        setIntel,
        clearIntel,
        setApiKeys,
        setRecitationProgress,
        setDictationProgress,
        hasApiKeys,
        hasIntel,
        hasActiveRecitation,
        hasActiveDictation,
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
