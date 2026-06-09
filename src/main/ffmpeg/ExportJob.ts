import { spawn, type ChildProcess } from 'child_process'
import { getFfmpegPath } from './paths'
import { buildFfmpegArgs, type ExportOptions } from './buildArgs'
import { timelineDuration, type Project } from '@shared/projectSchema'
import type { ExportProgress, ExportResult } from '@shared/export'

/**
 * Runs one ffmpeg export as a child process, parsing -progress for a percentage
 * and supporting cancellation. The UI stays responsive because the heavy work
 * is in a separate process and the editor operates on a snapshot of the project.
 */
export class ExportJob {
  private child: ChildProcess | null = null
  private canceled = false

  constructor(
    private readonly project: Project,
    private readonly opts: ExportOptions,
    private readonly onProgress: (p: ExportProgress) => void
  ) {}

  run(): Promise<ExportResult> {
    const core = buildFfmpegArgs(this.project, this.opts)
    // Add -progress as an early global option (after -y -hide_banner).
    const args = [core[0], core[1], '-progress', 'pipe:1', '-nostats', ...core.slice(2)]
    const total = timelineDuration(this.project.timeline) || 1

    return new Promise<ExportResult>((resolve) => {
      const child = spawn(getFfmpegPath(), args, { stdio: ['ignore', 'pipe', 'pipe'] })
      this.child = child

      let stderr = ''
      let buf = ''

      child.stdout?.on('data', (d: Buffer) => {
        buf += d.toString()
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        let timeSec = NaN
        let speed = ''
        for (const line of lines) {
          const eq = line.indexOf('=')
          if (eq < 0) continue
          const key = line.slice(0, eq)
          const val = line.slice(eq + 1).trim()
          if (key === 'out_time_us') timeSec = Number(val) / 1e6
          else if (key === 'speed') speed = val
        }
        if (!Number.isNaN(timeSec)) {
          this.onProgress({
            percent: Math.max(0, Math.min(100, (timeSec / total) * 100)),
            timeSec,
            speed
          })
        }
      })

      child.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString()
      })

      child.on('error', (e) => resolve({ ok: false, outPath: this.opts.outPath, error: String(e) }))
      child.on('close', (code) => {
        this.child = null
        if (this.canceled) resolve({ ok: false, canceled: true, outPath: this.opts.outPath })
        else if (code === 0) resolve({ ok: true, outPath: this.opts.outPath })
        else resolve({ ok: false, outPath: this.opts.outPath, error: stderr.slice(-1500) })
      })
    })
  }

  cancel(): void {
    this.canceled = true
    if (this.child) {
      this.child.kill('SIGKILL')
      this.child = null
    }
  }
}
