// Core data types for Project ECHO

export interface Passage {
  id: string
  title: string
  content: string
  type: 'poem' | 'dictation'
  createdAt: Date
  updatedAt: Date
}

export interface Intel {
  id: string
  poem: Passage | null
  dictation: Passage | null
  createdAt: Date
}

export interface ApiKeys {
  assemblyAI: string | null
  elevenLabs: string | null
  elevenLabsVoiceId: string | null // Legacy: general voice ID
  mainframeVoiceId: string | null  // Voice for the Mainframe character
  drGlitchVoiceId: string | null   // Voice for Dr. Glitch villain
}

export interface RecitationProgress {
  intelId: string
  currentStep: RecitationStep
  currentStanza: number
  totalStanzas: number
  currentRep: number
  repsRequired: number
  sectorsCleared: number
}

export type RecitationStep = 
  | 'signal-sync'      // Step 1: Read along
  | 'blind-transmission' // Step 2: Repeat without seeing
  | 'sector-clearance'  // Step 3: Solo stanza
  | 'master-broadcast'  // Step 4: Full recitation
  | 'complete'

export interface DictationProgress {
  intelId: string
  currentPhase: DictationPhase
  currentSentenceIndex: number
  totalSentences: number
  correctCount: number
  incorrectWords: string[]
}

export type DictationPhase = 
  | 'study'   // Show the sentence
  | 'hide'    // Data hidden overlay
  | 'input'   // Type what you hear
  | 'check'   // Compare and show results
  | 'complete'

export interface TranscriptionResult {
  text: string
  confidence: number
  success: boolean
  error?: string
}

export interface TTSOptions {
  voiceId?: string
  modelId?: string
  speed?: number // 0.5 to 2.0
  stability?: number // 0 to 1
  similarityBoost?: number // 0 to 1
}

export interface TranscriptionOptions {
  /** Expected text — used to build keyterms for improved accuracy */
  expectedText?: string
  keyterms?: string[]
}

export interface ComparisonResult {
  isMatch: boolean
  matchPercentage: number
  originalWords: string[]
  inputWords: string[]
  wordResults: WordComparison[]
}

export interface WordComparison {
  original: string
  input: string | null
  isCorrect: boolean
  isMissing: boolean
  isExtra: boolean
}

// Character message types
export type CharacterType = 'mainframe' | 'glitch'

export interface CharacterMessage {
  character: CharacterType
  message: string
  timestamp: Date
}

