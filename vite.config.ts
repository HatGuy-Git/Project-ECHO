import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { bedrockPlugin } from './vite/bedrockPlugin'
import { driverManualPdfPlugin } from './vite/driverManualPdfPlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), bedrockPlugin(), driverManualPdfPlugin()],
})
