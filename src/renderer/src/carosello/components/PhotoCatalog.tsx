import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import { useCarosello } from '../state/caroselloStore'
import { pickImage, readFileAsDataURL } from '../pick'

interface Entry {
  file: string
  best?: boolean
  desc?: string
}
interface Cache {
  entries: Entry[]
  files: Map<string, File>
  urls: Map<string, string>
}
// Module-level cache so re-opening the picker doesn't require re-choosing the folder.
let CACHE: Cache | null = null

/** In-app picker that reads the "Elisa immagini" folder + its _catalogo-immagini.json,
 *  letting you search Elisa's photos by description and insert one as a layer.
 *  Renderer-only (webkitdirectory input) — no main/preload changes. */
export function PhotoCatalog({ onClose }: { onClose: () => void }): JSX.Element {
  const addPhoto = useCarosello((s) => s.addPhoto)
  const [entries, setEntries] = useState<Entry[]>(CACHE?.entries ?? [])
  const [q, setQ] = useState('')
  const [onlyBest, setOnlyBest] = useState(true)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.setAttribute('webkitdirectory', '')
      el.setAttribute('directory', '')
    }
  }, [])

  async function onPick(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const list = e.target.files
    if (!list || !list.length) return
    setLoading(true)
    setErr('')
    try {
      const files = new Map<string, File>()
      const urls = new Map<string, string>()
      let catalogFile: File | null = null
      for (const f of Array.from(list)) {
        files.set(f.name, f)
        if (f.name === '_catalogo-immagini.json') catalogFile = f
        else if (/\.(jpe?g|png)$/i.test(f.name)) urls.set(f.name, URL.createObjectURL(f))
      }
      let ents: Entry[]
      if (catalogFile) {
        const doc = JSON.parse(await catalogFile.text())
        ents = Array.isArray(doc.images) ? (doc.images as Entry[]) : []
      } else {
        ents = Array.from(urls.keys()).map((n) => ({ file: n }))
        setOnlyBest(false)
      }
      CACHE = { entries: ents, files, urls }
      setEntries(ents)
    } catch (ex) {
      setErr('Errore lettura cartella: ' + (ex as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const ql = q.trim().toLowerCase()
  const shown = entries.filter((en) => {
    if (onlyBest && !en.best) return false
    if (!ql) return true
    return (en.file + ' ' + (en.desc || '')).toLowerCase().includes(ql)
  })

  async function choose(en: Entry): Promise<void> {
    const f = CACHE?.files.get(en.file)
    if (!f) return
    const url = await readFileAsDataURL(f)
    if (url) {
      addPhoto(url)
      onClose()
    }
  }

  async function other(): Promise<void> {
    const url = await pickImage()
    if (url) {
      addPhoto(url)
      onClose()
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <h3 style={{ margin: 0, flex: 1 }}>Foto di Elisa</h3>
          <button className="car-btn ghost" onClick={() => void other()}>
            Altra immagine…
          </button>
          <button className="car-btn ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        {entries.length === 0 ? (
          <div>
            <p className="car-hint">
              Scegli una volta la cartella <b>“Elisa immagini”</b>: l'app legge il catalogo e
              potrai cercare le foto per descrizione (es. <i>occhi chiusi</i>, <i>libro</i>,{' '}
              <i>spazio sinistra</i>).
            </p>
            <button className="car-btn primary" onClick={() => inputRef.current?.click()}>
              📁 Scegli cartella “Elisa immagini”
            </button>
            {loading && <span style={{ marginLeft: 8 }}>Carico…</span>}
            {err && <div style={{ color: '#ff7a7a', marginTop: 8, fontSize: 12 }}>{err}</div>}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Cerca: sorriso, occhi chiusi, libro, abito rosso, spazio sinistra…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={searchInput}
              />
              <label className="car-chk">
                <input type="checkbox" checked={onlyBest} onChange={(e) => setOnlyBest(e.target.checked)} />{' '}
                solo best
              </label>
              <span className="car-hint">{shown.length}</span>
            </div>
            <div style={grid}>
              {shown.map((en) => (
                <button key={en.file} title={en.desc} onClick={() => void choose(en)} style={cell}>
                  <img
                    src={CACHE?.urls.get(en.file)}
                    alt=""
                    loading="lazy"
                    style={{ width: '100%', display: 'block', borderRadius: 6 }}
                  />
                  {en.best && <span style={bestBadge}>★</span>}
                </button>
              ))}
            </div>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => void onPick(e)}
        />
      </div>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}
const modal: CSSProperties = {
  width: 720,
  maxWidth: '94vw',
  maxHeight: '88vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#1d1d24',
  border: '1px solid #34343c',
  borderRadius: 12,
  padding: 16,
  color: '#e6e6ea',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
}
const searchInput: CSSProperties = {
  flex: 1,
  background: '#101015',
  border: '1px solid #34343c',
  borderRadius: 8,
  color: '#e6e6ea',
  padding: '6px 10px',
  fontSize: 13
}
const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
  gap: 6,
  overflowY: 'auto',
  paddingRight: 4
}
const cell: CSSProperties = {
  position: 'relative',
  border: 0,
  background: 'transparent',
  padding: 0,
  cursor: 'pointer'
}
const bestBadge: CSSProperties = {
  position: 'absolute',
  top: 3,
  right: 5,
  color: '#ffd24a',
  fontSize: 13,
  textShadow: '0 1px 2px #000'
}
