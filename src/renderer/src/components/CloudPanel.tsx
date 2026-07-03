import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../state/store'
import type { CloudProject } from '@shared/cloud'

/** Today as a local 'YYYY-MM-DD' string (matches the stored schedule format). */
function todayISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Parse a 'YYYY-MM-DD' as a LOCAL date (avoids the UTC midnight off-by-one). */
function parseLocalDate(iso?: string | null): Date | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** Full Italian date for the calendar, e.g. "Lunedì 6 Luglio 2026". */
function fmtSchedule(iso?: string | null): string {
  const d = parseLocalDate(iso)
  if (!d) return ''
  const s = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

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
        {mode === 'choose' ? <CloudChoose /> : mode === 'save' ? <CloudSaveName /> : mode === 'login' ? <CloudLogin /> : <CloudList />}
      </div>
    </>
  )
}

function CloudSaveName(): JSX.Element {
  const close = useEditor((s) => s.closeCloud)
  const confirmCloudSave = useEditor((s) => s.confirmCloudSave)
  const currentName = useEditor((s) => s.project.name)
  const currentDate = useEditor((s) => s.project.scheduledDate || '')
  const [name, setName] = useState(currentName || '')
  const [date, setDate] = useState(currentDate)
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    if (!name.trim()) return
    setBusy(true)
    await confirmCloudSave(name.trim(), date || null)
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="section-title" style={{ flex: 1 }}>Salva sul cloud</div>
        <button className="iconbtn" onClick={close} title="Chiudi">✕</button>
      </div>
      <p className="field-label" style={{ lineHeight: 1.5, margin: 0 }}>
        Dai un nome al progetto. <b>Stesso nome</b> = sovrascrive quello esistente; <b>nome nuovo</b> = nuovo progetto.
      </p>
      <input
        className="input"
        placeholder="Nome del progetto"
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) void submit() }}
        style={{ width: '100%' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label className="field-label" style={{ margin: 0 }}>Data di pubblicazione <span style={{ opacity: 0.7 }}>(facoltativa)</span></label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ flex: 1 }}
          />
          {date && (
            <button className="chip" title="Togli la data" onClick={() => setDate('')}>Senza data</button>
          )}
        </div>
        {date
          ? <div className="field-label" style={{ margin: 0, color: 'var(--accent, #1fe6c2)' }}>📅 {fmtSchedule(date)}</div>
          : <div className="field-label" style={{ margin: 0 }}>Se non metti la data, la potrai aggiungere più avanti dalla lista.</div>}
      </div>
      <button className="btn btn--primary" disabled={busy || !name.trim()} onClick={() => void submit()}>
        {busy ? 'Salvo…' : '💾 Salva sul cloud'}
      </button>
    </div>
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
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const today = todayISO()

  const refresh = async (): Promise<void> => {
    setErr('')
    const r = await window.api.cloudList()
    if (r.ok) setItems(r.items || [])
    else { setErr(r.error || 'Errore'); setItems([]) }
  }
  useEffect(() => { void refresh() }, [])

  // Calendario editoriale: prima i programmati in ordine di data (dal più lontano nel
  // passato al futuro), poi in fondo i "senza data" (i più recenti in cima).
  const sorted = useMemo(() => {
    const arr = [...(items || [])]
    arr.sort((a, b) => {
      const da = a.scheduledDate || ''
      const db = b.scheduledDate || ''
      if (da && db) return da.localeCompare(db)
      if (da) return -1
      if (db) return 1
      return (b.modifiedAt || '').localeCompare(a.modifiedAt || '')
    })
    return arr
  }, [items])

  const firstUndatedId = sorted.find((p) => !p.scheduledDate)?.id

  const del = async (p: CloudProject): Promise<void> => {
    if (!confirm(`Eliminare «${p.name}» dal cloud? Non si può annullare.`)) return
    const r = await window.api.cloudDelete(p.id)
    if (r.ok) { setCloudToast('Eliminato'); void refresh() }
    else setCloudToast('Eliminazione fallita: ' + (r.error || ''))
  }

  const setSchedule = async (p: CloudProject, date: string): Promise<void> => {
    const r = await window.api.cloudSetSchedule(p.id, date || null)
    if (r.ok) {
      // Aggiorna subito in locale (poi riordina), evita un giro completo di rete.
      setItems((prev) => (prev || []).map((x) => (x.id === p.id ? { ...x, scheduledDate: date || null } : x)))
    } else setCloudToast('Data non aggiornata: ' + (r.error || ''))
  }

  const goToday = (): void => {
    const target = sorted.find((p) => p.scheduledDate && p.scheduledDate >= today)
    const el = target ? itemRefs.current[target.id] : null
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else setCloudToast('Nessun progetto programmato da oggi in poi')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="section-title" style={{ flex: 1 }}>Calendario progetti</div>
        <button className="btn" style={{ width: 'auto', padding: '6px 14px', fontWeight: 700 }} onClick={goToday} title="Scorri fino a oggi">📅 Oggi</button>
        <button className="chip" onClick={() => void refresh()} title="Ricarica">⟳</button>
        <button className="chip" onClick={() => openCloud('login')} title="Cambia password">⚙</button>
        <button className="iconbtn" onClick={close} title="Chiudi">✕</button>
      </div>

      <div ref={scrollRef} className="scroll" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
        {items === null && <div className="empty-hint">Carico…</div>}
        {err && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</div>}
        {items && items.length === 0 && !err && (
          <div className="empty-hint" style={{ textAlign: 'left', lineHeight: 1.5 }}>
            Ancora nessun progetto nel cloud. Premi <b>💾 Salva</b> per metterci questo.
          </div>
        )}
        {sorted.map((p) => {
          const isToday = p.scheduledDate === today
          const isPast = !!p.scheduledDate && p.scheduledDate < today
          return (
            <div key={p.id}>
              {p.id === firstUndatedId && (
                <div className="field-label" style={{ margin: '6px 2px 4px', opacity: 0.7 }}>— Senza data —</div>
              )}
              <div
                ref={(el) => { itemRefs.current[p.id] = el }}
                className="card"
                style={{
                  padding: 12, display: 'flex', alignItems: 'center', gap: 10, margin: 0,
                  border: isToday ? '1px solid var(--accent, #1fe6c2)' : undefined,
                  boxShadow: isToday ? '0 0 0 1px var(--accent, #1fe6c2) inset' : undefined
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isToday && <span style={{ color: 'var(--accent, #1fe6c2)', marginRight: 6 }}>● Oggi</span>}
                    {p.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <input
                      type="date"
                      className="input"
                      value={p.scheduledDate || ''}
                      title="Imposta o cambia la data di pubblicazione"
                      onChange={(e) => void setSchedule(p, e.target.value)}
                      style={{ width: 'auto', padding: '4px 8px', height: 'auto', fontSize: 12 }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, opacity: isPast ? 0.55 : 1, color: isToday ? 'var(--accent, #1fe6c2)' : undefined }}>
                      {p.scheduledDate ? fmtSchedule(p.scheduledDate) : 'Senza data'}
                    </span>
                    {p.scheduledDate && (
                      <button className="chip" title="Togli la data" onClick={() => void setSchedule(p, '')} style={{ padding: '2px 8px' }}>✕</button>
                    )}
                  </div>
                  <div className="field-label" style={{ marginTop: 4 }}>
                    {fmtDate(p.modifiedAt)} · {p.segments} tagli{p.hasSocial ? ' · copy ✓' : ''}{p.hasVideo ? ` · 🎬 ${p.videoMB} MB` : ''}
                  </div>
                </div>
                {p.hasVideo && (
                  <button
                    className="iconbtn"
                    title="Scarica il video finito"
                    onClick={async () => {
                      const url = await window.api.cloudVideoUrl(p.id)
                      if (url) void window.api.openExternal(url)
                    }}
                  >
                    ⬇
                  </button>
                )}
                <button className="btn" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => void loadCloudProject(p.id)}>Apri</button>
                <button className="iconbtn" title="Elimina" style={{ color: 'var(--danger)' }} onClick={() => void del(p)}>🗑</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
