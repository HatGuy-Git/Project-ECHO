import Dexie, { type EntityTable } from 'dexie'
import type { Intel, ApiKeys, Passage } from '../types'

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
    const entries = [
      { key: 'assemblyAI', value: keys.assemblyAI || '' },
      { key: 'elevenLabs', value: keys.elevenLabs || '' },
      { key: 'elevenLabsVoiceId', value: keys.elevenLabsVoiceId || '' },
    ]
    
    await db.settings.bulkPut(entries)
  },

  async getApiKeys(): Promise<ApiKeys | null> {
    const records = await db.settings.bulkGet(['assemblyAI', 'elevenLabs', 'elevenLabsVoiceId'])
    
    if (!records.some(r => r?.value)) {
      return null
    }
    
    return {
      assemblyAI: records[0]?.value || null,
      elevenLabs: records[1]?.value || null,
      elevenLabsVoiceId: records[2]?.value || null,
    }
  },

  // Utility to generate unique IDs
  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },
}

export default db


