import { useState, type DragEvent } from 'react'
import { locateClip, useEditor } from '../state/store'
import { isMediaClip, type MediaClip, type Source } from '@shared/projectSchema'
import { LOOKS } from '@shared/looks'
import { REEL_TEMPLATES } from '@shared/templates'
import { mediaUrl } from '@shared/media'
import { formatClock } from '../util/format'
import { AiPanel } from './AiPanel'

type Tab = 'ai' | 'media' | 'audio' | 'text' | 'effects' | 'transitions' | 'filters'

const TABS: { id: Tab; label: string }[] = [
  { id: 'ai', label: 'AI' },
  { id: 'media', label: 'Media' },
  { id: 'audio', label: 'Audio' },
  { id: 'text', label: 'Testo' },
  { id: 'effects', label: 'Effetti' },
  { id: 'transitions', label: 'Transizioni' },
  { id: 'filters', label: 'Filtri' }
]

/** Thin line icon (stroke-only, no emoji) for each tab. Colour/width come from CSS. */
function TabIcon({ id }: { id: Tab }): JSX.Element {
  const path = (d: string): JSX.Element => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  )
  switch (id) {
    case 'ai':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l1.6 4.9 4.9 1.6-4.9 1.6L12 16l-1.6-4.9L5.5 9.5l4.9-1.6z" />
          <path d="M18.5 3.5v3M17 5h3" />
        </svg>
      )
    case 'media':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.6" />
          <path d="M21 16l-5-5L6 21" />
        </svg>
      )
    case 'audio':
      return path('M4 9v6M8 6v12M12 10v4M16 7v10M20 11v2')
    case 'text':
      return path('M5 6h14M12 6v13M9 19h6')
    case 'effects':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l1.3 3.7 3.7 1.3-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3z" />
          <path d="M18 13l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
        </svg>
      )
    case 'transitions':
      return path('M4 8h12M14 5l3 3-3 3M20 16H8M11 19l-3-3 3-3')
    case 'filters':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
          <circle cx="9" cy="7" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="7" cy="17" r="2" />
        </svg>
      )
  }
}

function useSelectedMediaClipId(): string | null {
  return useEditor((s) => {
    if (!s.selectedClipId) return null
    const loc = locateClip(s.project, s.selectedClipId)
    return loc && isMediaClip(loc.clip) ? loc.clip.id : null
  })
}

export function LeftPanel(): JSX.Element {
  const [tab, setTab] = useState<Tab>('media')
  return (
    <div className="panel panel--left">
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <TabIcon id={t.id} />
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'ai' && <AiPanel />}
      {tab === 'media' && <MediaPanel />}
      {tab === 'audio' && <MediaPanel only="audio" />}
      {tab === 'text' && <TextPanel />}
      {tab === 'effects' && <EffectsPanel />}
      {tab === 'transitions' && <TransitionsPanel />}
      {tab === 'filters' && <FiltersPanel />}
    </div>
  )
}

function MediaPanel({ only }: { only?: 'audio' }): JSX.Element {
  const sources = useEditor((s) => s.project.sources)
  const selectedSourceId = useEditor((s) => s.selectedSourceId)
  const importViaDialog = useEditor((s) => s.importViaDialog)
  const importPaths = useEditor((s) => s.importPaths)
  const selectSource = useEditor((s) => s.selectSource)
  const addSourceToTimeline = useEditor((s) => s.addSourceToTimeline)
  const removeSource = useEditor((s) => s.removeSource)
  const [over, setOver] = useState(false)
  const shown = only === 'audio' ? sources.filter((s) => s.kind === 'audio') : sources

  const onDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setOver(false)
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => window.api.getPathForFile(f))
      .filter(Boolean)
    if (paths.length) importPaths(paths)
  }

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div
        className={`dropzone dropzone--slim ${over ? 'dropzone--over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onClick={importViaDialog}
        title="Clic per importare, o trascina qui i file"
      >
        <span className="dropzone-plus">＋</span>
        <span>Importa o trascina</span>
      </div>

      {shown.length === 0 ? (
        <div className="empty-hint">Nessun media importato.</div>
      ) : (
        <div className="media-grid">
          {shown.map((src) => (
            <MediaCard
              key={src.id}
              src={src}
              selected={src.id === selectedSourceId}
              onSelect={() => selectSource(src.id)}
              onAdd={() => addSourceToTimeline(src.id)}
              onRemove={() => removeSource(src.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MediaCard({
  src,
  selected,
  onSelect,
  onAdd,
  onRemove
}: {
  src: Source
  selected: boolean
  onSelect: () => void
  onAdd: () => void
  onRemove: () => void
}): JSX.Element {
  const icon = src.kind === 'audio' ? '♪' : src.kind === 'image' ? '🖼' : '🎬'
  const addSourceToTrackAt = useEditor((s) => s.addSourceToTrackAt)
  const pxPerSec = useEditor((s) => s.pxPerSec)

  const laneAt = (x: number, y: number): HTMLElement | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const lane = el?.closest('[data-track-id]') as HTMLElement | null
    if (!lane) return null
    const isAudio = lane.getAttribute('data-track-type') === 'audio'
    return isAudio === (src.kind === 'audio') ? lane : null
  }

  // Pointer-based drag from the bin onto a track (HTML5 DnD is unreliable in
  // Electron). Below the move threshold it stays a plain click (select).
  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    const startX = e.clientX
    const startY = e.clientY
    let dragging = false
    let hl: HTMLElement | null = null
    const clearHl = (): void => {
      if (hl) hl.classList.remove('track--drop')
      hl = null
    }
    const onMove = (ev: PointerEvent): void => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return
      dragging = true
      document.body.style.cursor = 'grabbing'
      const lane = laneAt(ev.clientX, ev.clientY)
      if (lane !== hl) {
        clearHl()
        hl = lane
        if (hl) hl.classList.add('track--drop')
      }
    }
    const onUp = (ev: PointerEvent): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      clearHl()
      if (!dragging) return
      const lane = laneAt(ev.clientX, ev.clientY)
      const trackId = lane?.getAttribute('data-track-id')
      if (lane && trackId) {
        const rect = lane.getBoundingClientRect()
        addSourceToTrackAt(src.id, trackId, Math.max(0, (ev.clientX - rect.left) / pxPerSec))
      }
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className={`media-card ${selected ? 'selected' : ''}`}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      onDoubleClick={onAdd}
      title={`${src.fileName}\nTrascina sulla timeline o doppio clic per aggiungere`}
    >
      <button
        className="media-remove"
        title="Rimuovi dal progetto"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
      >
        ✕
      </button>
      <div
        className="media-thumb"
        style={
          src.thumbnailPath ? { backgroundImage: `url(${mediaUrl(src.thumbnailPath)})` } : undefined
        }
      >
        {!src.thumbnailPath && icon}
      </div>
      <div className="media-meta">
        <div className="media-name">{src.fileName}</div>
        <div className="media-sub">
          <span>{src.kind === 'audio' ? 'audio' : `${src.width}×${src.height}`}</span>
          <span>{formatClock(src.durationSec)}</span>
        </div>
        <button
          className="btn"
          style={{ width: '100%', marginTop: 6, height: 26 }}
          onClick={(e) => {
            e.stopPropagation()
            onAdd()
          }}
        >
          + Timeline
        </button>
      </div>
    </div>
  )
}

const TEXT_TEMPLATES: { label: string; text: string; style: Record<string, unknown> }[] = [
  { label: 'Titolo grande', text: 'IL TUO TITOLO', style: { fontSizeFrac: 0.11, bold: true, effect: 'shadow' } },
  { label: 'Neon', text: 'Neon', style: { effect: 'neon', effectColor: '#1fe6c2', color: '#ffffff', fontSizeFrac: 0.1 } },
  { label: 'Evidenziato', text: 'Evidenziato', style: { highlight: true, highlightColor: '#1fe6c2', color: '#101316', effect: 'none' } },
  { label: 'Contorno', text: 'Contorno', style: { effect: 'outline', effectColor: '#000000', color: '#ffffff' } },
  { label: 'Elegante', text: 'Elegante', style: { italic: true, fontFamily: '"Snell Roundhand", cursive', fontSizeFrac: 0.1, effect: 'shadow' } },
  { label: 'Sottotitolo', text: 'Sottotitolo', style: { fontSizeFrac: 0.05, posY: 0.88, effect: 'shadow' } }
]

function TextPanel(): JSX.Element {
  const addTextClip = useEditor((s) => s.addTextClip)
  const importSubtitles = useEditor((s) => s.importSubtitles)
  return (
    <div className="scroll" style={{ flex: 1, padding: 12 }}>
      <div className="section-title" style={{ marginBottom: 8 }}>
        Aggiungi testo
      </div>
      <div className="chip-row">
        <button className="chip" onClick={() => addTextClip('Il tuo titolo')}>
          Titolo
        </button>
        <button className="chip" onClick={() => addTextClip('Sottotitolo')}>
          Sottotitolo
        </button>
        <button className="chip" onClick={() => addTextClip('Testo')}>
          Testo semplice
        </button>
      </div>

      <div className="section-title" style={{ margin: '16px 0 8px' }}>
        Template
      </div>
      <div className="chip-row">
        {TEXT_TEMPLATES.map((t) => (
          <button key={t.label} className="chip" onClick={() => addTextClip(t.text, t.style)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="section-title" style={{ margin: '16px 0 8px' }}>
        Sottotitoli
      </div>
      <button className="btn" style={{ width: '100%' }} onClick={() => void importSubtitles()}>
        ⬇ Importa SRT / VTT
      </button>
      <p className="field-label" style={{ marginTop: 12, lineHeight: 1.5 }}>
        Il testo viene aggiunto sul playhead. Modificalo nel pannello Proprietà a destra.
      </p>
    </div>
  )
}

function EffectsPanel(): JSX.Element {
  const clipId = useSelectedMediaClipId()
  const selCount = useEditor((s) => s.selectedClipIds.length)
  const addEffect = useEditor((s) => s.addEffect)
  if (!clipId) return <div className="empty-hint">Seleziona una clip video per aggiungere effetti.</div>
  return (
    <div className="scroll" style={{ flex: 1, padding: 12 }}>
      <div className="section-title" style={{ marginBottom: 8 }}>
        Aggiungi effetto
      </div>
      {selCount > 1 && (
        <div className="multi-hint">✦ Si applica a tutte le {selCount} clip selezionate</div>
      )}
      <div className="chip-row">
        <button className="chip" onClick={() => addEffect(clipId, 'gblur')}>Sfocatura</button>
        <button className="chip" onClick={() => addEffect(clipId, 'brightness')}>Luminosità</button>
        <button className="chip" onClick={() => addEffect(clipId, 'contrast')}>Contrasto</button>
        <button className="chip" onClick={() => addEffect(clipId, 'saturation')}>Saturazione</button>
        <button className="chip" onClick={() => addEffect(clipId, 'hue')}>Tinta</button>
        <button className="chip" onClick={() => addEffect(clipId, 'sepia')}>Seppia</button>
        <button className="chip" onClick={() => addEffect(clipId, 'grayscale')}>B/N</button>
        <button className="chip" onClick={() => addEffect(clipId, 'vignette')}>Vignettatura</button>
        <button className="chip" onClick={() => addEffect(clipId, 'grain')}>Grana</button>
        <button className="chip" onClick={() => addEffect(clipId, 'invert')}>Negativo</button>
      </div>
      <p className="field-label" style={{ marginTop: 12 }}>Regola i valori nel pannello Proprietà (a destra).</p>
    </div>
  )
}

function TransitionsPanel(): JSX.Element {
  const clipId = useSelectedMediaClipId()
  const setFade = useEditor((s) => s.setFade)
  if (!clipId) return <div className="empty-hint">Seleziona una clip per le dissolvenze.</div>
  return (
    <div className="scroll" style={{ flex: 1, padding: 12 }}>
      <div className="section-title" style={{ marginBottom: 8 }}>
        Transizioni tra clip
      </div>
      <p className="empty-hint" style={{ padding: '0 0 16px', textAlign: 'left' }}>
        Sulla timeline, tra due clip vicine, passa il mouse e clicca il cerchietto <b>＋</b> sul bordo
        destro della prima clip: scegli la transizione (dissolvenza, scorri, tendina, zoom, cerchio…).
        Diventa <b>⤬</b>; ri-cliccalo per cambiarla o rimuoverla.
      </p>
      <div className="section-title" style={{ marginBottom: 8 }}>
        Dissolvenze (inizio/fine clip)
      </div>
      <div className="chip-row">
        <button className="chip" onClick={() => setFade(clipId, 'in', 0.5)}>In 0.5s</button>
        <button className="chip" onClick={() => setFade(clipId, 'out', 0.5)}>Out 0.5s</button>
        <button
          className="chip"
          onClick={() => {
            setFade(clipId, 'in', 1)
            setFade(clipId, 'out', 1)
          }}
        >
          Entrambe 1s
        </button>
        <button
          className="chip"
          onClick={() => {
            setFade(clipId, 'in', 0)
            setFade(clipId, 'out', 0)
          }}
        >
          Rimuovi
        </button>
      </div>
    </div>
  )
}

function FiltersPanel(): JSX.Element {
  const clipId = useSelectedMediaClipId()
  if (!clipId) return <div className="empty-hint">Seleziona una clip per applicare un filtro o un modello.</div>
  return <FiltersPanelInner clipId={clipId} />
}

function FiltersPanelInner({ clipId }: { clipId: string }): JSX.Element {
  const setLook = useEditor((s) => s.setLook)
  const applyReelTemplate = useEditor((s) => s.applyReelTemplate)
  const importLut = useEditor((s) => s.importLut)
  const setLut = useEditor((s) => s.setLut)
  const selCount = useEditor((s) => s.selectedClipIds.length)
  const look = useEditor((s) => {
    for (const t of s.project.timeline.tracks)
      for (const c of t.clips) if (c.id === clipId && c.kind === 'media') return (c as MediaClip).look ?? null
    return null
  })
  const hasLut = useEditor((s) => {
    for (const t of s.project.timeline.tracks)
      for (const c of t.clips) if (c.id === clipId && c.kind === 'media') return !!(c as MediaClip).lut
    return false
  })
  return (
    <div className="scroll" style={{ flex: 1, padding: 12 }}>
      <div className="section-title" style={{ marginBottom: 8 }}>Filtri (look)</div>
      {selCount > 1 && (
        <div className="multi-hint">✦ Si applica a tutte le {selCount} clip selezionate</div>
      )}
      <div className="chip-row">
        {LOOKS.map((lk) => (
          <button
            key={lk.id}
            className={`chip ${(look?.id ?? 'none') === lk.id ? 'chip--active' : ''}`}
            onClick={() => setLook(clipId, lk.id)}
          >
            {lk.label}
          </button>
        ))}
      </div>
      {look && look.id !== 'none' && (
        <div style={{ marginTop: 8 }}>
          <span className="field-label">Intensità {Math.round((look.intensity ?? 1) * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={look.intensity ?? 1}
            style={{ width: '100%' }}
            onChange={(e) => setLook(clipId, look.id, parseFloat(e.target.value))}
          />
        </div>
      )}

      <div className="section-title" style={{ margin: '16px 0 8px' }}>Modelli reel (1 click)</div>
      <p className="field-label" style={{ margin: '0 0 8px' }}>Stilizza TUTTO il reel: colore + transizioni.</p>
      <div className="chip-row">
        {REEL_TEMPLATES.map((tpl) => (
          <button key={tpl.id} className="chip" title={`Applica «${tpl.label}» a tutto il reel`} onClick={() => applyReelTemplate(tpl.id)}>
            {tpl.label}
          </button>
        ))}
      </div>

      <div className="section-title" style={{ margin: '16px 0 8px' }}>LUT colore (.cube)</div>
      <button className="btn" style={{ width: '100%' }} onClick={() => void importLut(clipId)}>
        🎨 {hasLut ? 'Sostituisci LUT…' : 'Importa LUT…'}
      </button>
      {hasLut && (
        <button className="btn" style={{ width: '100%', marginTop: 6, color: 'var(--danger)' }} onClick={() => setLut(clipId, null)}>
          Rimuovi LUT
        </button>
      )}
    </div>
  )
}
