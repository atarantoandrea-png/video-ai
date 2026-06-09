import ffmpegStatic from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import { app } from 'electron'

/**
 * In a packaged app the static binaries are extracted out of app.asar into
 * app.asar.unpacked (configured via electron-builder asarUnpack later).
 */
function unpacked(p: string): string {
  return p.replace('app.asar', 'app.asar.unpacked')
}

// `app` is undefined outside Electron (e.g. unit tests); fall back to the raw path.
const isPackaged = (): boolean => {
  try {
    return !!app?.isPackaged
  } catch {
    return false
  }
}

export function getFfmpegPath(): string {
  const p = ffmpegStatic as unknown as string | null
  if (!p) throw new Error('Binario ffmpeg (ffmpeg-static) non trovato')
  return isPackaged() ? unpacked(p) : p
}

export function getFfprobePath(): string {
  const p = ffprobeStatic.path
  if (!p) throw new Error('Binario ffprobe (ffprobe-static) non trovato')
  return isPackaged() ? unpacked(p) : p
}
