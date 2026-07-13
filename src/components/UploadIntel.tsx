import { useState } from 'react'
import type { EchoScreen } from '../App'
import { useApp } from '../context/AppContext'
import { storage } from '../services/storage'
import MainframeMessage from './ui/MainframeMessage'
import type { Intel, Passage } from '../types'

interface UploadIntelProps {
  onNavigate: (screen: EchoScreen | 'settings') => void
  onExit?: () => void
}

export default function UploadIntel({ onNavigate, onExit }: UploadIntelProps) {
  const { setIntel } = useApp()
  const [poemText, setPoemText] = useState('')
  const [poemTitle, setPoemTitle] = useState('')
  const [dictationText, setDictationText] = useState('')
  const [dictationTitle, setDictationTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!poemText.trim() && !dictationText.trim()) {
      setError('Please enter at least one passage (poem or dictation).')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const now = new Date()
      
      let poem: Passage | null = null
      let dictation: Passage | null = null

      if (poemText.trim()) {
        poem = {
          id: storage.generateId(),
          title: poemTitle.trim() || 'Untitled Poem',
          content: poemText.trim(),
          type: 'poem',
          createdAt: now,
          updatedAt: now,
        }
      }

      if (dictationText.trim()) {
        dictation = {
          id: storage.generateId(),
          title: dictationTitle.trim() || 'Untitled Dictation',
          content: dictationText.trim(),
          type: 'dictation',
          createdAt: now,
          updatedAt: now,
        }
      }

      const intel: Intel = {
        id: storage.generateId(),
        poem,
        dictation,
        createdAt: now,
      }

      await setIntel(intel)
      onNavigate('home')
    } catch (err) {
      setError('Failed to save intel. Please try again.')
      console.error('Save error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <header className="max-w-3xl mx-auto mb-6">
        <button
          onClick={() => (onExit ? onExit() : onNavigate('home'))}
          className="text-mainframe hover:text-mainframe-light transition-colors mb-4 flex items-center gap-2"
        >
          <span>←</span>
          <span>{onExit ? 'Back to Modules' : 'Return to Mission Control'}</span>
        </button>
        <h1 className="font-display text-3xl text-mainframe text-glow-mainframe">
          UPLOAD NEW INTEL
        </h1>
      </header>

      <main className="max-w-3xl mx-auto space-y-6">
        <MainframeMessage
          message="Paste your training materials below, Agent. The poem is for Protocol A (Voice Lock) recitation training. The dictation passage is for Protocol B (Logic Bomb) spelling missions."
          showTyping={false}
        />

        {error && (
          <div className="p-4 bg-danger/10 border border-danger/50 rounded-lg text-danger">
            {error}
          </div>
        )}

        {/* Poem Input */}
        <div className="card">
          <h2 className="font-display text-xl text-mainframe mb-4 flex items-center gap-2">
            <span>🎤</span>
            PROTOCOL A: RECITATION PASSAGE
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Paste a poem, scripture, or passage for memorization and recitation practice.
          </p>
          
          <input
            type="text"
            value={poemTitle}
            onChange={(e) => setPoemTitle(e.target.value)}
            placeholder="Title (e.g., 'The Road Not Taken')"
            className="input-field mb-3"
          />
          
          <textarea
            value={poemText}
            onChange={(e) => setPoemText(e.target.value)}
            placeholder="Paste your poem or recitation passage here...

Example:
Two roads diverged in a yellow wood,
And sorry I could not travel both
And be one traveler, long I stood
And looked down one as far as I could
To where it bent in the undergrowth;"
            className="textarea-field min-h-[200px]"
          />
        </div>

        {/* Dictation Input */}
        <div className="card">
          <h2 className="font-display text-xl text-mainframe mb-4 flex items-center gap-2">
            <span>💣</span>
            PROTOCOL B: DICTATION PASSAGE
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Paste sentences or a paragraph for spelling and dictation practice.
          </p>
          
          <input
            type="text"
            value={dictationTitle}
            onChange={(e) => setDictationTitle(e.target.value)}
            placeholder="Title (e.g., 'Week 12 Dictation')"
            className="input-field mb-3"
          />
          
          <textarea
            value={dictationText}
            onChange={(e) => setDictationText(e.target.value)}
            placeholder="Paste your dictation sentences here...

Example:
The knight fought bravely through the night. Although the weather was frightening, he knew his conscience would not let him rest until he had fulfilled his duty."
            className="textarea-field min-h-[200px]"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 justify-end">
          <button
            onClick={() => onNavigate('home')}
            className="btn btn-glitch"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-solid"
            disabled={isSaving || (!poemText.trim() && !dictationText.trim())}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                Encrypting...
              </span>
            ) : (
              '📥 Save Intel'
            )}
          </button>
        </div>
      </main>
    </div>
  )
}


