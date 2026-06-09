import { execFile } from 'child_process'
import { promisify } from 'util'
import type { FfmpegCapabilities } from '@shared/capabilities'
import { getFfmpegPath, getFfprobePath } from './paths'

const pexec = promisify(execFile)
let cached: FfmpegCapabilities | null = null

/** Probe the bundled ffmpeg once and cache which encoders/filters are present. */
export async function probeCapabilities(): Promise<FfmpegCapabilities> {
  if (cached) return cached

  const ffmpegPath = getFfmpegPath()
  const ffprobePath = getFfprobePath()
  const big = { maxBuffer: 1 << 24 }

  const [enc, flt, ver] = await Promise.all([
    pexec(ffmpegPath, ['-hide_banner', '-encoders'], big),
    pexec(ffmpegPath, ['-hide_banner', '-filters'], big),
    pexec(ffmpegPath, ['-hide_banner', '-version'], { maxBuffer: 1 << 20 })
  ])

  cached = {
    ffmpegPath,
    ffprobePath,
    version: ver.stdout.split('\n')[0]?.trim() ?? '',
    hasVideoToolboxH264: /h264_videotoolbox/.test(enc.stdout),
    hasVideoToolboxHevc: /hevc_videotoolbox/.test(enc.stdout),
    hasXfade: /\bxfade\b/.test(flt.stdout),
    hasGblur: /\bgblur\b/.test(flt.stdout)
  }
  return cached
}
