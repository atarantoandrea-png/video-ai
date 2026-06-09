import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { spawn, execFile } from 'node:child_process'
import { createWriteStream, promises as fsp, copyFileSync, mkdirSync } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * Custom self-updater over GitHub Releases — deliberately NOT electron-updater.
 *
 * Why custom: the app is UNSIGNED. Apple's Squirrel.Mac (what electron-updater uses
 * on macOS) refuses to apply an update unless the app is code-signed, and it only
 * accepts a `.zip` artifact. With an unsigned, dmg-only build the old updater would
 * hang on "checking" with no terminal event and no way to actually install.
 *
 * This implementation instead:
 *   1. checks the latest version straight from the GitHub API (with a hard timeout,
 *      so it can NEVER get stuck on "checking");
 *   2. downloads the right installer for the platform with a progress bar;
 *   3. installs it without needing a signature —
 *        • macOS: a detached shell script waits for this app to quit, mounts the dmg,
 *          replaces the .app bundle in place, strips the quarantine flag and relaunches;
 *        • Windows: runs the NSIS setup.exe (updates in place, relaunches).
 *   4. also refreshes the `/reel-ai` skill into ~/.claude/skills/reel-ai.
 *
 * In dev / an unpackaged run there is no installed bundle to replace, so we report 'dev'.
 */

const OWNER = 'atarantoandrea-png'
const REPO = 'video-ai'
const API_LATEST = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`
const SKILL_RELEASE_URL = `https://github.com/${OWNER}/${REPO}/releases/latest/download/reel-ai-skill.zip`
const SKILL_PAGES_URL = `https://${OWNER}.github.io/${REPO}/reel-ai-skill.zip`

type UpdateStatus =
  | { state: 'dev' }
  | { state: 'checking' }
  | { state: 'none' }
  | { state: 'available'; version?: string }
  | { state: 'downloading'; percent?: number }
  | { state: 'downloaded'; version?: string; skill?: boolean }
  | { state: 'error'; message?: string }

interface GhAsset {
  name: string
  browser_download_url: string
}
interface GhRelease {
  tag_name?: string
  assets?: GhAsset[]
}

let wired = false
let pending: { version: string; assetUrl: string; assetName: string } | null = null
let downloadedFile: string | null = null

function broadcast(status: UpdateStatus): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('update:status', status)
  }
}

/** Compare dotted versions (ignores a leading "v"). >0 if a is newer than b. */
function cmpVer(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

/** fetch with a hard timeout so a stalled network can never freeze the UI. */
async function fetchT(url: string, ms = 12000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'VideoAI-Updater', Accept: 'application/vnd.github+json' }
    })
  } finally {
    clearTimeout(t)
  }
}

/** Pick the installer asset for the running platform. */
function pickAsset(assets: GhAsset[]): { name: string; url: string } | null {
  const re = process.platform === 'darwin' ? /-mac-.*\.dmg$/i : /-win-.*setup\.exe$/i
  const a = assets.find((x) => re.test(x.name))
  return a ? { name: a.name, url: a.browser_download_url } : null
}

/** Stream a URL to a file, reporting percent (handles redirects + backpressure). */
async function downloadTo(url: string, dest: string, onPct?: (p: number) => void): Promise<void> {
  const res = await fetchT(url, 15 * 60 * 1000)
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const total = Number(res.headers.get('content-length') || 0)
  let got = 0
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb): void {
      got += chunk.length
      if (total && onPct) onPct((got / total) * 100)
      cb(null, chunk)
    }
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await pipeline(Readable.fromWeb(res.body as any), counter, createWriteStream(dest))
}

/** Download the latest skill zip and (re)install it into ~/.claude/skills/reel-ai. */
async function installSkill(): Promise<boolean> {
  const tmpZip = join(tmpdir(), 'reel-ai-skill.zip')
  let ok = await downloadTo(SKILL_RELEASE_URL, tmpZip).then(() => true).catch(() => false)
  if (!ok) ok = await downloadTo(SKILL_PAGES_URL, tmpZip).then(() => true).catch(() => false)
  if (!ok) return false
  try {
    const skillsDir = join(app.getPath('home'), '.claude', 'skills')
    mkdirSync(skillsDir, { recursive: true })
    // `tar` (libarchive) extracts .zip on both macOS and Windows 10+. The zip holds a
    // top-level reel-ai/ folder, so this lands at ~/.claude/skills/reel-ai/.
    await new Promise<void>((resolve, reject) =>
      execFile('tar', ['-xf', tmpZip, '-C', skillsDir], (err) => (err ? reject(err) : resolve()))
    )
    try {
      copyFileSync(tmpZip, join(app.getPath('downloads'), 'reel-ai-skill.zip'))
    } catch {
      /* Downloads copy is a nicety; ignore if it fails */
    }
    return true
  } catch {
    return false
  }
}

/** Single-quote a string for safe interpolation into a bash script. */
function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

async function doCheck(notifyChecking: boolean): Promise<UpdateStatus> {
  if (notifyChecking) broadcast({ state: 'checking' })
  const res = await fetchT(API_LATEST)
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`)
  const rel = (await res.json()) as GhRelease
  const latest = (rel.tag_name || '').replace(/^v/, '')
  if (!latest || cmpVer(latest, app.getVersion()) <= 0) {
    pending = null
    return { state: 'none' }
  }
  const asset = pickAsset(rel.assets || [])
  if (!asset) return { state: 'error', message: 'Nessun installer per questa piattaforma nella release.' }
  pending = { version: latest, assetUrl: asset.url, assetName: asset.name }
  return { state: 'available', version: latest }
}

export function registerUpdater(): void {
  if (wired) return
  wired = true

  // Open an external URL (only http/https) — used by the "download from the site" fallback.
  ipcMain.handle('app:openExternal', async (_e, url: unknown): Promise<void> => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) await shell.openExternal(url)
  })

  ipcMain.handle('update:check', async (): Promise<UpdateStatus> => {
    if (!app.isPackaged) {
      broadcast({ state: 'dev' })
      return { state: 'dev' }
    }
    try {
      const status = await doCheck(true)
      broadcast(status)
      return status
    } catch (e) {
      const status: UpdateStatus = { state: 'error', message: String((e as Error)?.message || e) }
      broadcast(status)
      return status
    }
  })

  ipcMain.handle('update:download', async (): Promise<{ ok: boolean; message?: string }> => {
    if (!pending) return { ok: false, message: 'Nessun aggiornamento disponibile.' }
    try {
      const dest = join(tmpdir(), pending.assetName)
      broadcast({ state: 'downloading', percent: 0 })
      await downloadTo(pending.assetUrl, dest, (p) => broadcast({ state: 'downloading', percent: p }))
      downloadedFile = dest
      // Refresh the /reel-ai skill alongside the app.
      const skill = await installSkill()
      broadcast({ state: 'downloaded', version: pending.version, skill })
      return { ok: true }
    } catch (e) {
      const message = String((e as Error)?.message || e)
      broadcast({ state: 'error', message })
      return { ok: false, message }
    }
  })

  ipcMain.handle('update:install', async (): Promise<{ ok: boolean; message?: string }> => {
    if (!downloadedFile) return { ok: false, message: 'Nessun file scaricato.' }
    try {
      if (process.platform === 'darwin') {
        const exe = process.execPath // …/Video AI.app/Contents/MacOS/Video AI
        const idx = exe.indexOf('.app')
        const appBundle = idx > -1 ? exe.slice(0, idx + 4) : ''
        if (!appBundle) {
          // Couldn't locate the bundle — just open the dmg so the user can drag it.
          await shell.openPath(downloadedFile)
          return { ok: true }
        }
        // Detached script: wait for THIS process to quit, then swap the bundle & relaunch.
        const script = `#!/bin/bash
DMG=${shq(downloadedFile)}
DEST=${shq(appBundle)}
PID=${process.pid}
for i in $(seq 1 200); do kill -0 "$PID" 2>/dev/null || break; sleep 0.2; done
sleep 1
MNT="$(mktemp -d /tmp/videoai-upd.XXXXXX)"
if ! hdiutil attach -nobrowse -noverify -noautoopen -mountpoint "$MNT" "$DMG" >/dev/null 2>&1; then
  open "$DMG"; exit 1
fi
SRC="$(ls -d "$MNT"/*.app 2>/dev/null | head -1)"
if [ -n "$SRC" ]; then
  rm -rf "$DEST"
  ditto "$SRC" "$DEST"
  xattr -dr com.apple.quarantine "$DEST" >/dev/null 2>&1
fi
hdiutil detach "$MNT" >/dev/null 2>&1
rmdir "$MNT" >/dev/null 2>&1
open "$DEST"
`
        const sp = join(tmpdir(), `videoai-update-${Date.now()}.sh`)
        await fsp.writeFile(sp, script, { mode: 0o755 })
        spawn('/bin/bash', [sp], { detached: true, stdio: 'ignore' }).unref()
        setTimeout(() => app.quit(), 400)
        return { ok: true }
      }
      if (process.platform === 'win32') {
        await shell.openPath(downloadedFile) // NSIS setup updates in place & relaunches
        setTimeout(() => app.quit(), 400)
        return { ok: true }
      }
      await shell.openPath(downloadedFile)
      return { ok: true }
    } catch (e) {
      return { ok: false, message: String((e as Error)?.message || e) }
    }
  })

  // A quiet check shortly after launch so the ⟳ button can already show the "update" dot.
  if (app.isPackaged) {
    setTimeout(() => {
      void doCheck(false)
        .then((s) => {
          if (s.state === 'available') broadcast(s)
        })
        .catch(() => {
          /* offline / rate-limited / no release — ignore */
        })
    }, 4000)
  }
}
