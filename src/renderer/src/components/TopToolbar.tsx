import { useState } from 'react'
import { useEditor } from '../state/store'
import { ExportMenu } from './ExportMenu'
import { UpdateButton } from './UpdateButton'
import { PROFILES, type PerformanceTier } from '@shared/performance'
import { ASPECT_PRESETS, type AspectPreset } from '@shared/projectSchema'

const ASPECTS: AspectPreset[] = ['9:16', '16:9', '1:1', '4:5']
const TIERS: PerformanceTier[] = ['light', 'balanced', 'high']

function currentAspect(w: number, h: number): AspectPreset | '' {
  for (const k of Object.keys(ASPECT_PRESETS) as AspectPreset[]) {
    if (ASPECT_PRESETS[k].width === w && ASPECT_PRESETS[k].height === h) return k
  }
  return ''
}

export function TopToolbar(): JSX.Element {
  const name = useEditor((s) => s.project.name)
  const canvasW = useEditor((s) => s.project.canvas.width)
  const canvasH = useEditor((s) => s.project.canvas.height)
  const setAspect = useEditor((s) => s.setAspect)
  const setTier = useEditor((s) => s.setTier)
  const tier = useEditor((s) => s.tier)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const exporting = useEditor((s) => s.exporting)
  const newProject = useEditor((s) => s.newProject)
  const saveProject = useEditor((s) => s.saveProject)
  const openProject = useEditor((s) => s.openProject)
  const [exportOpen, setExportOpen] = useState(false)

  const aspect = currentAspect(canvasW, canvasH)

  return (
    <div className="toolbar">
      <span className="brand">Video AI</span>

      <button
        className="iconbtn"
        title="Nuovo progetto (svuota la timeline, mantiene il pannello Media)"
        onClick={() => {
          if (confirm('Svuotare la timeline? Le sorgenti nel pannello Media restano. Puoi annullare con ⌘Z.')) newProject()
        }}
      >
        ✚
      </button>
      <button className="iconbtn" title="Apri dal cloud (VPS)…" onClick={() => void openProject()}>
        📂
      </button>
      <button className="iconbtn" title="Salva sul cloud (VPS) — ⌘S" onClick={() => void saveProject()}>
        💾
      </button>
      <button className="iconbtn" title="Progetti nel cloud (apri / elimina)" onClick={() => void openProject()}>
        ☁
      </button>

      <input
        className="input input--ghost"
        style={{ width: 180 }}
        value={name}
        onChange={(e) =>
          useEditor.setState((s) => {
            s.project.name = e.target.value
          })
        }
        spellCheck={false}
      />

      <span className="spacer" />

      <button className="iconbtn" title="Annulla (⌘Z)" onClick={undo} disabled={!canUndo}>
        ↩
      </button>
      <button className="iconbtn" title="Ripeti (⌘⇧Z)" onClick={redo} disabled={!canRedo}>
        ↪
      </button>

      <UpdateButton />

      <label className="timecode" style={{ marginLeft: 8 }}>
        Formato
      </label>
      <select
        className="select"
        value={aspect}
        onChange={(e) => setAspect(e.target.value as AspectPreset)}
      >
        {aspect === '' && <option value="">{canvasW}×{canvasH}</option>}
        {ASPECTS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      <select
        className="select"
        value={tier}
        onChange={(e) => setTier(e.target.value as PerformanceTier)}
        title="Profilo prestazioni"
      >
        {TIERS.map((t) => (
          <option key={t} value={t}>
            {PROFILES[t].label}
          </option>
        ))}
      </select>

      <div style={{ position: 'relative' }}>
        <button
          className="btn btn--primary"
          onClick={() => setExportOpen((v) => !v)}
          disabled={!!exporting}
          title="Opzioni di export"
        >
          {exporting ? `Esporto… ${Math.round(exporting.percent)}%` : 'Esporta ▾'}
        </button>
        {exportOpen && (
          <>
            <div className="popover-backdrop" onPointerDown={() => setExportOpen(false)} />
            <ExportMenu onClose={() => setExportOpen(false)} />
          </>
        )}
      </div>
    </div>
  )
}
