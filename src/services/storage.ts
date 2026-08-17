import Dexie, { type EntityTable } from 'dexie'
import type { Intel, ApiKeys, Passage, RecitationProgress, DictationProgress, DriverManualData, ReadingDocument } from '../types'

// Define the database schema
interface PassageRecord {
  id: string
  title: string
  content: string
  type: 'poem' | 'dictation'
  createdAt: Date
  updatedAt: Date
}

interface IntelRecord {
  id: string
  poemId: string | null
  dictationId: string | null
  createdAt: Date
  isCurrent: number // 1 for current, 0 for archived (indexed boolean)
}

interface SettingsRecord {
  key: string
  value: string
}

// Create the database
const db = new Dexie('ProjectEchoDB') as Dexie & {
  passages: EntityTable<PassageRecord, 'id'>
  intel: EntityTable<IntelRecord, 'id'>
  settings: EntityTable<SettingsRecord, 'key'>
}

db.version(1).stores({
  passages: 'id, type, createdAt',
  intel: 'id, isCurrent, createdAt',
  settings: 'key',
})

const API_KEY_SETTINGS = [
  'assemblyAI',
  'elevenLabs',
  'elevenLabsVoiceId',
  'mainframeVoiceId',
  'drGlitchVoiceId',
  'tutorVoiceId',
  'bedrockAccessKeyId',
  'bedrockSecretAccessKey',
  'bedrockSessionToken',
  'bedrockApiKey',
  'bedrockRegion',
  'bedrockModelId',
] as const

// Storage service
export const storage = {
  // Intel operations
  async saveIntel(intel: Intel): Promise<void> {
    // Clear any existing current intel
    await db.intel.where('isCurrent').equals(1).modify({ isCurrent: 0 })
    
    // Save passages if they exist
    if (intel.poem) {
      await db.passages.put({
        ...intel.poem,
        createdAt: intel.poem.createdAt,
        updatedAt: intel.poem.updatedAt,
      })
    }
    
    if (intel.dictation) {
      await db.passages.put({
        ...intel.dictation,
        createdAt: intel.dictation.createdAt,
        updatedAt: intel.dictation.updatedAt,
      })
    }
    
    // Save intel record
    await db.intel.put({
      id: intel.id,
      poemId: intel.poem?.id || null,
      dictationId: intel.dictation?.id || null,
      createdAt: intel.createdAt,
      isCurrent: 1,
    })
  },

  async getCurrentIntel(): Promise<Intel | null> {
    const intelRecord = await db.intel.where('isCurrent').equals(1).first()
    if (!intelRecord) return null
    
    let poem: Passage | null = null
    let dictation: Passage | null = null
    
    if (intelRecord.poemId) {
      const poemRecord = await db.passages.get(intelRecord.poemId)
      if (poemRecord) {
        poem = poemRecord
      }
    }
    
    if (intelRecord.dictationId) {
      const dictationRecord = await db.passages.get(intelRecord.dictationId)
      if (dictationRecord) {
        dictation = dictationRecord
      }
    }
    
    return {
      id: intelRecord.id,
      poem,
      dictation,
      createdAt: intelRecord.createdAt,
    }
  },

  async clearCurrentIntel(): Promise<void> {
    await db.intel.where('isCurrent').equals(1).modify({ isCurrent: 0 })
  },

  // API Keys operations
  async saveApiKeys(keys: ApiKeys): Promise<void> {
    const entries = API_KEY_SETTINGS.map(key => ({
      key,
      value: keys[key] || '',
    }))
    
    await db.settings.bulkPut(entries)
  },

  async getApiKeys(): Promise<ApiKeys | null> {
    const records = await db.settings.bulkGet([...API_KEY_SETTINGS])
    
    if (!records.some(r => r?.value)) {
      return null
    }
    
    return {
      assemblyAI: records[0]?.value || null,
      elevenLabs: records[1]?.value || null,
      elevenLabsVoiceId: records[2]?.value || null,
      mainframeVoiceId: records[3]?.value || null,
      drGlitchVoiceId: records[4]?.value || null,
      tutorVoiceId: records[5]?.value || null,
      bedrockAccessKeyId: records[6]?.value || null,
      bedrockSecretAccessKey: records[7]?.value || null,
      bedrockSessionToken: records[8]?.value || null,
      bedrockApiKey: records[9]?.value || null,
      bedrockRegion: records[10]?.value || null,
      bedrockModelId: records[11]?.value || null,
    }
  },

  async saveDriverManual(manual: DriverManualData): Promise<void> {
    await db.settings.put({
      key: 'driverManual',
      value: JSON.stringify({
        ...manual,
        processedAt: manual.processedAt.toISOString(),
      }),
    })
  },

  async getDriverManual(): Promise<DriverManualData | null> {
    const record = await db.settings.get('driverManual')
    if (!record?.value) return null
    try {
      const parsed = JSON.parse(record.value) as DriverManualData & { processedAt: string }
      return {
        ...parsed,
        processedAt: new Date(parsed.processedAt),
      }
    } catch {
      return null
    }
  },

  async clearDriverManual(): Promise<void> {
    await db.settings.put({ key: 'driverManual', value: '' })
  },

  async saveReadingDocument(document: ReadingDocument): Promise<void> {
    await db.settings.put({
      key: 'readingDocument',
      value: JSON.stringify({
        ...document,
        processedAt: document.processedAt.toISOString(),
      }),
    })
  },

  async getReadingDocument(): Promise<ReadingDocument | null> {
    const record = await db.settings.get('readingDocument')
    if (!record?.value) return null
    try {
      const parsed = JSON.parse(record.value) as ReadingDocument & { processedAt: string }
      return {
        ...parsed,
        processedAt: new Date(parsed.processedAt),
      }
    } catch {
      return null
    }
  },

  async clearReadingDocument(): Promise<void> {
    await db.settings.put({ key: 'readingDocument', value: '' })
  },

  // Training progress
  async saveRecitationProgress(progress: RecitationProgress | null): Promise<void> {
    await db.settings.put({
      key: 'recitationProgress',
      value: progress ? JSON.stringify(progress) : '',
    })
  },

  async getRecitationProgress(): Promise<RecitationProgress | null> {
    const record = await db.settings.get('recitationProgress')
    if (!record?.value) return null
    try {
      return JSON.parse(record.value) as RecitationProgress
    } catch {
      return null
    }
  },

  async saveDictationProgress(progress: DictationProgress | null): Promise<void> {
    await db.settings.put({
      key: 'dictationProgress',
      value: progress ? JSON.stringify(progress) : '',
    })
  },

  async getDictationProgress(): Promise<DictationProgress | null> {
    const record = await db.settings.get('dictationProgress')
    if (!record?.value) return null
    try {
      return JSON.parse(record.value) as DictationProgress
    } catch {
      return null
    }
  },

  async clearProgress(): Promise<void> {
    await db.settings.bulkPut([
      { key: 'recitationProgress', value: '' },
      { key: 'dictationProgress', value: '' },
    ])
  },

  // Utility to generate unique IDs
  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },
}

export default db
