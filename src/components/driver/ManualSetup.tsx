import type { Screen } from '../../App'

interface ManualSetupProps {
  onNavigate: (screen: Screen) => void
  onFetchOfficial: () => void
  onUpload: (file: File) => void
  isProcessing: boolean
  error: string | null
  statusMessage: string | null
  teenGdlUrl: string
  manualPdfUrl: string
}

export default function ManualSetup({
  onNavigate,
  onFetchOfficial,
  onUpload,
  isProcessing,
  error,
  statusMessage,
  teenGdlUrl,
  manualPdfUrl,
}: ManualSetupProps) {
  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto mb-6">
        <button
          onClick={() => onNavigate('hub')}
          className="text-sky-300 hover:text-sky-200 transition-colors mb-4 flex items-center gap-2"
        >
          <span>←</span>
          <span>Back to Modules</span>
        </button>
        <h1 className="font-display text-3xl text-sky-300 mb-2">
          🚗 Tennessee Driver Written Test
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          Load the official Tennessee Driver License Manual. The app reads the full PDF,
          isolates <strong>Section B</strong>, splits it into chapters and subsections, and
          preserves the complete study text for the written knowledge test.
        </p>
      </header>

      <main className="max-w-2xl mx-auto space-y-6">
        <div className="card border-sky-400/20">
          <h2 className="font-display text-lg text-sky-300 mb-3">Official Manual</h2>
          <p className="text-gray-400 text-sm mb-4">
            <a
              href={manualPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:text-sky-300"
            >
              Tennessee Driver License Manual (PDF)
            </a>
            {' · '}
            <a
              href={teenGdlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:text-sky-300"
            >
              Teen GDL requirements
            </a>
          </p>

          <label className="btn btn-solid w-full cursor-pointer flex items-center justify-center mb-3">
            📁 Upload PDF Manually (recommended)
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

          <button
            onClick={onFetchOfficial}
            disabled={isProcessing}
            className="btn w-full border-gray-600 text-gray-300"
          >
            {isProcessing ? 'Processing…' : '⬇️ Try automatic download'}
          </button>
        </div>

        <div className="card bg-void-lighter/50 border-gray-700">
          <h3 className="font-display text-gray-300 mb-2">Manual upload steps</h3>
          <ol className="text-gray-400 text-sm space-y-2 list-decimal list-inside">
            <li>
              Open{' '}
              <a
                href={manualPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:text-sky-300"
              >
                Tennessee Driver License Manual (PDF)
              </a>{' '}
              in a new tab
            </li>
            <li>Save the file as <strong>DL_Manual.pdf</strong> on your computer</li>
            <li>Click <strong>Upload PDF Manually</strong> above and select that file</li>
          </ol>
        </div>

        {statusMessage && (
          <div className="p-4 rounded-lg bg-sky-400/10 border border-sky-400/30 text-sky-200 text-sm">
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
            <li>Full text is extracted from the PDF locally in your browser</li>
            <li>Section B is identified and split into all 8 written-test chapters</li>
            <li>Each chapter is broken into subsections with the complete manual text preserved</li>
            <li>Read-along narration with word-by-word highlighting and playback controls</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
