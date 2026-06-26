import { execFile } from 'child_process'
import { existsSync, mkdirSync, renameSync, rmSync } from 'fs'
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
  // The suffix encodes the proxy recipe (720p + CFR + dense GOP): bump it to invalidate old proxies.
  const out = join(PROXY_DIR, `${hash}-720d.mp4`)
  if (existsSync(out)) return out
  const running = inflight.get(out)
  if (running) return running

  // Encode to a unique temp file and rename onto `out` only on success. A proxy
  // killed mid-encode (app closed / crash) otherwise leaves a truncated .mp4 with
  // no `moov` atom at the final path: existsSync() then trusts it forever and the
  // <video> can't decode it → permanently black preview that never regenerates.
  const tmp = `${out}.${process.pid}.part`
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
          // Keyframe FITTI (ogni 15 frame = 0,5s, niente keyframe da scene-cut): l'anteprima
          // di un reel salta spesso a punti lontani della stessa sorgente; con keyframe radi
          // (default ~250) ogni salto deve decodificare fino a ~8s di video → blocco visibile.
          // Con un keyframe ogni mezzo secondo i seek atterrano vicino e sono quasi istantanei.
          '-g',
          '15',
          '-keyint_min',
          '15',
          '-sc_threshold',
          '0',
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
          // The output path ends in `.part`, so ffmpeg can't infer the container —
          // force mp4 explicitly.
          '-f',
          'mp4',
          tmp
        ],
        { maxBuffer: 1 << 24 },
        (err) => (err ? reject(err) : resolve())
      )
    })
    // Publish atomically: the full file only ever appears at `out` once complete.
    renameSync(tmp, out)
    return out
  })()

  inflight.set(out, job)
  try {
    return await job
  } catch (e) {
    // Drop the partial temp file so a failed/aborted encode never lingers.
    try {
      rmSync(tmp, { force: true })
    } catch {
      /* best-effort cleanup */
    }
    throw e
  } finally {
    inflight.delete(out)
  }
}
