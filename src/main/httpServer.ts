import { createServer } from 'http'
import type { IncomingMessage, ServerResponse } from 'http'
import { BrowserWindow, ipcMain } from 'electron'

const PORT = 7842

export function registerHttpServer(): void {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((e) => {
      reply(res, 500, { error: String(e) })
    })
  })
  server.listen(PORT, '127.0.0.1')
  server.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code !== 'EADDRINUSE') console.error('[video-ai mcp]', e.message)
  })
}

function getWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] ?? null
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => resolve(body))
  })
}

function reply(res: ServerResponse, status: number, data: unknown): void {
  if (res.headersSent) return
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '127.0.0.1'
  })
  res.end(body)
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? ''

  if (url === '/health') {
    reply(res, 200, { ok: true, app: 'video-ai' })
    return
  }

  const win = getWindow()

  if (url === '/run-plan' && req.method === 'POST') {
    const plan = await readBody(req)
    if (!win) { reply(res, 503, { error: 'Video AI non è aperto' }); return }
    const reqId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const result = await new Promise<unknown>((resolve) => {
      const timer = setTimeout(() => resolve({ error: 'Timeout: piano non completato in 60s' }), 60_000)
      ipcMain.once(`mcp:plan-result:${reqId}`, (_e, r: unknown) => {
        clearTimeout(timer)
        resolve(r)
      })
      win.webContents.send('mcp:run-plan', { reqId, plan })
    })
    reply(res, 200, result)
    return
  }

  if (url === '/state' && req.method === 'GET') {
    if (!win) { reply(res, 503, { error: 'Video AI non è aperto' }); return }
    const reqId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const result = await new Promise<unknown>((resolve) => {
      const timer = setTimeout(() => resolve({ error: 'Timeout' }), 5_000)
      ipcMain.once(`mcp:state-result:${reqId}`, (_e, r: unknown) => {
        clearTimeout(timer)
        resolve(r)
      })
      win.webContents.send('mcp:get-state', { reqId })
    })
    reply(res, 200, result)
    return
  }

  reply(res, 404, { error: 'Not found' })
}
