import { describe, it, expect } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFileSync, existsSync, rmSync } from 'fs'
import ffmpegPath from 'ffmpeg-static'
import ffprobe from 'ffprobe-static'
import { createProject } from '@shared/projectSchema'
import { startHifiSession, writeHifiFrame, finishHifiExport } from './hifiExport'

const pexec = promisify(execFile)

describe('hifiExport assembly', () => {
  it('assembles rendered frames into a video', async () => {
    const jpg = '/tmp/videoai-hifi-testframe.jpg'
    await pexec(ffmpegPath as unknown as string, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=red:s=320x180',
      '-frames:v',
      '1',
      jpg
    ])
    const dataUrl = 'data:image/jpeg;base64,' + readFileSync(jpg).toString('base64')
    const id = 'test_hifi_assembly'
    startHifiSession(id)
    for (let i = 0; i < 6; i++) writeHifiFrame(id, i, dataUrl)
    const out = '/tmp/videoai-hifi-out.mp4'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const project = createProject('hifi') // empty timeline → no audio pass
    await finishHifiExport(id, project, { outPath: out, useVideoToolbox: false }, 6, out)
    expect(existsSync(out)).toBe(true)
    const { stdout } = await pexec(ffprobe.path, [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      out
    ])
    expect(stdout.trim()).toBe('320,180')
  }, 60000)
})
