import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { detectDocumentText } from './textractDetect'
import type { TextractDetectRequest } from '../src/types/textract'

const ROUTE = '/api/textract/detect'

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function handleDetect(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }

  try {
    const body = JSON.parse(await readBody(req)) as TextractDetectRequest
    if (!body.imageBase64) {
      res.statusCode = 400
      res.end('Missing image')
      return
    }

    const text = await detectDocumentText(body)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ text }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Textract request failed'
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
    void handleDetect(req, res)
  })
}

export function textractPlugin(): Plugin {
  return {
    name: 'textract-api',
    configureServer(server) {
      attachMiddleware(server)
    },
    configurePreviewServer(server) {
      attachMiddleware(server)
    },
  }
}
