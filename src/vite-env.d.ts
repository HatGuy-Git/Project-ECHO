/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ELEVENLABS_API_KEY: string
  readonly VITE_ASSEMBLYAI_API_KEY: string
  readonly VITE_MAINFRAME_VOICE_ID: string
  readonly VITE_DR_GLITCH_VOICE_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
