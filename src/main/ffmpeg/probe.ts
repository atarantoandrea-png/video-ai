import { execFile } from 'child_process'
import { promisify } from 'util'
import { basename } from 'path'
import { getFfprobePath } from './paths'
import { genId } from '@shared/ids'
import type { Source, SourceKind } from '@shared/projectSchema'

const pexec = promisify(execFile)

interface ProbeStream {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  avg_frame_rate?: string
  r_frame_rate?: string
  duration?: string
  tags?: Record<string, string>
  disposition?: Record<string, number>
  side_data_list?: Array<{ rotation?: number }>
}

const IMAGE_CODECS = new Set([
  'png',
  'mjpeg',
  'jpeg',
  'bmp',
  'gif',
  'webp',
  'tiff',
  'apng',
  'ppm',
  'pgm'
])

/** Run ffprobe on a media file and produce an immutable Source descriptor. */
export async function probeSource(filePath: string): Promise<Source> {
  const ffprobe = getFfprobePath()
  const { stdout } = await pexec(
    ffprobe,
    [
      '-hide_banner',
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath
    ],
    { maxBuffer: 1 << 22 }
  )

  const data = JSON.parse(stdout) as {
    streams?: ProbeStream[]
    format?: { duration?: string }
  }
  const streams = data.streams ?? []
  const v = streams.find((s) => s.codec_type === 'video')
  const a = streams.find((s) => s.codec_type === 'audio')
  const format = data.format ?? {}

  const durationSec =
    parseFloat(format.duration ?? v?.duration ?? a?.duration ?? '0') || 0
  const hasAudio = !!a
  const isImage = !!v && IMAGE_CODECS.has((v.codec_name ?? '').toLowerCase()) && !hasAudio
  const hasVideo = !!v && !isCoverArt(v)
  const kind: SourceKind = isImage ? 'image' : hasVideo ? 'video' : hasAudio ? 'audio' : 'image'

  return {
    id: genId('src'),
    path: filePath,
    fileName: basename(filePath),
    kind,
    durationSec,
    width: v ? Number(v.width) || 0 : 0,
    height: v ? Number(v.height) || 0 : 0,
    fps: v ? parseFrameRate(v.avg_frame_rate ?? v.r_frame_rate) : 0,
    hasVideo,
    hasAudio,
    videoCodec: v?.codec_name ?? null,
    rotation: v ? parseRotation(v) : 0,
    proxyPath: null,
    thumbnailPath: null,
    timelineThumbsPath: null,
    timelineThumbCols: null,
    waveformPath: null,
    peaks: null
  }
}

function parseFrameRate(r?: string): number {
  if (!r) return 0
  const [n, d] = r.split('/').map(Number)
  if (d === undefined || d === 0) return n || 0
  return n / d
}

function parseRotation(v: ProbeStream): number {
  const tag = Number(v.tags?.rotate ?? 0)
  if (tag) return (((tag % 360) + 360) % 360)
  const sd = (v.side_data_list ?? []).find((s) => typeof s.rotation === 'number')
  if (sd && typeof sd.rotation === 'number') return (((-sd.rotation % 360) + 360) % 360)
  return 0
}

function isCoverArt(v: ProbeStream): boolean {
  return v.disposition?.attached_pic === 1
}
