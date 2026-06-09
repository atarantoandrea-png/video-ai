import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

/**
 * Auto-update over GitHub Releases (config baked into app-update.yml by
 * electron-builder from electron-builder.yml `publish:`). The renderer drives it
 * with a button: check → (if available) download → (when ready) restart & install.
 * In dev / an unpackaged run there is no update feed, so we report state 'dev'.
 */
type UpdateStatus =
  | { state: 'dev' }
  | { state: 'checking' }
  | { state: 'none' }
  | { state: 'available'; version?: string }
  | { state: 'downloading'; percent?: number }
  | { state: 'downloaded'; version?: string }
  | { state: 'error'; message?: string }

let wired = false

function broadcast(status: UpdateStatus): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('update:status', status)
  }
}

export function registerUpdater(): void {
  if (wired) return
  wired = true

  autoUpdater.autoDownload = false // we download only after the user confirms
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => broadcast({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => broadcast({ state: 'available', version: info?.version }))
  autoUpdater.on('update-not-available', () => broadcast({ state: 'none' }))
  autoUpdater.on('download-progress', (p) => broadcast({ state: 'downloading', percent: p?.percent }))
  autoUpdater.on('update-downloaded', (info) => broadcast({ state: 'downloaded', version: info?.version }))
  autoUpdater.on('error', (err) =>
    broadcast({ state: 'error', message: String((err as Error)?.message || err) })
  )

  ipcMain.handle('update:check', async (): Promise<UpdateStatus> => {
    if (!app.isPackaged) return { state: 'dev' }
    try {
      // The real outcome arrives via the 'update-available' / 'update-not-available'
      // events (broadcast above); here we just acknowledge the check started.
      await autoUpdater.checkForUpdates()
      return { state: 'checking' }
    } catch (e) {
      return { state: 'error', message: String((e as Error)?.message || e) }
    }
  })

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true }
    } catch (e) {
      return { ok: false, message: String((e as Error)?.message || e) }
    }
  })

  ipcMain.handle('update:install', () => {
    // Quit and apply the downloaded update (relaunches the new version).
    setImmediate(() => autoUpdater.quitAndInstall())
    return { ok: true }
  })

  // A quiet check shortly after launch so the button can already show "available".
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {
        /* offline / no release yet — ignore */
      })
    }, 4000)
  }
}
