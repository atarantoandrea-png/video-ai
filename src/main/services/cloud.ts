/**
 * Client del cloud progetti (videoai-cloud sul VPS). Tutte le chiamate avvengono
 * QUI nel main: la password (cifrata a riposo) non lascia mai il processo
 * principale e non c'è CORS. Il renderer parla solo via IPC.
 */
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

/** Save the project (JSON string) — server keys it by project.id. */
export async function cloudSave(json: string): Promise<{ ok: boolean; error?: string; needPassword?: boolean }> {
  if (!getCloudPassword()) return { ok: false, needPassword: true, error: NO_PW.error }
  const r = await call('POST', '/api/projects', json)
  return r.ok ? { ok: true } : { ok: false, error: r.error, needPassword: r.error === 'no-password' }
}

export async function cloudGet(id: string): Promise<{ ok: boolean; json?: string; error?: string }> {
  const r = await call('GET', '/api/projects/' + encodeURIComponent(id))
  return r.ok ? { ok: true, json: JSON.stringify(r.data) } : { ok: false, error: r.error }
}

export async function cloudDelete(id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await call('DELETE', '/api/projects/' + encodeURIComponent(id))
  return r.ok ? { ok: true } : { ok: false, error: r.error }
}
