import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useCarosello } from '../state/caroselloStore'
import { exportAllPng } from '../export'

function pickImage(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (): void => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      const reader = new FileReader()
      reader.onload = (): void => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = (): void => resolve(null)
      reader.readAsDataURL(file)
    }
    input.click()
  })
}

function pickJson(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.jsonc,.txt,application/json'
    input.onchange = (): void => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      const reader = new FileReader()
      reader.onload = (): void => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = (): void => resolve(null)
      reader.readAsText(file)
    }
    input.click()
  })
}

export function Toolbar(): JSX.Element {
  const format = useCarosello((s) => s.project.format)
  const setFormat = useCarosello((s) => s.setFormat)
  const addText = useCarosello((s) => s.addText)
  const addPhoto = useCarosello((s) => s.addPhoto)
  const setSlideBg = useCarosello((s) => s.setSlideBg)
  const currentIndex = useCarosello((s) => s.currentIndex)
  const importBrief = useCarosello((s) => s.importBrief)
  const reset = useCarosello((s) => s.reset)
  const project = useCarosello((s) => s.project)

  const [showImport, setShowImport] = useState(false)
  const [briefText, setBriefText] = useState('')
  const [err, setErr] = useState('')
  const [exporting, setExporting] = useState(false)

  async function onBg(): Promise<void> {
    const url = await pickImage()
    if (url) setSlideBg(currentIndex, url)
  }
  async function onPhoto(): Promise<void> {
    const url = await pickImage()
    if (url) addPhoto(url)
  }
  function doImport(): void {
    const res = importBrief(briefText)
    if (res.ok) {
      setShowImport(false)
      setBriefText('')
      setErr('')
    } else {
      setErr(res.error || 'Errore di importazione')
    }
  }
  async function onExport(): Promise<void> {
    setExporting(true)
    try {
      await exportAllPng(project)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="car-toolbar">
      <span className="car-title">🖼️ Caroselli</span>
      <div className="car-seg">
        {(['4:5', '1:1'] as const).map((f) => (
          <button key={f} className={format === f ? 'on' : ''} onClick={() => setFormat(f)}>
            {f}
          </button>
        ))}
      </div>
      <button className="car-btn" onClick={() => setShowImport(true)}>
        📥 Importa Brief
      </button>
      <button className="car-btn" onClick={addText}>
        + Testo
      </button>
      <button className="car-btn" onClick={() => void onBg()}>
        🌄 Sfondo…
      </button>
      <button className="car-btn" onClick={() => void onPhoto()}>
        🧑 Foto Elisa…
      </button>
      <span className="sp" />
      <button
        className="car-btn ghost"
        onClick={() => {
          if (window.confirm('Svuotare tutto il carosello?')) reset()
        }}
      >
        Reset
      </button>
      <button className="car-btn primary" disabled={exporting} onClick={() => void onExport()}>
        {exporting ? 'Esporto…' : '⬇ Esporta PNG'}
      </button>

      {showImport && (
        <div style={overlay} onClick={() => setShowImport(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>Importa «Carosello Build Brief»</h3>
            <p className="car-hint" style={{ marginTop: 0 }}>
              Incolla il JSON prodotto da <b>/carosello</b> (va bene anche dentro ```json … ```).
            </p>
            <textarea
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              placeholder='{ "meta": { "formato": "4:5" }, "slides": [ … ] }'
              style={textareaStyle}
            />
            {err && <div style={{ color: '#ff7a7a', fontSize: 12, marginTop: 6 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
              <button
                className="car-btn"
                onClick={() =>
                  void pickJson().then((t) => {
                    if (t) setBriefText(t)
                  })
                }
              >
                Da file .json
              </button>
              <span style={{ flex: 1 }} />
              <button className="car-btn ghost" onClick={() => setShowImport(false)}>
                Annulla
              </button>
              <button className="car-btn primary" onClick={doImport}>
                Carica
              </button>
            </div>
          </div>
        </div>
      )}
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
  width: 560,
  maxWidth: '92vw',
  background: '#1d1d24',
  border: '1px solid #34343c',
  borderRadius: 12,
  padding: 16,
  color: '#e6e6ea',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
}
const textareaStyle: CSSProperties = {
  width: '100%',
  height: 240,
  boxSizing: 'border-box',
  background: '#101015',
  border: '1px solid #34343c',
  borderRadius: 8,
  color: '#e6e6ea',
  padding: 10,
  fontFamily: 'ui-monospace, Menlo, monospace',
  fontSize: 12
}
