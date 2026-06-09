import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * Minimal persisted settings. Secrets are stored ENCRYPTED at rest via the OS
 * keychain (safeStorage); plaintext never touches disk. The decrypted key is
 * only ever returned to the trusted renderer over the contextBridge.
 */
interface SettingsFile {
  /** base64 of safeStorage.encryptString(<anthropic api key>) */
  anthropicKeyEnc?: string
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function readSettings(): SettingsFile {
  try {
    const p = settingsPath()
    if (!existsSync(p)) return {}
    return JSON.parse(readFileSync(p, 'utf8')) as SettingsFile
  } catch {
    return {}
  }
}

function writeSettings(s: SettingsFile): void {
  writeFileSync(settingsPath(), JSON.stringify(s), 'utf8')
}

/** Store (or, with an empty key, clear) the Anthropic API key, encrypted at rest. */
export function setApiKey(key: string): { ok: boolean; error?: string } {
  const trimmed = (key ?? '').trim()
  const s = readSettings()
  if (!trimmed) {
    delete s.anthropicKeyEnc
    writeSettings(s)
    return { ok: true }
  }
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: 'Crittografia non disponibile su questo sistema' }
  }
  s.anthropicKeyEnc = safeStorage.encryptString(trimmed).toString('base64')
  writeSettings(s)
  return { ok: true }
}

/** Decrypt and return the stored Anthropic API key, or null if unset/undecryptable. */
export function getApiKey(): string | null {
  const s = readSettings()
  if (!s.anthropicKeyEnc) return null
  try {
    return safeStorage.decryptString(Buffer.from(s.anthropicKeyEnc, 'base64'))
  } catch {
    return null
  }
}

/** Cheap existence check for gating UI without pulling the secret into memory. */
export function hasApiKey(): boolean {
  return !!readSettings().anthropicKeyEnc
}

/** Forget the stored key. */
export function clearApiKey(): void {
  const s = readSettings()
  delete s.anthropicKeyEnc
  writeSettings(s)
}
