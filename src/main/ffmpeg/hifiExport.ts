import { execFile } from 'child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { getFfmpegPath } from './paths'
import { buildFfmpegArgs, type ExportOptions } from './buildArgs'
import { isMediaClip, type Project } from '@shared/projectSchema'

/** Hi-fi export sessions: id → temp frame directory. */
const sessions = new Map<string, string>()

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(getFfmpegPath(), args, { maxBuffer: 1 << 26 }, (err) => (err ? reject(err) : resolve()))
  })
}

export function startHifiSession(id: string): string {
  const dir = join(tmpdir(), `videoai-hifi-${id}`)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  sessions.set(id, dir)
  return dir
}

/** Write one rendered frame (a data: JPEG URL) to the session directory. */
export function writeHifiFrame(id: string, index: number, dataUrl: string): void {
  const dir = sessions.get(id)
  if (!dir) return
  const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  writeFileSync(join(dir, `f_${String(index).padStart(6, '0')}.jpg`), Buffer.from(b64, 'base64'))
}

function projectHasAudio(project: Project): boolean {
  for (const t of project.timeline.tracks) {
    if (t.muted) continue
    for (const c of t.clips) {
      if (!isMediaClip(c) || c.mutedAudio) continue
      const src = project.sources.find((x) => x.id === c.sourceId)
      if (src?.hasAudio) return true
    }
  }
  return false
}

/** Assemble the rendered frames into the final video, muxing the project's audio
 *  (taken from a quick low-res fast-export pass so it's always correct). */
export async function finishHifiExport(
  id: string,
  project: Project,
  opts: ExportOptions,
  fps: number,
  outPath: string
): Promise<void> {
  const dir = sessions.get(id)
  if (!dir) throw new Error('Sessione hi-fi non trovata')
  const pattern = join(dir, 'f_%06d.jpg')

  let audioFile: string | null = null
  if (projectHasAudio(project)) {
    // A tiny fast export just to get a correct audio track to mux in.
    audioFile = join(dir, 'fastav.mp4')
    await run(buildFfmpegArgs(project, { ...opts, outPath: audioFile, format: 'mp4', outputScale: 0.25 }))
  }

  const args = ['-y', '-hide_banner', '-framerate', String(fps), '-i', pattern]
  if (audioFile) args.push('-i', audioFile)
  args.push('-map', '0:v')
  if (audioFile) args.push('-map', '1:a')
  if (opts.useVideoToolbox) args.push('-c:v', 'h264_videotoolbox', '-b:v', opts.videoBitrate ?? '12M')
  else args.push('-c:v', 'libx264', '-crf', '18', '-preset', 'medium')
  args.push('-pix_fmt', 'yuv420p')
  if (audioFile) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest')
  args.push('-movflags', '+faststart', outPath)
  await run(args)
}

export function cleanupHifiSession(id: string): void {
  const dir = sessions.get(id)
  if (dir) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
    sessions.delete(id)
  }
}
