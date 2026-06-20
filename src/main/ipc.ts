import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { probeCapabilities } from './ffmpeg/capabilities'
import { probeSource } from './ffmpeg/probe'
import { extractPeaks } from './ffmpeg/waveform'
import { generateProxy } from './ffmpeg/proxy'
import { generateThumbnails, extractFrame } from './ffmpeg/thumbnails'
import { startHifiSession, writeHifiFrame, finishHifiExport, cleanupHifiSession } from './ffmpeg/hifiExport'
import { ExportJob } from './ffmpeg/ExportJob'
import { getSystemInfo } from './services/system'
import { getApiKey, setApiKey, hasApiKey, clearApiKey, getCloudBase, setCloudPassword, hasCloudPassword } from './services/settings'
import { createMessage } from './services/ai'
import { cloudLogin, cloudList, cloudSave, cloudGet, cloudDelete, cloudUploadVideo } from './services/cloud'
import type { Project } from '@shared/projectSchema'
import type { ExportRequestOptions } from '@shared/export'

let currentExport: ExportJob | null = null

/** Default folder for project saves — Documenti\Video AI\salvataggi. Lives OUTSIDE the
 *  install dir (which the auto-updater wipes), so projects survive updates. Created on
 *  demand; Salva/Apri puntano qui per primo. Il file .videoai contiene l'intero progetto
 *  (tagli, look, descrizioni, primo commento, hook). */
function projectsDir(): string {
  const dir = join(app.getPath('documents'), 'Video AI', 'salvataggi')
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    /* if it can't be created, the dialog just opens at its default location */
  }
  return dir
}

const FONT_CANDIDATES = [
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/System/Library/Fonts/Supplemental/Helvetica.ttf',
  '/Library/Fonts/Arial.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
  '/System/Library/Fonts/Avenir.ttc'
]
function resolveFont(): string | undefined {
  return FONT_CANDIDATES.find((p) => existsSync(p))
}

const MEDIA_EXTENSIONS = [
  'mp4',
  'mov',
  'm4v',
  'mkv',
  'webm',
  'avi',
  'mp3',
  'wav',
  'm4a',
  'aac',
  'flac',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp'
]

/** Register every main-process IPC handler. Call once on app ready. */
export function registerIpc(): void {
  ipcMain.handle('app:ping', () => 'pong')
  ipcMain.handle('app:getSystemInfo', () => getSystemInfo())
  ipcMain.handle('ffmpeg:getCapabilities', () => probeCapabilities())
  ipcMain.handle('media:probe', (_e, filePath: string) => probeSource(filePath))
  ipcMain.handle('media:peaks', (_e, filePath: string) => extractPeaks(filePath))
  ipcMain.handle('media:proxy', (_e, filePath: string) => generateProxy(filePath))
  ipcMain.handle(
    'media:thumbs',
    (_e, readPath: string, durationSec: number, keyPath: string) =>
      generateThumbnails(readPath, durationSec, keyPath)
  )

  ipcMain.handle('media:extractFrame', (_e, videoPath: string, timeSec: number) =>
    extractFrame(videoPath, timeSec)
  )

  // ---- Hi-fi (frame-by-frame) export ----
  let hifiCounter = 0
  ipcMain.handle('hifi:begin', async (e, format: 'mp4' | 'mov' | 'gif', name: string) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const ext = format === 'mov' ? 'mov' : 'mp4'
    const saveOpts: Electron.SaveDialogOptions = {
      title: 'Esporta (alta fedeltà)',
      defaultPath: join(app.getPath('downloads'), `${(name || 'video').replace(/[^\w-]+/g, '_')}.${ext}`),
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    }
    const save = win ? await dialog.showSaveDialog(win, saveOpts) : await dialog.showSaveDialog(saveOpts)
    if (save.canceled || !save.filePath) return null
    const id = `${Date.now()}_${hifiCounter++}`
    startHifiSession(id)
    return { id, outPath: save.filePath }
  })

  ipcMain.handle('hifi:frame', (_e, id: string, index: number, dataUrl: string) => {
    writeHifiFrame(id, index, dataUrl)
  })

  ipcMain.handle(
    'hifi:finish',
    async (_e, id: string, project: Project, options: ExportRequestOptions, fps: number, outPath: string) => {
      try {
        const caps = await probeCapabilities()
        const useVideoToolbox = (options.useVideoToolbox ?? true) && caps.hasVideoToolboxH264
        await finishHifiExport(
          id,
          project,
          {
            outPath,
            useVideoToolbox,
            videoBitrate: options.videoBitrate,
            fontFile: resolveFont()
          },
          fps && fps > 0 ? fps : project.canvas.fps,
          outPath
        )
        return { ok: true, outPath }
      } catch (err) {
        return { error: String(err) }
      } finally {
        cleanupHifiSession(id)
      }
    }
  )

  ipcMain.handle('hifi:cancel', (_e, id: string) => cleanupHifiSession(id))

  ipcMain.handle('project:save', async (e, json: string, suggestedName: string) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const opts: Electron.SaveDialogOptions = {
      title: 'Salva progetto',
      defaultPath: join(projectsDir(), `${(suggestedName || 'progetto').replace(/[^\w-]+/g, '_')}.videoai`),
      filters: [{ name: 'Progetto Video AI', extensions: ['videoai', 'json'] }]
    }
    const save = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (save.canceled || !save.filePath) return null
    writeFileSync(save.filePath, json, 'utf8')
    return save.filePath
  })

  ipcMain.handle('lut:open', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const opts: Electron.OpenDialogOptions = {
      title: 'Importa LUT',
      properties: ['openFile'],
      filters: [{ name: 'LUT 3D', extensions: ['cube', 'CUBE'] }]
    }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return res.canceled || !res.filePaths[0] ? null : res.filePaths[0]
  })

  ipcMain.handle('subtitles:open', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const opts: Electron.OpenDialogOptions = {
      title: 'Importa sottotitoli',
      properties: ['openFile'],
      filters: [{ name: 'Sottotitoli', extensions: ['srt', 'vtt'] }]
    }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (res.canceled || !res.filePaths[0]) return null
    return { path: res.filePaths[0], text: readFileSync(res.filePaths[0], 'utf8') }
  })

  ipcMain.handle('project:open', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const opts: Electron.OpenDialogOptions = {
      title: 'Apri progetto',
      defaultPath: projectsDir(),
      properties: ['openFile'],
      filters: [{ name: 'Progetto Video AI', extensions: ['videoai', 'json'] }]
    }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (res.canceled || !res.filePaths[0]) return null
    return { path: res.filePaths[0], json: readFileSync(res.filePaths[0], 'utf8') }
  })

  ipcMain.handle('dialog:openMedia', async () => {
    const opts: Electron.OpenDialogOptions = {
      title: 'Importa media',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Media', extensions: MEDIA_EXTENSIONS }]
    }
    const win = BrowserWindow.getFocusedWindow()
    const res = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts)
    return res.canceled ? [] : res.filePaths
  })

  ipcMain.handle('export:start', async (e, project: Project, options: ExportRequestOptions) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const ext =
      options.format === 'gif' ? 'gif' : options.format === 'mov' ? 'mov' : options.format === 'mp3' ? 'mp3' : 'mp4'
    const defaultName = `${(project.name || 'video').replace(/[^\w-]+/g, '_')}.${ext}`
    const saveOpts: Electron.SaveDialogOptions = {
      title: options.format === 'mp3' ? 'Esporta audio' : 'Esporta video',
      defaultPath: join(app.getPath('downloads'), defaultName),
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    }
    const save = win
      ? await dialog.showSaveDialog(win, saveOpts)
      : await dialog.showSaveDialog(saveOpts)
    if (save.canceled || !save.filePath) return { canceled: true }

    const caps = await probeCapabilities()
    // GIF, MP3, and MOV(h264) don't use the videotoolbox h264 path.
    const useVideoToolbox =
      options.format !== 'gif' &&
      options.format !== 'mp3' &&
      (options.useVideoToolbox ?? true) &&
      caps.hasVideoToolboxH264

    const job = new ExportJob(
      project,
      {
        outPath: save.filePath,
        useVideoToolbox,
        videoBitrate: options.videoBitrate,
        audioBitrate: options.audioBitrate,
        outputScale: options.outputScale,
        fps: options.fps,
        format: options.format,
        quality: options.quality,
        fontFile: resolveFont()
      },
      (p) => e.sender.send('export:progress', p)
    )
    currentExport = job
    const result = await job.run()
    currentExport = null
    return result
  })

  ipcMain.handle('export:cancel', () => {
    currentExport?.cancel()
    currentExport = null
    return true
  })

  ipcMain.handle('shell:reveal', (_e, filePath: string) => {
    if (filePath) shell.showItemInFolder(filePath)
    return true
  })

  // ---- AI assistant settings (Anthropic API key, encrypted at rest) ----
  ipcMain.handle('settings:getApiKey', () => getApiKey())
  ipcMain.handle('settings:setApiKey', (_e, key: string) => setApiKey(key))
  ipcMain.handle('settings:hasApiKey', () => hasApiKey())
  ipcMain.handle('settings:clearApiKey', () => clearApiKey())

  // ---- AI assistant: run one Anthropic Messages request in main (SDK is Node here) ----
  ipcMain.handle('ai:createMessage', (_e, body) => createMessage(body))

  // ---- Cloud progetti (videoai-cloud sul VPS) ----
  ipcMain.handle('cloud:status', () => ({ hasPassword: hasCloudPassword(), base: getCloudBase() }))
  ipcMain.handle('cloud:setPassword', async (_e, pw: string) => {
    const trial = await cloudLogin(pw)
    if (!trial.ok) return trial
    return setCloudPassword(pw)
  })
  ipcMain.handle('cloud:clearPassword', () => setCloudPassword(''))
  ipcMain.handle('cloud:list', () => cloudList())
  ipcMain.handle('cloud:save', (_e, json: string) => cloudSave(json))
  ipcMain.handle('cloud:get', (_e, id: string) => cloudGet(id))
  ipcMain.handle('cloud:delete', (_e, id: string) => cloudDelete(id))
  // Publish a finished export: save the project + upload the rendered video for download.
  ipcMain.handle('cloud:publishVideo', async (_e, json: string, filePath: string, ext: string) => {
    let id = ''
    try {
      id = (JSON.parse(json) as { id?: string }).id || ''
    } catch {
      return { ok: false, error: 'progetto non valido' }
    }
    if (!id) return { ok: false, error: 'id progetto mancante' }
    const saved = await cloudSave(json)
    if (!saved.ok) return saved
    return cloudUploadVideo(id, filePath, ext)
  })
}
