import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const ROUTE = '/api/driver-manual/pdf'

const ALLOWED_PDF_URLS = new Set([
  'https://www.tn.gov/content/dam/tn/safety/documents/DL_Manual.pdf',
])

async function handlePdfProxy(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }

  try {
    const requestUrl = new URL(req.url ?? '', 'http://localhost')
    const targetUrl = requestUrl.searchParams.get('url')

    if (!targetUrl || !ALLOWED_PDF_URLS.has(targetUrl)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'PDF URL not allowed' }))
      return
    }

    const upstream = await fetch(targetUrl)
    if (!upstream.ok) {
      res.statusCode = upstream.status
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error: `Failed to download PDF (${upstream.status})`,
        })
      )
      return
    }

    const buffer = Buffer.from(await upstream.arrayBuffer())
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.end(buffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF proxy failed'
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
    const path = req.url?.split('?')[0]
    if (path !== ROUTE) {
      next()
      return
    }

    void handlePdfProxy(req, res)
  })
}

export function driverManualPdfPlugin(): Plugin {
  return {
    name: 'driver-manual-pdf-proxy',
    configureServer(server) {
      attachMiddleware(server)
    },
    configurePreviewServer(server) {
      attachMiddleware(server)
    },
  }
}
