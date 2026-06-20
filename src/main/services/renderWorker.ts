/**
 * Render worker (main process). Quando il telefono chiede un export dal sito, qui il PC
 * — se acceso e col cloud collegato — preleva il job, renderizza con ffmpeg (lo STESSO
 * motore dell'export manuale) e carica il video finito sul cloud. Nessuna UI: gira in
 * background. Un solo render alla volta.
 */
import { app } from 'electron'
import { join } from 'path'
import { promises as fsp } from 'fs'
import { ExportJob } from '../ffmpeg/ExportJob'
import { cloudRenderJobs, cloudUpdateJob, cloudGet, cloudUploadVideo, type RenderJob } from './cloud'
import { hasCloudPassword } from './settings'
import type { Project } from '@shared/projectSchema'

let busy = false

function bitrateFor(scale: number, quality?: string): string {
  const baseMbit = scale >= 2 ? 40 : scale >= 1.3 ? 20 : scale <= 0.7 ? 6 : 12
  const qMul = quality === 'high' ? 1.6 : quality === 'low' ? 0.6 : 1
  return `${Math.max(2, Math.round(baseMbit * qMul))}M`
}

async function runJob(job: RenderJob): Promise<void> {
  await cloudUpdateJob(job.id, 'rendering')
  const got = await cloudGet(job.projectId)
  if (!got.ok || !got.json) {
    await cloudUpdateJob(job.id, 'error', 'Progetto non trovato sul cloud')
    return
  }
  const project = JSON.parse(got.json) as Project
  const o = job.options || {}
  const fmt = (['mp4', 'mov', 'gif', 'mp3'] as const).includes(o.format as 'mp4') ? (o.format as 'mp4') : 'mp4'
  const scale = typeof o.outputScale === 'number' ? o.outputScale : 1
  const outPath = join(app.getPath('temp'), 'reel_' + job.id + '.' + fmt)
  try {
    const ejob = new ExportJob(
      project,
      {
        outPath,
        useVideoToolbox: false,
        videoBitrate: bitrateFor(scale, o.quality),
        outputScale: scale,
        fps: o.fps,
        format: fmt,
        quality: o.quality || 'medium'
        // fontFile omesso: i reel non hanno testo a schermo
      },
      () => {}
    )
    const r = await ejob.run()
    if (!r.ok) throw new Error((r.error || 'render fallito').slice(0, 300))
    const up = await cloudUploadVideo(job.projectId, outPath, fmt)
    if (!up.ok) throw new Error(up.error || 'upload fallito')
    await cloudUpdateJob(job.id, 'done')
  } catch (e) {
    await cloudUpdateJob(job.id, 'error', e instanceof Error ? e.message : String(e))
  } finally {
    try { await fsp.unlink(outPath) } catch { /* ignora */ }
  }
}

async function tick(): Promise<void> {
  if (busy || !hasCloudPassword()) return
  let jobs: RenderJob[] = []
  try {
    jobs = await cloudRenderJobs()
  } catch {
    return
  }
  if (!jobs.length) return
  busy = true
  try {
    await runJob(jobs[0])
  } finally {
    busy = false
  }
}

/** Start polling the cloud for render jobs every ~8s. */
export function startRenderWorker(): void {
  setInterval(() => void tick(), 8000)
}
