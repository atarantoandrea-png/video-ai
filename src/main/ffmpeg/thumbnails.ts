import { execFile } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { tmpdir } from 'os'
import { join } from 'path'
import { getFfmpegPath, getFfprobePath } from './paths'

const THUMB_DIR = join(tmpdir(), 'videoai-thumbs')
const inflight = new Map<string, Promise<ThumbResult>>()

export interface ThumbResult {
  /** Single representative frame, for the media bin card. */
  posterPath: string
  /** Filmstrip: source frames tiled into a grid (stripCols per row), for timeline clips. */
  stripPath: string
  /** Number of COLUMNS in the strip grid (frames per row). The renderer derives the
   *  row count from the image height, and the frame width from naturalWidth/stripCols. */
  stripCols: number
}

const STRIP_HEIGHT = 144
const POSTER_HEIGHT = 200
// Browsers refuse to decode (and GPUs can't upload) images wider/taller than the
// max texture size (~16k, less on some machines). A single row of wide landscape
// frames easily blows past that — e.g. a 6-min 16:9 clip → 35000+ px. So the strip
// is laid out as a GRID capped well under the limit on BOTH axes.
const MAX_SIDE = 4000

function run(ffmpeg: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(ffmpeg, args, { maxBuffer: 1 << 24 }, (err) => (err ? reject(err) : resolve()))
  })
}

/** Display aspect ratio (w/h) of the first video stream; falls back to 16:9. */
function probeAspect(path: string): Promise<number> {
  return new Promise((resolve) => {
    execFile(
      getFfprobePath(),
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height',
        '-of',
        'csv=p=0',
        path
      ],
      { maxBuffer: 1 << 20 },
      (err, stdout) => {
        if (err) return resolve(16 / 9)
        const [w, h] = String(stdout).trim().split(',').map(Number)
        resolve(w > 0 && h > 0 ? w / h : 16 / 9)
      }
    )
  })
}

/**
 * Build a poster frame + a horizontal filmstrip (N evenly-spaced frames tiled
 * into one image) for timeline display. Reads pixels from
 * `readPath` (pass a proxy for fast decode) but caches by `keyPath` (the stable
 * ORIGINAL path) so results survive proxy regeneration. Cached on disk;
 * concurrent requests for the same key share one job.
 */
export async function generateThumbnails(
  readPath: string,
  durationSec: number,
  keyPath: string = readPath
): Promise<ThumbResult> {
  if (!existsSync(THUMB_DIR)) mkdirSync(THUMB_DIR, { recursive: true })
  const hash = createHash('sha1').update(keyPath).digest('hex').slice(0, 16)
  // The "-v3" suffix encodes the thumbnail recipe (grid layout): bump it to
  // invalidate older single-row strips that could exceed browser image limits.
  const posterPath = join(THUMB_DIR, `${hash}-poster.jpg`)
  const stripPath = join(THUMB_DIR, `${hash}-strip-v3.jpg`)
  const dur = Math.max(0.2, durationSec)
  // The strip-cols metadata is encoded in the cached filename's sibling .json so a
  // cache hit can return the grid width without re-probing. If it's missing we
  // recompute below.
  const metaPath = join(THUMB_DIR, `${hash}-strip-v3.json`)
  if (existsSync(posterPath) && existsSync(stripPath) && existsSync(metaPath)) {
    try {
      const cols = JSON.parse(readFileSync(metaPath, 'utf8')).cols
      if (cols > 0) return { posterPath, stripPath, stripCols: cols }
    } catch {
      /* fall through and regenerate */
    }
  }
  const running = inflight.get(stripPath)
  if (running) return running

  const job = (async (): Promise<ThumbResult> => {
    const ffmpeg = getFfmpegPath()
    // Lay frames out in a grid bounded to MAX_SIDE on both axes. The aspect drives
    // how many frames fit per row; the rest stack into additional rows.
    const aspect = await probeAspect(readPath)
    const frameW = Math.max(2, Math.round(STRIP_HEIGHT * aspect))
    const wantFrames = Math.max(12, Math.min(180, Math.round(dur / 1.6)))
    const colsCap = Math.max(1, Math.floor(MAX_SIDE / frameW))
    const rowsCap = Math.max(1, Math.floor(MAX_SIDE / STRIP_HEIGHT))
    const frames = Math.min(wantFrames, colsCap * rowsCap)
    const gridCols = Math.max(1, Math.min(colsCap, frames))
    const gridRows = Math.max(1, Math.ceil(frames / gridCols))
    const total = gridCols * gridRows // full grid: fps targets exactly this many
    const posterAt = Math.min(dur * 0.1, Math.max(0, dur - 0.1))
    // Hardware-decode (HEVC originals stay fast) ONLY on macOS — `videotoolbox` is
    // Apple-only and a Windows/Linux ffmpeg ERRORS on it, which previously killed the
    // whole thumbnail job (so the timeline showed NO frames on Windows). Elsewhere:
    // plain software decode.
    const hwDecode = process.platform === 'darwin' ? ['-hwaccel', 'videotoolbox'] : []
    await run(ffmpeg, [
      '-y',
      '-hide_banner',
      ...hwDecode,
      '-ss',
      String(posterAt),
      '-i',
      readPath,
      '-frames:v',
      '1',
      '-vf',
      `scale=-2:${POSTER_HEIGHT}`,
      '-q:v',
      '4',
      posterPath
    ])
    // Build the strip with SOFTWARE decode (no -hwaccel). Counterintuitively this is
    // ~10x faster here than videotoolbox: the fps filter needs every decoded frame on
    // the CPU, and the per-frame GPU→CPU readback that hwaccel forces dominates (a
    // 45-min clip took ~137s with hwaccel vs ~14s in multithreaded software decode).
    await run(ffmpeg, [
      '-y',
      '-hide_banner',
      '-i',
      readPath,
      '-an',
      '-vf',
      `fps=${total}/${dur.toFixed(3)},scale=-2:${STRIP_HEIGHT},tile=${gridCols}x${gridRows}`,
      '-frames:v',
      '1',
      '-q:v',
      '3',
      stripPath
    ])
    try {
      writeFileSync(metaPath, JSON.stringify({ cols: gridCols, rows: gridRows }))
    } catch {
      /* metadata is an optimization; ignore write failures */
    }
    return { posterPath, stripPath, stripCols: gridCols }
  })()

  inflight.set(stripPath, job)
  try {
    return await job
  } finally {
    inflight.delete(stripPath)
  }
}

/** Extract a single full-resolution frame at `timeSec` as a PNG (for freeze-frame). */
export async function extractFrame(videoPath: string, timeSec: number): Promise<string> {
  if (!existsSync(THUMB_DIR)) mkdirSync(THUMB_DIR, { recursive: true })
  const hash = createHash('sha1').update(`${videoPath}@${timeSec.toFixed(3)}`).digest('hex').slice(0, 16)
  const out = join(THUMB_DIR, `freeze-${hash}.png`)
  if (existsSync(out)) return out
  await run(getFfmpegPath(), [
    '-y',
    '-hide_banner',
    '-ss',
    timeSec.toFixed(3),
    '-i',
    videoPath,
    '-frames:v',
    '1',
    '-q:v',
    '2',
    out
  ])
  return out
}
