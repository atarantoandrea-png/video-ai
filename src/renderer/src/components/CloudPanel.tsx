import { useEffect, useState } from 'react'
import { useEditor } from '../state/store'
import type { CloudProject } from '@shared/cloud'

/**
 * Cloud projects modal. Two modes: 'login' (set the VPS password once) and 'list'
 * (open / delete the projects stored on the VPS). Save uploads to the VPS; Open
 * downloads from it. No local files — everything lives in the cloud.
 */
export function CloudPanel(): JSX.Element | null {
  const mode = useEditor((s) => s.cloudModal)
  const close = useEditor((s) => s.closeCloud)
  if (!mode) return null
  return (
    <>
      <div className="popover-backdrop" onPointerDown={close} style={{ zIndex: 40 }} />
      <div
        className="card"
        style={{
          position: 'fixed', top: 56, left: '50%', transform: 'translateX(-50%)', zIndex: 41,
          width: 'min(560px, 92vw)', maxHeight: '78vh', display: 'flex', flexDirection: 'column',
          background: 'var(--panel, #161b22)', border: '1px solid var(--line, #283139)', borderRadius: 14, padding: 16
        }}
      >
        {mode === 'choose' ? <CloudChoose /> : mode === 'login' ? <CloudLogin /> : <CloudList />}
      </div>
    </>
  )
}

function CloudChoose(): JSX.Element {
  const close = useEditor((s) => s.closeCloud)
  const openCloud = useEditor((s) => s.openCloud)
  const openLocalProject = useEditor((s) => s.openLocalProject)

  const fromCloud = async (): Promise<void> => {
    const st = await window.api.cloudStatus()
    openCloud(st.hasPassword ? 'list' : 'login')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="section-title" style={{ flex: 1 }}>Apri un progetto</div>
        <button className="iconbtn" onClick={close} title="Chiudi">✕</button>
      </div>
      <button className="btn" style={{ height: 'auto', padding: '16px', textAlign: 'left' }} onClick={() => void openLocalProject()}>
        <div>
          <div style={{ fontWeight: 600 }}>📁 Da file locale</div>
          <div className="field-label" style={{ marginTop: 2 }}>Apri un file .videoai dal computer.</div>
        </div>
      </button>
      <button className="btn btn--primary" style={{ height: 'auto', padding: '16px', textAlign: 'left' }} onClick={() => void fromCloud()}>
        <div>
          <div style={{ fontWeight: 700 }}>☁ Dal cloud (VPS)</div>
          <div style={{ marginTop: 2, fontSize: 13, opacity: 0.85 }}>I progetti salvati sul tuo VPS, su ogni dispositivo.</div>
        </div>
      </button>
    </div>
  )
}

function CloudLogin(): JSX.Element {
  const afterCloudLogin = useEditor((s) => s.afterCloudLogin)
  const close = useEditor((s) => s.closeCloud)
  const setCloudToast = useEditor((s) => s.setCloudToast)
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    setBusy(true); setErr('')
    const r = await window.api.cloudSetPassword(pw.trim())
    setBusy(false)
    if (r.ok) { setCloudToast('Cloud collegato ✓'); void afterCloudLogin() }
    else setErr(r.error || 'Password errata')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="section-title" style={{ flex: 1 }}>Collega il cloud dei progetti</div>
        <button className="iconbtn" onClick={close} title="Chiudi">✕</button>
      </div>
      <p className="field-label" style={{ lineHeight: 1.5, margin: 0 }}>
        I progetti si salvano sul tuo VPS (così li ritrovi su ogni dispositivo e sull'app del telefono).
        Inserisci la password una sola volta: resta salvata cifrata su questo computer.
      </p>
      <input
        type="password"
        className="input"
        placeholder="Password del cloud"
        value={pw}
        autoFocus
        onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && pw.trim()) void submit() }}
        style={{ width: '100%' }}
      />
      {err && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</div>}
      <button className="btn btn--primary" disabled={busy || !pw.trim()} onClick={() => void submit()}>
        {busy ? 'Verifico…' : 'Collega'}
      </button>
    </div>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function CloudList(): JSX.Element {
  const close = useEditor((s) => s.closeCloud)
  const openCloud = useEditor((s) => s.openCloud)
  const loadCloudProject = useEditor((s) => s.loadCloudProject)
  const setCloudToast = useEditor((s) => s.setCloudToast)
  const [items, setItems] = useState<CloudProject[] | null>(null)
  const [err, setErr] = useState('')

  const refresh = async (): Promise<void> => {
    setErr('')
    const r = await window.api.cloudList()
    if (r.ok) setItems(r.items || [])
    else { setErr(r.error || 'Errore'); setItems([]) }
  }
  useEffect(() => { void refresh() }, [])

  const del = async (p: CloudProject): Promise<void> => {
    if (!confirm(`Eliminare «${p.name}» dal cloud? Non si può annullare.`)) return
    const r = await window.api.cloudDelete(p.id)
    if (r.ok) { setCloudToast('Eliminato'); void refresh() }
    else setCloudToast('Eliminazione fallita: ' + (r.error || ''))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="section-title" style={{ flex: 1 }}>Progetti nel cloud</div>
        <button className="chip" onClick={() => void refresh()} title="Ricarica">⟳</button>
        <button className="chip" onClick={() => openCloud('login')} title="Cambia password">⚙</button>
        <button className="iconbtn" onClick={close} title="Chiudi">✕</button>
      </div>

      <div className="scroll" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
        {items === null && <div className="empty-hint">Carico…</div>}
        {err && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</div>}
        {items && items.length === 0 && !err && (
          <div className="empty-hint" style={{ textAlign: 'left', lineHeight: 1.5 }}>
            Ancora nessun progetto nel cloud. Premi <b>💾 Salva</b> per metterci questo.
          </div>
        )}
        {items && items.map((p) => (
          <div key={p.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
              <div className="field-label" style={{ marginTop: 2 }}>
                {fmtDate(p.modifiedAt)} · {p.segments} tagli{p.hasSocial ? ' · copy ✓' : ''}
              </div>
            </div>
            <button className="btn" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => void loadCloudProject(p.id)}>Apri</button>
            <button className="iconbtn" title="Elimina" style={{ color: 'var(--danger)' }} onClick={() => void del(p)}>🗑</button>
          </div>
        ))}
      </div>
    </div>
  )
}
