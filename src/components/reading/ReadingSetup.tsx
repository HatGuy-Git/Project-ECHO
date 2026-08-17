import type { Screen } from '../../App'

interface ReadingSetupProps {
  onNavigate: (screen: Screen) => void
  onUpload: (file: File) => void
  isProcessing: boolean
  error: string | null
  statusMessage: string | null
  hasElevenLabsKey: boolean
  hasTextract: boolean
}

export default function ReadingSetup({
  onNavigate,
  onUpload,
  isProcessing,
  error,
  statusMessage,
  hasElevenLabsKey,
  hasTextract,
}: ReadingSetupProps) {
  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto mb-6">
        <button
          onClick={() => onNavigate('hub')}
          className="text-amber-300 hover:text-amber-200 transition-colors mb-4 flex items-center gap-2"
        >
          <span>←</span>
          <span>Back to Modules</span>
        </button>
        <h1 className="font-display text-3xl text-amber-300 mb-2">📖 Assisted Reading</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          Upload a PDF. The app extracts the text, OCRs photographed or scanned pages
          with AWS Textract when the container can reach AWS, then reads it aloud with
          word-by-word highlighting.
        </p>
      </header>

      <main className="max-w-2xl mx-auto space-y-6">
        {!hasTextract && (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
            Textract is off until this app can reach AWS. Put only{' '}
            <code>AWS_ACCESS_KEY_ID</code> / <code>AWS_SECRET_ACCESS_KEY</code> in{' '}
            <code>.env</code> (or run via Docker), then restart. Other keys come from
            Secrets Manager (<code>ace-mode/config</code>). Without that, in-browser OCR is used.
          </div>
        )}

        {!hasElevenLabsKey && (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
            ElevenLabs is not loaded yet. Add <code>ELEVENLABS_API_KEY</code> to the{' '}
            <code>ace-mode/config</code> secret in AWS, then restart the app. You can
            still extract a PDF without narration.
          </div>
        )}

        <div className="card border-amber-400/20">
          <h2 className="font-display text-lg text-amber-300 mb-3">Upload a PDF</h2>
          <p className="text-gray-400 text-sm mb-4">
            Text-based PDFs extract instantly. Photographed or scanned pages use{' '}
            {hasTextract ? 'AWS Textract' : 'in-browser OCR (add AWS IAM keys for Textract)'}.
          </p>

          <label className="btn btn-solid w-full cursor-pointer flex items-center justify-center">
            {isProcessing ? 'Processing…' : '📁 Upload PDF'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={isProcessing}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onUpload(file)
              }}
            />
          </label>
        </div>

        {statusMessage && (
          <div className="p-4 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-100 text-sm">
            {statusMessage}
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
            {error}
          </div>
        )}

        <div className="card bg-void-lighter/50 border-gray-700">
          <h3 className="font-display text-gray-300 mb-2">What happens next</h3>
          <ul className="text-gray-400 text-sm space-y-2 list-disc list-inside">
            <li>Text is extracted from each page; scanned pages use AWS Textract when IAM keys are set</li>
            <li>The document is split into short reading chunks for narration</li>
            <li>ElevenLabs reads the words aloud while they highlight on screen</li>
            <li>Use play/pause, speed, and voice controls while following along</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
