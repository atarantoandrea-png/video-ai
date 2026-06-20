import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type Anthropic from '@anthropic-ai/sdk'
import type { Project, Source } from '@shared/projectSchema'
import type { CloudProject } from '@shared/cloud'
import type { SystemInfo } from '@shared/performance'
import type { FfmpegCapabilities } from '@shared/capabilities'
import type { ExportProgress, ExportRequestOptions, ExportResult } from '@shared/export'

/**
 * The single, whitelisted bridge between the renderer and the main process.
 * Keep this surface small and typed. Never expose ipcRenderer directly.
 */
const api = {
  /** Liveness check used during bring-up. */
  ping: (): Promise<string> => ipcRenderer.invoke('app:ping'),

  /** Host machine specs, used to pick a performance tier. */
  getSystemInfo: (): Promise<SystemInfo> => ipcRenderer.invoke('app:getSystemInfo'),

  /** Which ffmpeg encoders/filters the bundled binary supports. */
  getCapabilities: (): Promise<FfmpegCapabilities> =>
    ipcRenderer.invoke('ffmpeg:getCapabilities'),

  /** Probe a media file into a Source descriptor. */
  probeMedia: (filePath: string): Promise<Source> =>
    ipcRenderer.invoke('media:probe', filePath),

  /** Compute normalized audio peaks (0..1) for a media file. */
  getPeaks: (filePath: string): Promise<number[]> => ipcRenderer.invoke('media:peaks', filePath),

  /** Generate (or reuse) a 540p H.264 preview proxy; returns its path. */
  generateProxy: (filePath: string): Promise<string> => ipcRenderer.invoke('media:proxy', filePath),

  /** Generate (or reuse) a poster + timeline filmstrip; returns their paths. */
  generateThumbnails: (
    readPath: string,
    durationSec: number,
    keyPath: string
  ): Promise<{ posterPath: string; stripPath: string; stripCols: number }> =>
    ipcRenderer.invoke('media:thumbs', readPath, durationSec, keyPath),

  /** Extract one full-res frame at a time (PNG path), for freeze-frame. */
  extractFrame: (videoPath: string, timeSec: number): Promise<string> =>
    ipcRenderer.invoke('media:extractFrame', videoPath, timeSec),

  /** Save the project JSON to a user-chosen .videoai file; returns the path or null. */
  saveProjectFile: (json: string, suggestedName: string): Promise<string | null> =>
    ipcRenderer.invoke('project:save', json, suggestedName),

  /** Open a .videoai file; returns its path + JSON, or null if cancelled. */
  openProjectFile: (): Promise<{ path: string; json: string } | null> =>
    ipcRenderer.invoke('project:open'),

  /** Open an .srt/.vtt subtitle file; returns its text, or null if cancelled. */
  openSubtitleFile: (): Promise<{ path: string; text: string } | null> =>
    ipcRenderer.invoke('subtitles:open'),

  /** Open a .cube LUT file; returns its path, or null if cancelled. */
  openLutFile: (): Promise<string | null> => ipcRenderer.invoke('lut:open'),

  /** Hi-fi (frame-by-frame) export: pick output + start a session. */
  hifiBegin: (
    format: 'mp4' | 'mov' | 'gif',
    name: string
  ): Promise<{ id: string; outPath: string } | null> => ipcRenderer.invoke('hifi:begin', format, name),
  hifiFrame: (id: string, index: number, dataUrl: string): Promise<void> =>
    ipcRenderer.invoke('hifi:frame', id, index, dataUrl),
  hifiFinish: (
    id: string,
    project: Project,
    opts: ExportRequestOptions,
    fps: number,
    outPath: string
  ): Promise<ExportResult> => ipcRenderer.invoke('hifi:finish', id, project, opts, fps, outPath),
  hifiCancel: (id: string): Promise<void> => ipcRenderer.invoke('hifi:cancel', id),

  /** Open the native file picker; returns selected absolute paths. */
  openMediaDialog: (): Promise<string[]> => ipcRenderer.invoke('dialog:openMedia'),

  /** Resolve the absolute path of a File from a drag-and-drop / input element. */
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  /** Pick an output path and render the project to MP4. */
  startExport: (project: Project, opts: ExportRequestOptions): Promise<ExportResult> =>
    ipcRenderer.invoke('export:start', project, opts),

  cancelExport: (): Promise<boolean> => ipcRenderer.invoke('export:cancel'),

  /** Subscribe to export progress; returns an unsubscribe function. */
  onExportProgress: (cb: (p: ExportProgress) => void): (() => void) => {
    const listener = (_e: unknown, p: ExportProgress): void => cb(p)
    ipcRenderer.on('export:progress', listener)
    return () => ipcRenderer.removeListener('export:progress', listener)
  },

  /** Reveal a file in Finder. */
  revealPath: (filePath: string): Promise<boolean> => ipcRenderer.invoke('shell:reveal', filePath),

  // ---- AI assistant: Anthropic API key (stored encrypted in the main process) ----
  /** Decrypt + return the stored Anthropic key, or null. Fetched just-in-time per AI run. */
  getApiKey: (): Promise<string | null> => ipcRenderer.invoke('settings:getApiKey'),
  /** Persist the Anthropic key (encrypted at rest). Empty string clears it. */
  setApiKey: (key: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('settings:setApiKey', key),
  /** Whether a key is stored, without pulling the secret. */
  hasApiKey: (): Promise<boolean> => ipcRenderer.invoke('settings:hasApiKey'),
  /** Forget the stored key. */
  clearApiKey: (): Promise<void> => ipcRenderer.invoke('settings:clearApiKey'),

  /** Run one Anthropic Messages request via main (the SDK runs in Node; the key stays in main). */
  aiCreateMessage: (
    body: Anthropic.MessageCreateParamsNonStreaming
  ): Promise<Anthropic.Message | { __error: { status: number; message: string } }> =>
    ipcRenderer.invoke('ai:createMessage', body),

  // ---- Cloud progetti (videoai-cloud sul VPS) — la password resta nel main ----
  cloudStatus: (): Promise<{ hasPassword: boolean; base: string }> =>
    ipcRenderer.invoke('cloud:status'),
  cloudSetPassword: (pw: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('cloud:setPassword', pw),
  cloudClearPassword: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('cloud:clearPassword'),
  cloudList: (): Promise<{ ok: boolean; items?: CloudProject[]; error?: string }> =>
    ipcRenderer.invoke('cloud:list'),
  cloudSave: (json: string): Promise<{ ok: boolean; error?: string; needPassword?: boolean }> =>
    ipcRenderer.invoke('cloud:save', json),
  cloudGet: (id: string): Promise<{ ok: boolean; json?: string; error?: string }> =>
    ipcRenderer.invoke('cloud:get', id),
  cloudDelete: (id: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('cloud:delete', id),

  // ---- Auto-update (custom updater over GitHub Releases) ----
  /** Open a URL in the user's default browser (validated http/https in main). */
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('app:openExternal', url),
  /** Ask main to check GitHub Releases for a newer version. */
  updateCheck: (): Promise<UpdateStatus> => ipcRenderer.invoke('update:check'),
  /** Download the available update (progress arrives via onUpdateStatus). */
  updateDownload: (): Promise<{ ok: boolean; message?: string }> =>
    ipcRenderer.invoke('update:download'),
  /** Quit and install the downloaded update (relaunches the new version). */
  updateInstall: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('update:install'),
  /** Subscribe to update lifecycle events; returns an unsubscribe function. */
  onUpdateStatus: (cb: (s: UpdateStatus) => void): (() => void) => {
    const listener = (_e: unknown, s: UpdateStatus): void => cb(s)
    ipcRenderer.on('update:status', listener)
    return () => ipcRenderer.removeListener('update:status', listener)
  },

  // ---- MCP bridge (Video AI local HTTP server on port 7842) ----
  onMcpRunPlan: (cb: (d: { reqId: string; plan: string }) => void): (() => void) => {
    const listener = (_e: unknown, d: { reqId: string; plan: string }): void => cb(d)
    ipcRenderer.on('mcp:run-plan', listener)
    return () => ipcRenderer.removeListener('mcp:run-plan', listener)
  },
  onMcpGetState: (cb: (d: { reqId: string }) => void): (() => void) => {
    const listener = (_e: unknown, d: { reqId: string }): void => cb(d)
    ipcRenderer.on('mcp:get-state', listener)
    return () => ipcRenderer.removeListener('mcp:get-state', listener)
  },
  sendMcpResult: (channel: string, data: unknown): void => {
    if (channel.startsWith('mcp:')) ipcRenderer.send(channel, data)
  }
}

export type UpdateStatus =
  | { state: 'dev' }
  | { state: 'checking' }
  | { state: 'none' }
  | { state: 'available'; version?: string }
  | { state: 'downloading'; percent?: number }
  | { state: 'downloaded'; version?: string; skill?: boolean }
  | { state: 'error'; message?: string }

export type Api = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose preload API', error)
  }
} else {
  window.api = api
}
