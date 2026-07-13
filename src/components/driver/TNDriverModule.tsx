import { useState, useEffect, useCallback } from 'react'
import type { Screen } from '../../App'
import { useApp } from '../../context/AppContext'
import type { DriverManualData, StudySection } from '../../types'
import { storage } from '../../services/storage'
import {
  extractTextFromPdf,
  fetchPdfAsArrayBuffer,
  readPdfFileAsArrayBuffer,
} from '../../services/pdfExtractor'
import { curateDriverManualText } from '../../services/driverManualCurator'
import {
  TN_DL_MANUAL_PDF_URL,
  TN_TEEN_GDL_URL,
  DRIVER_MANUAL_CURATOR_VERSION,
} from '../../constants/tennesseeDriver'
import { normalizeDriverManual } from '../../utils/normalizeDriverManual'
import ManualSetup from './ManualSetup'
import SectionList from './SectionList'
import SectionReader from './SectionReader'

type DriverScreen = 'setup' | 'sections' | 'reader'

interface TNDriverModuleProps {
  onNavigate: (screen: Screen) => void
}

export default function TNDriverModule({ onNavigate }: TNDriverModuleProps) {
  const { state } = useApp()
  const [driverScreen, setDriverScreen] = useState<DriverScreen>('setup')
  const [manual, setManual] = useState<DriverManualData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    storage.getDriverManual().then((saved) => {
      if (saved && saved.sections?.length > 0) {
        setManual(normalizeDriverManual(saved))
        setDriverScreen('sections')
      }
    }).catch((err) => {
      console.error('Failed to load saved driver manual:', err)
      setError('Could not load saved study guide. Try reloading the manual.')
    })
  }, [])

  const processPdfBuffer = useCallback(async (buffer: ArrayBuffer, sourceUrl: string) => {
    setIsProcessing(true)
    setError(null)
    setStatusMessage('Extracting text from PDF…')

    try {
      const rawText = await extractTextFromPdf(buffer)
      if (rawText.length < 500) {
        throw new Error('Could not extract enough text from this PDF.')
      }

      const { sections, aiCurated } = await curateDriverManualText(rawText, {
        onProgress: setStatusMessage,
      })

      if (sections.length === 0) {
        throw new Error('No study sections found. Try uploading the official manual PDF.')
      }

      const manualData: DriverManualData = {
        id: storage.generateId(),
        sourceUrl,
        processedAt: new Date(),
        curatorVersion: DRIVER_MANUAL_CURATOR_VERSION,
        aiCurated,
        sections,
        currentSectionIndex: 0,
      }

      await storage.saveDriverManual(manualData)
      setManual(manualData)
      setDriverScreen('sections')
      setStatusMessage(
        `Ready — ${sections.length} study sections extracted from Section B.`
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process PDF.'
      setError(message)
      setStatusMessage(null)
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleFetchOfficial = async () => {
    setError(null)
    try {
      setStatusMessage('Downloading official Tennessee manual…')
      const buffer = await fetchPdfAsArrayBuffer(TN_DL_MANUAL_PDF_URL)
      await processPdfBuffer(buffer, TN_DL_MANUAL_PDF_URL)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed.'
      setError(message)
      setStatusMessage(null)
    }
  }

  const handleUpload = async (file: File) => {
    setError(null)
    try {
      const buffer = await readPdfFileAsArrayBuffer(file)
      await processPdfBuffer(buffer, file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    }
  }

  const handleSelectSection = async (index: number) => {
    if (!manual) return
    const updated = { ...manual, currentSectionIndex: index }
    setManual(updated)
    await storage.saveDriverManual(updated)
    setDriverScreen('reader')
  }

  const handleSectionChange = async (index: number) => {
    if (!manual) return
    const updated = { ...manual, currentSectionIndex: index }
    setManual(updated)
    await storage.saveDriverManual(updated)
  }

  const handleResetManual = async () => {
    await storage.clearDriverManual()
    setManual(null)
    setDriverScreen('setup')
    setError(null)
    setStatusMessage(null)
  }

  const currentSection: StudySection | null =
    manual?.sections[manual.currentSectionIndex] ?? null

  if (driverScreen === 'reader' && manual && currentSection) {
    return (
      <SectionReader
        key={currentSection.id}
        manual={manual}
        section={currentSection}
        apiKeys={state.apiKeys}
        onBack={() => setDriverScreen('sections')}
        onSectionChange={handleSectionChange}
      />
    )
  }

  if (driverScreen === 'sections' && manual) {
    return (
      <SectionList
        manual={manual}
        onSelectSection={handleSelectSection}
        onBack={() => onNavigate('hub')}
        onReset={handleResetManual}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <ManualSetup
      onNavigate={onNavigate}
      onFetchOfficial={handleFetchOfficial}
      onUpload={handleUpload}
      isProcessing={isProcessing}
      error={error}
      statusMessage={statusMessage}
      teenGdlUrl={TN_TEEN_GDL_URL}
      manualPdfUrl={TN_DL_MANUAL_PDF_URL}
    />
  )
}
