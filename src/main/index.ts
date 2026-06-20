import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc'
import { registerMediaProtocol, registerMediaSchemePrivileges } from './mediaProtocol'
import { registerUpdater } from './services/updater'
import { registerHttpServer } from './httpServer'
import { startRenderWorker } from './services/renderWorker'
import { runSetup } from './setup'

// Enable the platform (hardware) HEVC decoder so HEVC/H.265 videos (iPhone,
// screen recordings) play in the <video> preview. Must be set before ready.
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport')

// Must be called before the app is ready.
registerMediaSchemePrivileges()

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#0f0f12',
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  win.on('ready-to-show', () => win.show())

  // electron-vite injects ELECTRON_RENDERER_URL in dev; load the built file in prod.
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerMediaProtocol()
  registerIpc()
  registerUpdater()
  registerHttpServer()
  runSetup()
  startRenderWorker() // esegue gli export richiesti dal telefono (se il cloud è collegato)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
