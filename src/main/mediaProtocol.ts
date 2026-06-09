import { protocol } from 'electron'
import { createReadStream, promises as fsp } from 'fs'
import { Readable } from 'stream'
import { extname } from 'path'
import { MEDIA_SCHEME } from '@shared/media'

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp'
}
function mimeFor(p: string): string {
  return MIME[extname(p).toLowerCase()] ?? 'application/octet-stream'
}

export function registerMediaSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true
      }
    }
  ])
}

/**
 * Streams local files for media:// with real HTTP Range support so long videos
 * seek and play smoothly without loading the whole file. The requested byte
 * range is served by a lazy read stream (no per-request buffering / file
 * open-close), which is what sustained video playback needs.
 */
export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const url = new URL(request.url)
    const p = url.searchParams.get('p')
    if (!p) return new Response('missing path', { status: 400 })

    let total: number
    try {
      total = (await fsp.stat(p)).size
    } catch {
      return new Response('not found', { status: 404 })
    }

    const baseHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Accept-Ranges': 'bytes',
      'Content-Type': mimeFor(p)
    }

    const rangeHeader = request.headers.get('range')
    if (rangeHeader) {
      const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
      let start = m && m[1] !== '' ? parseInt(m[1] ?? '0', 10) : 0
      let end = m && m[2] !== '' ? parseInt(m[2] ?? '', 10) : total - 1
      if (!Number.isFinite(start) || start < 0) start = 0
      if (!Number.isFinite(end) || end >= total) end = total - 1
      if (start > end) start = 0
      const stream = createReadStream(p, { start, end })
      return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Content-Length': String(end - start + 1)
        }
      })
    }

    const stream = createReadStream(p)
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 200,
      headers: { ...baseHeaders, 'Content-Length': String(total) }
    })
  })
}
