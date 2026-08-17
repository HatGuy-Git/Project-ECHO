import { useState, useEffect } from 'react'
import type { Screen } from '../App'
import { useApp } from '../context/AppContext'
import MainframeMessage from './ui/MainframeMessage'
import { CHARACTER_VOICES, TUTOR_VOICE } from '../services/textToSpeech'
import {
  DEFAULT_BEDROCK_MODEL,
  DEFAULT_BEDROCK_REGION,
} from '../constants/bedrock'
import { fetchRuntimeConfig, type RuntimeConfig } from '../types/runtimeConfig'

interface SettingsProps {
  onNavigate: (screen: Screen) => void
  returnTo?: Screen
}

export default function Settings({ onNavigate, returnTo = 'hub' }: SettingsProps) {
  const { state, setApiKeys } = useApp()
  
  const [assemblyAIKey, setAssemblyAIKey] = useState('')
  const [elevenLabsKey, setElevenLabsKey] = useState('')
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState('')
  const [mainframeVoiceId, setMainframeVoiceId] = useState('')
  const [drGlitchVoiceId, setDrGlitchVoiceId] = useState('')
  const [tutorVoiceId, setTutorVoiceId] = useState('')
  const [bedrockAccessKeyId, setBedrockAccessKeyId] = useState('')
  const [bedrockSecretAccessKey, setBedrockSecretAccessKey] = useState('')
  const [bedrockSessionToken, setBedrockSessionToken] = useState('')
  const [bedrockApiKey, setBedrockApiKey] = useState('')
  const [bedrockRegion, setBedrockRegion] = useState(DEFAULT_BEDROCK_REGION)
  const [bedrockModelId, setBedrockModelId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [runtime, setRuntime] = useState<RuntimeConfig | null>(null)

  // Load existing keys
  useEffect(() => {
    setAssemblyAIKey(state.apiKeys.assemblyAI || '')
    setElevenLabsKey(state.apiKeys.elevenLabs || '')
    setElevenLabsVoiceId(state.apiKeys.elevenLabsVoiceId || '')
    setMainframeVoiceId(state.apiKeys.mainframeVoiceId || '')
    setDrGlitchVoiceId(state.apiKeys.drGlitchVoiceId || '')
    setTutorVoiceId(state.apiKeys.tutorVoiceId || '')
    setBedrockAccessKeyId(state.apiKeys.bedrockAccessKeyId || '')
    setBedrockSecretAccessKey(state.apiKeys.bedrockSecretAccessKey || '')
    setBedrockSessionToken(state.apiKeys.bedrockSessionToken || '')
    setBedrockApiKey(state.apiKeys.bedrockApiKey || '')
    setBedrockRegion(state.apiKeys.bedrockRegion || DEFAULT_BEDROCK_REGION)
    setBedrockModelId(state.apiKeys.bedrockModelId || '')
    fetchRuntimeConfig().then(setRuntime)
  }, [state.apiKeys])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      await setApiKeys({
        assemblyAI: assemblyAIKey.trim() || null,
        elevenLabs: elevenLabsKey.trim() || null,
        elevenLabsVoiceId: elevenLabsVoiceId.trim() || null,
        mainframeVoiceId: mainframeVoiceId.trim() || null,
        drGlitchVoiceId: drGlitchVoiceId.trim() || null,
        tutorVoiceId: tutorVoiceId.trim() || null,
        bedrockAccessKeyId: bedrockAccessKeyId.trim() || null,
        bedrockSecretAccessKey: bedrockSecretAccessKey.trim() || null,
        bedrockSessionToken: bedrockSessionToken.trim() || null,
        bedrockApiKey: bedrockApiKey.trim() || null,
        bedrockRegion: bedrockRegion.trim() || DEFAULT_BEDROCK_REGION,
        bedrockModelId: bedrockModelId.trim() || null,
      })
      setSaveMessage('Settings saved successfully!')
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      setSaveMessage('Failed to save settings.')
      console.error('Save error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const isConfigured = assemblyAIKey.trim() && elevenLabsKey.trim()

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <header className="max-w-2xl mx-auto mb-6">
        <button
          onClick={() => onNavigate(returnTo)}
          className="text-mainframe hover:text-mainframe-light transition-colors mb-4 flex items-center gap-2"
        >
          <span>←</span>
          <span>Back</span>
        </button>
        <h1 className="font-display text-3xl text-mainframe text-glow-mainframe">
          ⚙️ SETTINGS
        </h1>
      </header>

      <main className="max-w-2xl mx-auto space-y-6">
        <MainframeMessage
          message="Ace Mode uses the same AWS pattern as Continuum: only AWS credentials live on this machine. ElevenLabs and other keys are loaded from Secrets Manager."
          showTyping={false}
        />

        <div className="card border-sky-400/20">
          <h2 className="font-display text-xl text-sky-300 mb-2">AWS runtime</h2>
          <p className="text-gray-400 text-sm mb-3">
            Docker / <code>npm run dev</code> reads <code>AWS_ACCESS_KEY_ID</code> and{' '}
            <code>AWS_SECRET_ACCESS_KEY</code> from the environment, then loads{' '}
            <code>{runtime?.aws.secretName ?? 'ace-mode/config'}</code>.
          </p>
          <ul className="text-sm space-y-1 text-gray-300">
            <li>
              {runtime?.aws.hasEnvCredentials ? '✓' : '○'} AWS credentials in environment
            </li>
            <li>
              {runtime?.aws.secretsLoaded ? '✓' : '○'} Secrets Manager loaded
              {runtime?.aws.secretKeys?.length
                ? ` (${runtime.aws.secretKeys.join(', ')})`
                : ''}
            </li>
            <li>{runtime?.services.elevenLabs ? '✓' : '○'} ElevenLabs</li>
            <li>{runtime?.services.textract ? '✓' : '○'} Textract</li>
            <li>{runtime?.services.bedrock ? '✓' : '○'} Bedrock</li>
            <li>{runtime?.services.assemblyAI ? '✓' : '○'} AssemblyAI</li>
          </ul>
          {runtime?.aws.error && (
            <p className="text-sm text-danger mt-3">{runtime.aws.error}</p>
          )}
        </div>

        {/* AssemblyAI Settings */}
        <div className="card">
          <h2 className="font-display text-xl text-mainframe mb-2 flex items-center gap-2">
            <span>🎤</span>
            AssemblyAI (Speech Recognition)
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Used to understand your speech during recitation training.
            <a 
              href="https://www.assemblyai.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-mainframe hover:text-mainframe-light ml-1"
            >
              Get your API key →
            </a>
          </p>
          
          <input
            type="password"
            value={assemblyAIKey}
            onChange={(e) => setAssemblyAIKey(e.target.value)}
            placeholder="Enter your AssemblyAI API key"
            className="input-field font-mono"
          />
          
          {assemblyAIKey && (
            <p className="text-sm text-success mt-2 flex items-center gap-2">
              <span>✓</span> Key entered
            </p>
          )}
        </div>

        {/* ElevenLabs Settings */}
        <div className="card">
          <h2 className="font-display text-xl text-mainframe mb-2 flex items-center gap-2">
            <span>🔊</span>
            ElevenLabs (Text-to-Speech)
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Prefer storing <code>ELEVENLABS_API_KEY</code> in AWS Secrets Manager
            (<code>ace-mode/config</code>). This box is only an optional local override.
            <a 
              href="https://elevenlabs.io/app/settings/api-keys" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-mainframe hover:text-mainframe-light ml-1"
            >
              Create / copy key →
            </a>
          </p>
          
          <input
            type="password"
            value={elevenLabsKey}
            onChange={(e) => setElevenLabsKey(e.target.value)}
            placeholder="sk_… (secret key, shown only when created)"
            className="input-field font-mono mb-3"
            autoComplete="off"
          />

          {elevenLabsKey && !elevenLabsKey.trim().startsWith('sk_') && (
            <p className="text-sm text-danger mt-2">
              That looks like a Key ID, not the secret key. In ElevenLabs → API Keys,
              create or rotate a key and copy the value that starts with <code>sk_</code>.
              The Key ID in the table will not work.
            </p>
          )}
          
          {elevenLabsKey && elevenLabsKey.trim().startsWith('sk_') && (
            <p className="text-sm text-success mt-2 flex items-center gap-2">
              <span>✓</span> Secret key entered — click Save Settings at the bottom
            </p>
          )}
        </div>

        {/* Character Voice Settings */}
        <div className="card">
          <h2 className="font-display text-xl text-mainframe mb-4 flex items-center gap-2">
            <span>🎭</span>
            Character Voices
          </h2>
          
          {/* Mainframe Voice */}
          <div className="mb-6 p-4 bg-mainframe/5 border border-mainframe/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🖥️</span>
              <h3 className="font-display text-lg text-mainframe">MAINFRAME Voice</h3>
            </div>
            <p className="text-gray-400 text-sm mb-3">
              The authoritative AI that guides your training.
            </p>
            <input
              type="text"
              value={mainframeVoiceId}
              onChange={(e) => setMainframeVoiceId(e.target.value)}
              placeholder={`Voice ID (default: ${CHARACTER_VOICES.mainframe.defaultVoiceId})`}
              className="input-field font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              Recommended: Adam, Antoni, or any clear, robotic voice
            </p>
          </div>

          {/* Dr. Glitch Voice */}
          <div className="p-4 bg-glitch/5 border border-glitch/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⚡</span>
              <h3 className="font-display text-lg text-glitch">DR. GLITCH Voice</h3>
            </div>
            <p className="text-gray-400 text-sm mb-3">
              The menacing villain who disrupts your progress.
            </p>
            <input
              type="text"
              value={drGlitchVoiceId}
              onChange={(e) => setDrGlitchVoiceId(e.target.value)}
              placeholder={`Voice ID (default: ${CHARACTER_VOICES.glitch.defaultVoiceId})`}
              className="input-field font-mono text-sm border-glitch/30 focus:border-glitch"
            />
            <p className="text-xs text-gray-500 mt-2">
              Recommended: Arnold, Clyde, or any deeper, menacing voice
            </p>
          </div>

          {/* Tutor Voice (Driver module, read-along) */}
          <div className="mt-6 p-4 bg-sky-400/5 border border-sky-400/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🚗</span>
              <h3 className="font-display text-lg text-sky-300">TUTOR Voice</h3>
            </div>
            <p className="text-gray-400 text-sm mb-3">
              Warm, kind read-along narrator for Assisted Reading and Tennessee Driver Test prep.
            </p>
            <input
              type="text"
              value={tutorVoiceId}
              onChange={(e) => setTutorVoiceId(e.target.value)}
              placeholder={`Voice ID (default: Matilda — ${TUTOR_VOICE.defaultVoiceId})`}
              className="input-field font-mono text-sm"
            />
          </div>

          <p className="text-xs text-gray-500 mt-4">
            💡 Find voice IDs in your ElevenLabs dashboard under Voice Lab. Leave blank to use defaults.
          </p>
        </div>

        {/* Amazon Bedrock Settings */}
        <div className="card border-sky-400/20">
          <h2 className="font-display text-xl text-sky-300 mb-2 flex items-center gap-2">
            <span>🧠</span>
            Amazon Web Services (Bedrock + Textract)
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            IAM Access Key ID + Secret Access Key. These credentials power Claude on
            Bedrock and <strong>AWS Textract</strong> OCR for Assisted Reading.
            The IAM user needs <code>textract:DetectDocumentText</code> and Bedrock
            invoke permission in your region.
          </p>

          <input
            type="text"
            value={bedrockAccessKeyId}
            onChange={(e) => setBedrockAccessKeyId(e.target.value)}
            placeholder="AWS Access Key ID"
            className="input-field font-mono mb-3"
            autoComplete="off"
          />

          <input
            type="password"
            value={bedrockSecretAccessKey}
            onChange={(e) => setBedrockSecretAccessKey(e.target.value)}
            placeholder="AWS Secret Access Key"
            className="input-field font-mono mb-3"
            autoComplete="off"
          />

          <input
            type="password"
            value={bedrockSessionToken}
            onChange={(e) => setBedrockSessionToken(e.target.value)}
            placeholder="Session token (optional — only for temporary credentials)"
            className="input-field font-mono text-sm mb-3"
            autoComplete="off"
          />

          <input
            type="text"
            value={bedrockRegion}
            onChange={(e) => setBedrockRegion(e.target.value)}
            placeholder={`AWS region (default: ${DEFAULT_BEDROCK_REGION})`}
            className="input-field font-mono text-sm mb-3"
          />

          <input
            type="text"
            value={bedrockModelId}
            onChange={(e) => setBedrockModelId(e.target.value)}
            placeholder={`Model ID (default: ${DEFAULT_BEDROCK_MODEL})`}
            className="input-field font-mono text-sm mb-3"
          />

          <p className="text-gray-500 text-xs mb-2">
            Or use a Bedrock API key (Bearer token) for Claude only — Textract still
            needs IAM Access Key + Secret:
          </p>
          <input
            type="password"
            value={bedrockApiKey}
            onChange={(e) => setBedrockApiKey(e.target.value)}
            placeholder="Bedrock API key (optional alternative)"
            className="input-field font-mono text-sm"
          />

          {(bedrockAccessKeyId && bedrockSecretAccessKey) || bedrockApiKey ? (
            <p className="text-sm text-success mt-2 flex items-center gap-2">
              <span>✓</span> AWS credentials entered
            </p>
          ) : null}

          <p className="text-xs text-gray-500 mt-3">
            Bedrock and Textract run through the local dev server (`npm run dev`) so AWS
            request signing works correctly.
          </p>
        </div>

        {/* Save status */}
        {saveMessage && (
          <div className={`p-4 rounded-lg text-center ${
            saveMessage.includes('success') 
              ? 'bg-success/10 border border-success/50 text-success'
              : 'bg-danger/10 border border-danger/50 text-danger'
          }`}>
            {saveMessage}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-4 justify-between items-center">
          <div className="text-sm text-gray-400">
            {isConfigured ? (
              <span className="text-success">✓ Ready for training</span>
            ) : (
              <span className="text-glitch">⚠ Both API keys required</span>
            )}
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => onNavigate(returnTo)}
              className="btn btn-glitch"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn btn-solid"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : '💾 Save Settings'}
            </button>
          </div>
        </div>

        {/* Info section */}
        <div className="card bg-void-lighter/50 border-gray-700">
          <h3 className="font-display text-lg text-gray-300 mb-3">🔒 Security Note</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Your API keys are stored locally in your browser's IndexedDB and are never sent 
            to any server except the official API endpoints (AssemblyAI, ElevenLabs, and AWS Bedrock). 
            They are only used to enable speech and study-prep features on your device.
          </p>
        </div>
      </main>
    </div>
  )
}

