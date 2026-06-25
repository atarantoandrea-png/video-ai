import { execFile } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import { tmpdir } from 'os'
import { join } from 'path'
import { getFfmpegPath } from './paths'
import { probeCapabilities } from './capabilities'

const PROXY_DIR = join(tmpdir(), 'videoai-proxies')
const inflight = new Map<string, Promise<string>>()

/**
 * Transcode a source to a light 540p H.264 proxy for smooth, codec-safe
 * preview (the <video> element can't decode HEVC/ProRes; proxies also keep an
 * 8 GB M1 responsive on long/4K clips). Export always uses the original.
 * Cached by path hash; concurrent requests for the same file share one job.
 */
export async function generateProxy(srcPath: string): Promise<string> {
  if (!existsSync(PROXY_DIR)) mkdirSync(PROXY_DIR, { recursive: true })
  const hash = createHash('sha1').update(srcPath).digest('hex').slice(0, 16)
  // The suffix encodes the proxy recipe (720p + CFR): bump it to invalidate old proxies.
  const out = join(PROXY_DIR, `${hash}-720c.mp4`)
  if (existsSync(out)) return out
  const running = inflight.get(out)
  if (running) return running

  const job = (async (): Promise<string> => {
    const ffmpeg = getFfmpegPath()
    const caps = await probeCapabilities()
    const vcodec = caps.hasVideoToolboxH264
      ? ['h264_videotoolbox', '-b:v', '5000k']
      : ['libx264', '-crf', '23', '-preset', 'veryfast']
    // Hardware-decode the source (e.g. HEVC) only where VideoToolbox exists (macOS).
    // On Windows/Linux `-hwaccel videotoolbox` ERRORS and aborts the whole proxy job
    // (→ no preview/thumbnails); there we decode in software.
    const hwDecode = caps.hasVideoToolboxH264 ? ['-hwaccel', 'videotoolbox'] : []
    await new Promise<void>((resolve, reject) => {
      execFile(
        ffmpeg,
        [
          '-y',
          '-hide_banner',
          ...hwDecode,
          '-i',
          srcPath,
          '-vf',
          'scale=-2:720',
          // Frame rate COSTANTE 30: i sorgenti a frame rate variabile (dirette) altrimenti
          // fanno scivolare audio/video anche in ANTEPRIMA. -r forza CFR (frame duplicati/saltati).
          '-r',
          '30',
          '-c:v',
          ...vcodec,
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-movflags',
          '+faststart',
          out
        ],
        { maxBuffer: 1 << 24 },
        (err) => (err ? reject(err) : resolve())
      )
    })
    return out
  })()

  inflight.set(out, job)
  try {
    return await job
  } finally {
    inflight.delete(out)
  }
}
