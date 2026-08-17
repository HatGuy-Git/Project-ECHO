import { useCallback, useEffect, useState } from 'react'
import type { Screen } from '../../App'
import { useApp } from '../../context/AppContext'
import type { ReadingDocument } from '../../types'
import { storage } from '../../services/storage'
import { extractPdfPages, readPdfFileAsArrayBuffer } from '../../services/pdfExtractor'
import { buildReadingDocument } from '../../services/readingDocument'
import { fetchRuntimeConfig } from '../../types/runtimeConfig'
import ReadingSetup from './ReadingSetup'
import ReadingReader from './ReadingReader'

interface ReadingModuleProps {
  onNavigate: (screen: Screen) => void
}

export default function ReadingModule({ onNavigate }: ReadingModuleProps) {
  const { state } = useApp()
  const [document, setDocument] = useState<ReadingDocument | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [hasTextract, setHasTextract] = useState(false)
  const [hasServerElevenLabs, setHasServerElevenLabs] = useState(false)

  useEffect(() => {
    fetchRuntimeConfig().then((config) => {
      setHasTextract(Boolean(config?.services.textract))
      setHasServerElevenLabs(Boolean(config?.services.elevenLabs))
    })

    storage
      .getReadingDocument()
      .then((saved) => {
        if (saved && saved.chunks?.length > 0) {
          setDocument(saved)
        }
      })
      .catch((err) => {
        console.error('Failed to load saved reading document:', err)
        setError('Could not load the saved reading. Try uploading the PDF again.')
      })
  }, [])

  const handleUpload = useCallback(async (file: File) => {
    setIsProcessing(true)
    setError(null)
    setStatusMessage('Extracting text from PDF…')

    try {
      const buffer = await readPdfFileAsArrayBuffer(file)
      const pages = await extractPdfPages(buffer, {
        onProgress: setStatusMessage,
        ocrIfNeeded: true,
        textract: hasTextract,
      })

      const next = buildReadingDocument(pages, file.name)
      next.voiceId =
        state.apiKeys.tutorVoiceId || state.apiKeys.elevenLabsVoiceId || null

      await storage.saveReadingDocument(next)
      setDocument(next)
      setStatusMessage(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process PDF.')
      setStatusMessage(null)
    } finally {
      setIsProcessing(false)
    }
  }, [hasTextract, state.apiKeys.elevenLabsVoiceId, state.apiKeys.tutorVoiceId])

  const handleChunkChange = async (index: number) => {
    if (!document) return
    if (index < 0 || index >= document.chunks.length) return
    const updated = { ...document, currentChunkIndex: index }
    setDocument(updated)
    await storage.saveReadingDocument(updated)
  }

  const handleVoiceChange = async (voiceId: string) => {
    if (!document) return
    const updated = { ...document, voiceId }
    setDocument(updated)
    await storage.saveReadingDocument(updated)
  }

  const handleReset = async () => {
    await storage.clearReadingDocument()
    setDocument(null)
    setError(null)
    setStatusMessage(null)
  }

  if (document && document.chunks.length > 0) {
    return (
      <ReadingReader
        key={`${document.id}:${document.chunks[document.currentChunkIndex]?.id}:${document.voiceId ?? 'default'}`}
        document={document}
        apiKeys={state.apiKeys}
        onBack={() => onNavigate('hub')}
        onNavigate={onNavigate}
        onChunkChange={handleChunkChange}
        onVoiceChange={handleVoiceChange}
        onReset={handleReset}
      />
    )
  }

  return (
    <ReadingSetup
      onNavigate={onNavigate}
      onUpload={handleUpload}
      isProcessing={isProcessing}
      error={error}
      statusMessage={statusMessage}
      hasElevenLabsKey={hasServerElevenLabs || !!state.apiKeys.elevenLabs}
      hasTextract={hasTextract}
    />
  )
}
