import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts so tests don't load the dev-server plugins
// (they fetch AWS secrets at startup).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
