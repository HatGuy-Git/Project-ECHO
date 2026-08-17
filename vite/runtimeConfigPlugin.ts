import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import {
  ensureAppSecrets,
  getAppSecrets,
  getAwsRuntimeStatus,
} from './awsSecrets'

const ROUTE = '/api/runtime-config'

async function handleRuntimeConfig(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  await ensureAppSecrets()
  const secrets = getAppSecrets()
  const aws = getAwsRuntimeStatus()

  res.setHeader('Content-Type', 'application/json')
  res.end(
    JSON.stringify({
      aws,
      services: {
        elevenLabs: Boolean(secrets.ELEVENLABS_API_KEY),
        assemblyAI: Boolean(secrets.ASSEMBLYAI_API_KEY),
        textract: aws.hasEnvCredentials,
        bedrock: aws.hasEnvCredentials,
      },
      voices: {
        tutor: secrets.ELEVENLABS_TUTOR_VOICE_ID ?? null,
        mainframe: secrets.ELEVENLABS_MAINFRAME_VOICE_ID ?? null,
        glitch: secrets.ELEVENLABS_GLITCH_VOICE_ID ?? null,
      },
    })
  )
}

export function runtimeConfigPlugin(): Plugin {
  return {
    name: 'runtime-config-api',
    async configureServer(server) {
      await ensureAppSecrets()
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== ROUTE) {
          next()
          return
        }
        void handleRuntimeConfig(req, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== ROUTE) {
          next()
          return
        }
        void handleRuntimeConfig(req, res)
      })
    },
  }
}
