/**
 * Client del cloud progetti (videoai-cloud sul VPS). Tutte le chiamate avvengono
 * QUI nel main: la password (cifrata a riposo) non lascia mai il processo
 * principale e non c'è CORS. Il renderer parla solo via IPC.
 */
import { promises as fsp } from 'fs'
import { getCloudBase, getCloudPassword } from './settings'
import type { CloudProject } from '@shared/cloud'

const NO_PW = { error: 'no-password' as const }

async function call(
  method: string,
  path: string,
  body?: string
): Promise<{ ok: true; data: unknown } | { ok: false; error: string; status?: number }> {
  const pw = getCloudPassword()
  if (!pw) return { ok: false, error: 'no-password' }
  try {
    const res = await fetch(getCloudBase() + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-app-password': pw },
      body
    })
    if (res.status === 401) return { ok: false, error: 'Password del cloud errata', status: 401 }
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      return { ok: false, error: j.error || `Errore ${res.status}`, status: res.status }
    }
    const data = res.status === 204 ? null : await res.json()
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: 'Cloud irraggiungibile (' + (e instanceof Error ? e.message : String(e)) + ')' }
  }
}

/** Verify a candidate password against the server (does NOT store it). */
export async function cloudLogin(password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(getCloudBase() + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: (password ?? '').trim() })
    })
    if (res.ok) return { ok: true }
    return { ok: false, error: res.status === 401 ? 'Password errata' : `Errore ${res.status}` }
  } catch (e) {
    return { ok: false, error: 'Cloud irraggiungibile' }
  }
}

export async function cloudList(): Promise<{ ok: boolean; items?: CloudProject[]; error?: string }> {
  const r = await call('GET', '/api/projects')
  return r.ok ? { ok: true, items: (r.data as CloudProject[]) || [] } : { ok: false, error: r.error }
}

/** Save the project (JSON string). The server keys it by NAME (same name overwrites,
 *  new name creates a new one) and returns the final id. */
export async function cloudSave(json: string): Promise<{ ok: boolean; id?: string; error?: string; needPassword?: boolean }> {
  if (!getCloudPassword()) return { ok: false, needPassword: true, error: NO_PW.error }
  const r = await call('POST', '/api/projects', json)
  if (!r.ok) return { ok: false, error: r.error, needPassword: r.error === 'no-password' }
  return { ok: true, id: (r.data as { id?: string } | null)?.id }
}

export async function cloudGet(id: string): Promise<{ ok: boolean; json?: string; error?: string }> {
  const r = await call('GET', '/api/projects/' + encodeURIComponent(id))
  return r.ok ? { ok: true, json: JSON.stringify(r.data) } : { ok: false, error: r.error }
}

export async function cloudDelete(id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await call('DELETE', '/api/projects/' + encodeURIComponent(id))
  return r.ok ? { ok: true } : { ok: false, error: r.error }
}

/** A direct, authenticated download URL for a project's finished video (or null). */
export function cloudVideoUrl(id: string): string | null {
  const pw = getCloudPassword()
  if (!pw) return null
  return getCloudBase() + '/api/projects/' + encodeURIComponent(id) + '/video?pw=' + encodeURIComponent(pw)
}

/** Upload a finished, rendered video file as the project's downloadable video. */
export async function cloudUploadVideo(
  id: string,
  filePath: string,
  ext: string
): Promise<{ ok: boolean; error?: string }> {
  const pw = getCloudPassword()
  if (!pw) return { ok: false, error: 'no-password' }
  try {
    const buf = await fsp.readFile(filePath)
    const safeExt = /^[a-z0-9]{1,5}$/i.test(ext) ? ext.toLowerCase() : 'mp4'
    const res = await fetch(
      getCloudBase() + '/api/projects/' + encodeURIComponent(id) + '/video?ext=' + safeExt,
      { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'x-app-password': pw }, body: buf }
    )
    if (!res.ok) return { ok: false, error: `Errore ${res.status}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
