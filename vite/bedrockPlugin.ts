import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import {
  invokeBedrockConverse,
  type BedrockConverseRequest,
} from './bedrockConverse'

const ROUTE = '/api/bedrock/converse'

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function handleBedrockConverse(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }

  try {
    const raw = await readBody(req)
    const body = JSON.parse(raw) as BedrockConverseRequest

    if (!body.auth || !body.system || !body.user) {
      res.statusCode = 400
      res.end('Missing required fields')
      return
    }

    const text = await invokeBedrockConverse(body)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ text }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bedrock request failed'
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: message }))
  }
}

function attachMiddleware(server: {
  middlewares: {
    use: (
      handler: (
        req: IncomingMessage,
        res: ServerResponse,
        next: () => void
      ) => void
    ) => void
  }
}): void {
  server.middlewares.use((req, res, next) => {
    if (req.url !== ROUTE) {
      next()
      return
    }

    void handleBedrockConverse(req, res)
  })
}

export function bedrockPlugin(): Plugin {
  return {
    name: 'bedrock-api',
    configureServer(server) {
      attachMiddleware(server)
    },
    configurePreviewServer(server) {
      attachMiddleware(server)
    },
  }
}
