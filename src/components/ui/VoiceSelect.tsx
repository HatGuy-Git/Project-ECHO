import type { ElevenLabsVoice } from '../../services/textToSpeech'

interface VoiceSelectProps {
  voices: ElevenLabsVoice[]
  value: string
  disabled?: boolean
  isLoading?: boolean
  onChange: (voiceId: string) => void
}

export default function VoiceSelect({
  voices,
  value,
  disabled = false,
  isLoading = false,
  onChange,
}: VoiceSelectProps) {
  return (
    <label className="flex items-center gap-2 min-w-0">
      <span className="text-xs text-gray-500 font-mono shrink-0">Voice</span>
      <select
        value={value}
        disabled={disabled || isLoading || voices.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="input-field py-2 px-3 text-sm min-w-0 max-w-[16rem]"
        aria-label="Narrator voice"
      >
        {isLoading && <option value={value}>Loading voices…</option>}
        {!isLoading && voices.length === 0 && (
          <option value={value}>Default voice</option>
        )}
        {value && !voices.some((voice) => voice.voice_id === value) && (
          <option value={value}>Current voice</option>
        )}
        {voices.map((voice) => (
          <option key={voice.voice_id} value={voice.voice_id}>
            {voice.name}
          </option>
        ))}
      </select>
    </label>
  )
}
