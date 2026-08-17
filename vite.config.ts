import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { bedrockPlugin } from './vite/bedrockPlugin'
import { driverManualPdfPlugin } from './vite/driverManualPdfPlugin'
import { textractPlugin } from './vite/textractPlugin'
import { runtimeConfigPlugin } from './vite/runtimeConfigPlugin'
import { elevenLabsPlugin } from './vite/elevenLabsPlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    runtimeConfigPlugin(),
    bedrockPlugin(),
    driverManualPdfPlugin(),
    textractPlugin(),
    elevenLabsPlugin(),
  ],
  server: {
    host: true,
    port: 5173,
    watch:
      process.env.WATCHFILES_FORCE_POLLING === 'true'
        ? { usePolling: true, interval: 300 }
        : undefined,
  },
})
