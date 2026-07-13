import type { Screen } from '../../App'

interface ModuleHubProps {
  onNavigate: (screen: Screen) => void
}

export default function ModuleHub({ onNavigate }: ModuleHubProps) {
  return (
    <div className="min-h-screen p-6 flex flex-col">
      <header className="text-center mb-10">
        <h1 className="font-display text-4xl md:text-5xl text-mainframe text-glow-mainframe mb-2">
          Ace Mode
        </h1>
        <p className="text-gray-400 font-mono text-sm">
          Choose a study module to begin
        </p>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => onNavigate('tn-driver')}
            className="card text-left p-6 hover:border-sky-400/50 transition-colors group"
          >
            <span className="text-4xl mb-3 block">🚗</span>
            <h2 className="font-display text-xl text-sky-300 mb-2 group-hover:text-sky-200">
              Tennessee Driver Written Test
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-3">
              Study the official Driver License Manual with read-along narration.
              Based on Tennessee Class D licensing requirements.
            </p>
            <a
              href="https://www.tn.gov/safety/driver-services/classd/teengdl.html"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-sky-400/80 hover:text-sky-300"
            >
              Teen GDL info →
            </a>
          </button>

          <button
            onClick={() => onNavigate('echo')}
            className="card text-left p-6 hover:border-mainframe/50 transition-colors group"
          >
            <span className="text-4xl mb-3 block">🖥️</span>
            <h2 className="font-display text-xl text-mainframe mb-2 group-hover:text-mainframe-light">
              Project ECHO
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Charlotte Mason recitation and dictation training with the Mainframe
              and Dr. Glitch.
            </p>
          </button>
        </div>

        <button
          onClick={() => onNavigate('settings')}
          className="btn w-full text-lg btn-glitch opacity-80 hover:opacity-100"
        >
          ⚙️ Settings
        </button>
      </main>

      <footer className="text-center mt-8 text-gray-600 text-sm font-mono">
        <p>[ SELECT A MODULE TO BEGIN ]</p>
      </footer>
    </div>
  )
}
