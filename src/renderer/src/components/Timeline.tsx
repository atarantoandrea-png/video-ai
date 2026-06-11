import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../state/store'
import { timelineDuration, type Clip, type Project, type Track, type TransitionPreset } from '@shared/projectSchema'
import { mediaUrl } from '@shared/media'
import { formatTick } from '../util/format'
import { ContextMenu, type MenuItem } from './ContextMenu'

const RULER_H = 26

const TRANSITION_PRESETS: { preset: TransitionPreset; label: string }[] = [
  { preset: 'fade', label: 'Dissolvenza' },
  { preset: 'slideleft', label: 'Scorri ←' },
  { preset: 'slideright', label: 'Scorri →' },
  { preset: 'slideup', label: 'Scorri ↑' },
  { preset: 'slidedown', label: 'Scorri ↓' },
  { preset: 'wipeleft', label: 'Tendina ←' },
  { preset: 'wiperight', label: 'Tendina →' },
  { preset: 'wipeup', label: 'Tendina ↑' },
  { preset: 'wipedown', label: 'Tendina ↓' },
  { preset: 'zoomin', label: 'Zoom avanti' },
  { preset: 'zoomout', label: 'Zoom indietro' },
  { preset: 'spin', label: 'Rotazione' },
  { preset: 'circleopen', label: 'Cerchio' },
  { preset: 'irisbox', label: 'Riquadro' },
  { preset: 'splith', label: 'Apri ↔' },
  { preset: 'splitv', label: 'Apri ↕' },
  { preset: 'wipetl', label: 'Diagonale ↖' },
  { preset: 'wipetr', label: 'Diagonale ↗' },
  { preset: 'wipebl', label: 'Diagonale ↙' },
  { preset: 'wipebr', label: 'Diagonale ↘' }
]

function trackHeight(type: Track['type'], scale = 1): number {
  // Audio a touch taller (CapCut-like) so the waveform reads clearly.
  const base = type === 'video' ? 120 : type === 'audio' ? 80 : 42
  return Math.round(base * scale)
}

/** All snap targets (seconds): 0, playhead, every other clip's edges. */
function snapPoints(project: Project, playhead: number, excludeClipId: string): number[] {
  const pts = new Set<number>([0, playhead])
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue
      pts.add(clip.timelineStart)
      pts.add(clip.timelineEnd)
    }
  }
  return [...pts]
}

function snap(value: number, points: number[], pxPerSec: number, thresholdPx = 11): number {
  let best = value
  let bestDist = thresholdPx / pxPerSec
  for (const p of points) {
    const d = Math.abs(p - value)
    if (d < bestDist) {
      best = p
      bestDist = d
    }
  }
  return best
}

/** Ids of clips whose timeline box intersects a marquee rectangle (timeline-inner px). */
function clipsInRect(
  tracks: Track[],
  pxPerSec: number,
  scale: number,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number
): string[] {
  const ids: string[] = []
  let y = RULER_H
  for (const track of tracks) {
    const h = trackHeight(track.type, scale)
    if (y + h > ry0 && y < ry1) {
      for (const clip of track.clips) {
        const cx0 = clip.timelineStart * pxPerSec
        const cx1 = clip.timelineEnd * pxPerSec
        if (cx1 > rx0 && cx0 < rx1) ids.push(clip.id)
      }
    }
    y += h
  }
  return ids
}

export function Timeline(): JSX.Element {
  const tracks = useEditor((s) => s.project.timeline.tracks)
  const pxPerSec = useEditor((s) => s.pxPerSec)
  const playhead = useEditor((s) => s.playhead)
  const duration = useEditor((s) => timelineDuration(s.project.timeline))
  const selectedClipIds = useEditor((s) => s.selectedClipIds)
  const setZoom = useEditor((s) => s.setZoom)
  const setPlayhead = useEditor((s) => s.setPlayhead)
  const selectClip = useEditor((s) => s.selectClip)
  const setSelectedClips = useEditor((s) => s.setSelectedClips)
  const removeSelectedClips = useEditor((s) => s.removeSelectedClips)
  const splitAtPlayhead = useEditor((s) => s.splitAtPlayhead)
  const bladeMode = useEditor((s) => s.bladeMode)
  const toggleBladeMode = useEditor((s) => s.toggleBladeMode)
  const toggleShortcuts = useEditor((s) => s.toggleShortcuts)
  const trackScale = useEditor((s) => s.trackScale)
  const setTrackScale = useEditor((s) => s.setTrackScale)
  const markers = useEditor((s) => s.project.markers)
  const removeMarker = useEditor((s) => s.removeMarker)
  const [menu, setMenu] = useState<{ x: number; y: number; clipId: string | null } | null>(null)
  const [transPick, setTransPick] = useState<{ clipId: string; x: number; y: number } | null>(null)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const transitionItems = (clipId: string): MenuItem[] => {
    const st = useEditor.getState()
    let cur: string | undefined
    for (const t of st.project.timeline.tracks) {
      const c = t.clips.find((x) => x.id === clipId)
      if (c && c.kind === 'media') cur = c.transitionOut?.preset
    }
    return [
      ...TRANSITION_PRESETS.map((tp) => ({
        label: (cur === tp.preset ? '● ' : '') + tp.label,
        onClick: () => st.applyTransition(clipId, 0.5, tp.preset)
      })),
      { separator: true },
      { label: 'Rimuovi transizione', danger: true, onClick: () => st.removeTransition(clipId) }
    ]
  }

  const buildMenu = (clipId: string | null): MenuItem[] => {
    const st = useEditor.getState()
    if (clipId) {
      return [
        { label: 'Taglia (split)', shortcut: 'S', onClick: () => st.splitAtPlayhead() },
        { label: 'Duplica', shortcut: '⌘D', onClick: () => st.duplicateClip(clipId) },
        { label: 'Copia', shortcut: '⌘C', onClick: () => st.copyClip(clipId) },
        { label: 'Incolla', shortcut: '⌘V', disabled: !st.clipboard, onClick: () => st.pasteClip() },
        { separator: true },
        { label: 'Specchia orizzontale', onClick: () => st.flipClip(clipId, 'h') },
        { label: 'Specchia verticale', onClick: () => st.flipClip(clipId, 'v') },
        { label: 'Blocca fotogramma', shortcut: '⇧F', onClick: () => void st.freezeFrame(clipId) },
        { separator: true },
        st.selectedClipIds.length > 1
          ? {
              label: `Elimina ${st.selectedClipIds.length} clip`,
              shortcut: '⌫',
              danger: true,
              onClick: () => st.removeSelectedClips()
            }
          : { label: 'Elimina (chiudi spazio)', shortcut: '⌫', danger: true, onClick: () => st.rippleDelete(clipId) },
        { label: 'Elimina lasciando lo spazio', shortcut: '⇧⌫', danger: true, onClick: () => st.removeClip(clipId) }
      ]
    }
    return [
      { label: 'Incolla', shortcut: '⌘V', disabled: !st.clipboard, onClick: () => st.pasteClip() },
      { label: 'Aggiungi marker', shortcut: 'M', onClick: () => st.addMarker() },
      { separator: true },
      { label: 'Aggiungi traccia video', onClick: () => st.addTrack('video') },
      { label: 'Aggiungi traccia audio', onClick: () => st.addTrack('audio') }
    ]
  }
  const innerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  // Visible horizontal window (scrollLeft + viewport width). Clip thumbnails and
  // waveforms render ONLY this slice at full resolution, so they stay crisp at
  // any zoom instead of stretching a fixed-size image across a huge clip.
  const [view, setView] = useState({ left: 0, width: 1 })
  const rafRef = useRef(0)

  const syncView = (): void => {
    const el = scrollRef.current
    if (!el) return
    // OVERSCAN: draw a window ~0.6 viewport WIDER on each side than what's visible, and
    // re-draw it ONLY when the visible viewport nears that window's edge. While scrolling
    // inside the margin nothing changes in React state — the already-drawn filmstrip/
    // waveform scroll NATIVELY with the clips, so they stay glued. (Before, the slice was
    // re-rendered + repositioned every scroll frame; on a loaded machine that lagged a
    // frame behind the native scroll, making the waveform look out of sync with the clip.)
    const sl = el.scrollLeft
    const cw = el.clientWidth
    const buf = Math.round(cw * 0.6)
    setView((v) => {
      const within =
        v.width > 1 &&
        sl >= v.left + buf * 0.4 &&
        sl + cw <= v.left + v.width - buf * 0.4
      if (within) return v // visible area still inside the drawn window → no redraw
      const next = { left: Math.max(0, sl - buf), width: cw + buf * 2 }
      return next.left === v.left && next.width === v.width ? v : next
    })
  }

  const contentSec = Math.max(duration + 4, 12)
  const contentWidth = contentSec * pxPerSec

  // Keep the visible window in sync on mount, zoom change, and container resize.
  useEffect(() => {
    syncView()
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => syncView())
    ro.observe(el)
    return () => ro.disconnect()
  }, [pxPerSec])

  // Re-sync the visible window after any content change (trim, move, add, AI build).
  // The virtualized filmstrip/waveform renders only the slice inside `view`; without
  // this, editing a clip while `view` is stale could make it render blank until a
  // zoom/scroll refreshed the window. Cheap thanks to syncView's no-op guard.
  useEffect(() => {
    syncView()
  }, [tracks, contentWidth])

  // Trackpad pinch / ctrl+wheel zoom, anchored at the cursor. Native non-passive
  // listener so we can preventDefault (otherwise the page would zoom).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = (e: WheelEvent): void => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const offsetInView = e.clientX - rect.left
      const cur = useEditor.getState().pxPerSec
      const timeAtCursor = (offsetInView + el.scrollLeft) / cur
      const factor = Math.exp(-e.deltaY * 0.0025)
      const newPx = Math.max(4, Math.min(2000, cur * factor))
      useEditor.getState().setZoom(newPx)
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, timeAtCursor * newPx - offsetInView)
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const seek = (clientX: number): void => {
    const el = innerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPlayhead(Math.max(0, (clientX - rect.left) / pxPerSec))
  }

  /** Seek, then keep seeking while the pointer is dragged (scrub). */
  const beginScrub = (clientX: number): void => {
    seek(clientX)
    const onMove = (ev: PointerEvent): void => seek(ev.clientX)
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  return (
    <div className={`timeline ${bladeMode ? 'blade-mode' : ''}`}>
      <div className="timeline-toolbar">
        <button className="iconbtn" title="Dividi al cursore (S)" onClick={splitAtPlayhead}>
          ✂
        </button>
        <button
          className={`iconbtn ${bladeMode ? 'iconbtn--on' : ''}`}
          title="Lametta: clicca una clip per tagliarla lì (B)"
          onClick={toggleBladeMode}
        >
          🔪
        </button>
        <button
          className="iconbtn"
          title={selectedClipIds.length > 1 ? `Elimina ${selectedClipIds.length} clip (⌫)` : 'Elimina (⌫)'}
          onClick={removeSelectedClips}
        >
          🗑
        </button>
        <span style={{ flex: 1 }} />
        <span className="timecode" title="Altezza tracce">⇕</span>
        <input
          className="row-zoom"
          type="range"
          min={0.55}
          max={1.8}
          step={0.05}
          value={trackScale}
          title="Altezza tracce"
          onChange={(e) => setTrackScale(parseFloat(e.target.value))}
        />
        <span style={{ width: 10 }} />
        <button
          className="iconbtn"
          title="Adatta tutta la timeline alla finestra"
          onClick={() => {
            const w = scrollRef.current?.clientWidth ?? 1000
            if (duration > 0) setZoom((w - 40) / duration)
          }}
        >
          ⤢
        </button>
        <span className="timecode">{pxPerSec < 1 ? pxPerSec.toFixed(2) : Math.round(pxPerSec)} px/s</span>
        <button className="iconbtn" title="Riduci zoom" onClick={() => setZoom(pxPerSec / 1.3)}>
          −
        </button>
        <button className="iconbtn" title="Aumenta zoom" onClick={() => setZoom(pxPerSec * 1.3)}>
          ＋
        </button>
        <button className="iconbtn" title="Scorciatoie da tastiera (?)" onClick={() => toggleShortcuts()}>
          ⌨︎
        </button>
      </div>

      <div className="timeline-body">
        <div className="track-gutter" ref={gutterRef}>
          <div className="gutter-ruler-spacer" style={{ height: RULER_H }} />
          {tracks.map((track, i) => (
            <TrackHeader key={track.id} track={track} index={i} count={tracks.length} scale={trackScale} />
          ))}
          <AddTrackButton />
        </div>

        <div
          className="timeline-scroll"
          ref={scrollRef}
          onScroll={(e) => {
            if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop
            if (!rafRef.current)
              rafRef.current = requestAnimationFrame(() => {
                rafRef.current = 0
                syncView()
              })
          }}
          onContextMenu={(e) => {
            const el = (e.target as HTMLElement).closest('[data-clip-id]') as HTMLElement | null
            const clipId = el?.getAttribute('data-clip-id') ?? null
            if ((e.target as HTMLElement).closest('.ruler-marker')) return // markers have their own menu
            e.preventDefault()
            if (clipId && !useEditor.getState().selectedClipIds.includes(clipId)) selectClip(clipId)
            setMenu({ x: e.clientX, y: e.clientY, clipId })
          }}
        >
          <div
            className="timeline-inner"
            ref={innerRef}
            style={{ width: contentWidth }}
            onPointerDown={(e) => {
              // Marquee selection / seek on empty timeline space (clips & controls stopPropagation or are skipped).
              if (e.button !== 0) return
              const t = e.target as HTMLElement
              if (t.closest('[data-clip-id], .ruler, .ruler-marker, .playhead, .trans-region, .trans-add, .clip-handle')) return
              const inner = innerRef.current
              if (!inner) return
              const rect = inner.getBoundingClientRect()
              const x0 = e.clientX - rect.left
              const y0 = e.clientY - rect.top
              const base = e.shiftKey || e.metaKey || e.ctrlKey ? [...useEditor.getState().selectedClipIds] : []
              let moved = false
              const onMove = (ev: PointerEvent): void => {
                const x1 = ev.clientX - rect.left
                const y1 = ev.clientY - rect.top
                if (!moved && Math.hypot(x1 - x0, y1 - y0) < 4) return
                moved = true
                const mx = Math.min(x0, x1)
                const my = Math.min(y0, y1)
                const mw = Math.abs(x1 - x0)
                const mh = Math.abs(y1 - y0)
                setMarquee({ x: mx, y: my, w: mw, h: mh })
                const hit = clipsInRect(
                  useEditor.getState().project.timeline.tracks,
                  pxPerSec,
                  trackScale,
                  mx,
                  my,
                  mx + mw,
                  my + mh
                )
                setSelectedClips([...new Set([...base, ...hit])])
              }
              const onUp = (ev: PointerEvent): void => {
                document.removeEventListener('pointermove', onMove)
                document.removeEventListener('pointerup', onUp)
                setMarquee(null)
                if (!moved) {
                  selectClip(null) // plain click on empty space → deselect + seek
                  seek(ev.clientX)
                }
              }
              document.addEventListener('pointermove', onMove)
              document.addEventListener('pointerup', onUp)
            }}
          >
            <Ruler
              contentSec={contentSec}
              pxPerSec={pxPerSec}
              onScrub={beginScrub}
              markers={markers}
              onMarkerSeek={setPlayhead}
              onMarkerRemove={removeMarker}
            />
            {tracks.map((track) => (
              <TrackLane
                key={track.id}
                track={track}
                pxPerSec={pxPerSec}
                scale={trackScale}
                view={view}
                selectedClipIds={selectedClipIds}
                onSelect={selectClip}
                onTransition={(clipId, x, y) => setTransPick({ clipId, x, y })}
              />
            ))}
            <div className="playhead" style={{ left: playhead * pxPerSec }}>
              <div
                className="playhead-grip"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  beginScrub(e.clientX)
                }}
              />
            </div>
            {marquee && (
              <div
                style={{
                  position: 'absolute',
                  left: marquee.x,
                  top: marquee.y,
                  width: marquee.w,
                  height: marquee.h,
                  border: '1px solid var(--accent, #1fe6c2)',
                  background: 'rgba(31,230,194,0.12)',
                  pointerEvents: 'none',
                  zIndex: 20
                }}
              />
            )}
          </div>
        </div>
      </div>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={buildMenu(menu.clipId)} onClose={() => setMenu(null)} />
      )}
      {transPick && (
        <ContextMenu
          x={transPick.x}
          y={transPick.y}
          items={transitionItems(transPick.clipId)}
          onClose={() => setTransPick(null)}
        />
      )}
    </div>
  )
}

function TrackHeader({
  track,
  index,
  count,
  scale
}: {
  track: Track
  index: number
  count: number
  scale: number
}): JSX.Element {
  const toggleMuted = useEditor((s) => s.toggleTrackMuted)
  const removeTrack = useEditor((s) => s.removeTrack)
  const moveTrack = useEditor((s) => s.moveTrack)
  return (
    <div className="track-header" style={{ height: trackHeight(track.type, scale) }}>
      <div className="track-reorder">
        <button
          className="iconbtn track-arrow"
          title="Sposta su (cambia livello)"
          disabled={index === 0}
          onClick={() => moveTrack(track.id, 'up')}
        >
          ▴
        </button>
        <button
          className="iconbtn track-arrow"
          title="Sposta giù (cambia livello)"
          disabled={index === count - 1}
          onClick={() => moveTrack(track.id, 'down')}
        >
          ▾
        </button>
      </div>
      <span className="track-name">{track.name}</span>
      <div className="track-actions">
        {track.type !== 'text' && (
          <button
            className="iconbtn track-iconbtn"
            title={track.muted ? 'Riattiva audio' : 'Disattiva audio'}
            onClick={() => toggleMuted(track.id)}
          >
            {track.muted ? '🔇' : '🔊'}
          </button>
        )}
        <button className="iconbtn track-iconbtn" title="Elimina traccia" onClick={() => removeTrack(track.id)}>
          ✕
        </button>
      </div>
    </div>
  )
}

/** "+" button under the track headers that adds a new track (timeline) below. */
function AddTrackButton(): JSX.Element {
  const addTrack = useEditor((s) => s.addTrack)
  const [open, setOpen] = useState(false)
  const pick = (type: 'video' | 'audio'): void => {
    addTrack(type)
    setOpen(false)
  }
  return (
    <div className="add-track">
      <button
        className="add-track-btn"
        title="Aggiungi una traccia sotto"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="add-track-plus">＋</span> Traccia
      </button>
      {open && (
        <>
          <div className="popover-backdrop" onPointerDown={() => setOpen(false)} />
          <div className="add-track-menu">
            <button onClick={() => pick('video')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="14" height="14" rx="2"/><path d="M16 9l6-3v12l-6-3"/></svg>
              Traccia video
            </button>
            <button onClick={() => pick('audio')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>
              Traccia audio
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function tickStep(pxPerSec: number): number {
  const target = 80 / pxPerSec
  const steps = [
    0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600, 7200, 18000, 36000, 86400
  ]
  return steps.find((s) => s >= target) ?? 86400
}

function Ruler({
  contentSec,
  pxPerSec,
  onScrub,
  markers,
  onMarkerSeek,
  onMarkerRemove
}: {
  contentSec: number
  pxPerSec: number
  onScrub: (clientX: number) => void
  markers: { id: string; t: number; color: string; label: string }[]
  onMarkerSeek: (t: number) => void
  onMarkerRemove: (id: string) => void
}): JSX.Element {
  const step = tickStep(pxPerSec)
  const ticks: number[] = []
  for (let t = 0; t <= contentSec; t += step) ticks.push(Math.round(t * 100) / 100)
  return (
    <div
      className="ruler"
      style={{ height: RULER_H }}
      onPointerDown={(e) => onScrub(e.clientX)}
    >
      {ticks.map((t) => (
        <div key={t} className="ruler-tick" style={{ left: t * pxPerSec }}>
          {formatTick(t, step)}
        </div>
      ))}
      {markers.map((m) => (
        <div
          key={m.id}
          className="ruler-marker"
          style={{ left: m.t * pxPerSec, background: m.color }}
          title={`${m.label || 'Marker'} — clic per andare, tasto destro per eliminare`}
          onPointerDown={(e) => {
            e.stopPropagation()
            onMarkerSeek(m.t)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            onMarkerRemove(m.id)
          }}
        />
      ))}
    </div>
  )
}

function TrackLane({
  track,
  pxPerSec,
  scale,
  view,
  selectedClipIds,
  onSelect,
  onTransition
}: {
  track: Track
  pxPerSec: number
  scale: number
  view: { left: number; width: number }
  selectedClipIds: string[]
  onSelect: (id: string) => void
  onTransition: (clipId: string, x: number, y: number) => void
}): JSX.Element {
  return (
    <div
      className={`track ${track.type === 'audio' ? 'track--audio' : track.type === 'text' ? 'track--text' : ''}`}
      style={{ height: trackHeight(track.type, scale) }}
      data-track-id={track.id}
      data-track-type={track.type}
      onMouseEnter={() => useEditor.getState().setHoverTrack(track.id)}
    >
      {track.clips.map((clip) => (
        <ClipBlock
          key={clip.id}
          clip={clip}
          track={track}
          pxPerSec={pxPerSec}
          scale={scale}
          view={view}
          selected={selectedClipIds.includes(clip.id)}
          onSelect={onSelect}
        />
      ))}
      {track.type === 'video' &&
        track.clips.map((c) => {
          if (c.kind !== 'media') return null
          const next = track.clips
            .filter((o) => o.id !== c.id && o.timelineStart > c.timelineStart + 0.01)
            .sort((a, b) => a.timelineStart - b.timelineStart)[0]
          if (!next || Math.abs(next.timelineStart - c.timelineEnd) > 0.12) return null
          const seam = c.timelineEnd * pxPerSec
          if (c.transitionOut) {
            const d = c.transitionOut.durationSec
            return (
              <div
                key={`tr-${c.id}`}
                className="trans-region"
                style={{ left: seam - (d / 2) * pxPerSec, width: d * pxPerSec }}
                title="Transizione — clic per cambiarla o rimuoverla"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  onTransition(c.id, e.clientX, e.clientY)
                }}
              >
                <span className="trans-icon">⤬</span>
              </div>
            )
          }
          return (
            <button
              key={`ta-${c.id}`}
              className="trans-add"
              style={{ left: seam }}
              title="Aggiungi transizione"
              onPointerDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onTransition(c.id, e.clientX, e.clientY)
              }}
            >
              ＋
            </button>
          )
        })}
    </div>
  )
}

function ClipBlock({
  clip,
  track,
  pxPerSec,
  scale,
  view,
  selected,
  onSelect
}: {
  clip: Clip
  track: Track
  pxPerSec: number
  scale: number
  view: { left: number; width: number }
  selected: boolean
  onSelect: (id: string) => void
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const source = useEditor((s) =>
    clip.kind === 'media' ? s.project.sources.find((x) => x.id === clip.sourceId) ?? null : null
  )
  const left = clip.timelineStart * pxPerSec
  const width = Math.max(6, (clip.timelineEnd - clip.timelineStart) * pxPerSec)
  const label = clip.kind === 'media' ? source?.fileName ?? 'clip' : clip.text
  const srcDur = source && source.durationSec > 0 ? source.durationSec : 1
  const startFrac = clip.kind === 'media' ? clip.sourceIn / srcDur : 0
  const endFrac = clip.kind === 'media' ? clip.sourceOut / srcDur : 1
  const showWave = !!(source && source.hasAudio && source.peaks && source.peaks.length)

  // Clip body: a frame filmstrip on top, audio waveform pinned to a
  // band at the bottom. Audio-only clips show just the waveform filling the clip.
  const isAudioOnly = track.type === 'audio'
  const clipH = trackHeight(track.type, scale) - 8
  const waveH = showWave ? (isAudioOnly ? clipH : 30) : 0
  const thumbH = isAudioOnly ? 0 : clipH - waveH
  const isImage = source?.kind === 'image'
  const stripUrl =
    !isAudioOnly && clip.kind === 'media' && source?.timelineThumbsPath
      ? mediaUrl(source.timelineThumbsPath)
      : null
  const aspect = source && source.height > 0 ? source.width / source.height : 16 / 9

  const beginMove = (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    const store = useEditor.getState()
    if (store.bladeMode) {
      // Razor/blade tool: clicking a clip splits it EXACTLY under the cursor.
      const rect = ref.current?.getBoundingClientRect()
      if (rect) store.splitAtTime(clip.timelineStart + (e.clientX - rect.left) / pxPerSec)
      return
    }
    // Shift / ⌘ / Ctrl + click → toggle this clip in the multi-selection (no drag).
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      store.toggleClipInSelection(clip.id)
      return
    }
    const sel = store.selectedClipIds
    const multi = sel.length > 1 && sel.includes(clip.id)
    if (!multi) onSelect(clip.id) // clicking a clip outside the selection → select just it
    const el = ref.current
    if (!el) return
    const points = snapPoints(store.project, store.playhead, clip.id)
    const startX = e.clientX
    const startY = e.clientY
    const origStart = clip.timelineStart
    const dur = clip.timelineEnd - clip.timelineStart
    let finalStart = origStart
    let finalTrackId = clip.trackId
    let moved = false
    let dropEl: HTMLElement | null = null // highlighted destination track
    // Drag the whole selection together when multi-selected, else just this clip.
    const moveEls = multi
      ? (sel.map((id) => document.querySelector(`[data-clip-id="${id}"]`)).filter(Boolean) as HTMLElement[])
      : [el]
    for (const m of moveEls) {
      m.style.pointerEvents = 'none'
      m.style.zIndex = '30'
      m.classList.add('dragging')
    }

    const onMove = (ev: PointerEvent): void => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true
      let ns = Math.max(0, origStart + dx / pxPerSec)
      ns = snap(ns, points, pxPerSec)
      ns = snap(ns + dur, points, pxPerSec) - dur // also snap the end edge
      finalStart = Math.max(0, ns)
      const tx = (finalStart - origStart) * pxPerSec
      // Single clip follows the cursor in BOTH axes (so you can drag it onto another
      // track and SEE it move there); a multi-selection only slides horizontally.
      for (const m of moveEls) m.style.transform = multi ? `translateX(${tx}px)` : `translateX(${tx}px) translateY(${dy}px)`

      if (!multi) {
        const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-track-id]') as HTMLElement | null
        const tid = under?.getAttribute('data-track-id')
        const ttype = under?.getAttribute('data-track-type')
        if (under && tid && ttype === track.type) finalTrackId = tid
        // Highlight the destination track lane under the cursor.
        const hi = under && ttype === track.type ? under : null
        if (hi !== dropEl) {
          dropEl?.classList.remove('track--drop')
          hi?.classList.add('track--drop')
          dropEl = hi
        }
      }
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      dropEl?.classList.remove('track--drop')
      for (const m of moveEls) {
        m.style.pointerEvents = ''
        m.style.transform = ''
        m.style.zIndex = ''
        m.classList.remove('dragging')
      }
      if (moved) {
        const st = useEditor.getState()
        if (multi) st.moveSelectedBy(finalStart - origStart)
        else st.moveClip(clip.id, finalStart, finalTrackId !== clip.trackId ? finalTrackId : undefined)
      }
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const beginTrim = (edge: 'start' | 'end') => (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    onSelect(clip.id)
    const el = ref.current
    if (!el) return
    const startX = e.clientX
    const origLeft = left
    const origWidth = width
    let deltaSec = 0

    const onMove = (ev: PointerEvent): void => {
      const dx = ev.clientX - startX
      deltaSec = dx / pxPerSec
      if (edge === 'start') {
        const d = Math.min(dx, origWidth - 12)
        el.style.left = `${origLeft + d}px`
        el.style.width = `${origWidth - d}px`
      } else {
        el.style.width = `${Math.max(12, origWidth + dx)}px`
      }
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      el.style.left = ''
      el.style.width = ''
      if (Math.abs(deltaSec) > 0.01) useEditor.getState().trimClip(clip.id, edge, deltaSec)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  // CapCut-style AUDIO fade handles: drag the top-corner dot inward to fade in/out.
  // Live-updates the dot + ramp via DOM during the drag, commits once on release.
  const beginFade = (edge: 'in' | 'out') => (e: React.PointerEvent): void => {
    if (e.button !== 0 || clip.kind !== 'media') return
    e.stopPropagation()
    e.preventDefault()
    const el = ref.current
    if (!el) return
    const cur = edge === 'in' ? clip.fadeInSec : clip.fadeOutSec
    const sign = edge === 'in' ? 1 : -1 // dragging inward (right for in, left for out) grows it
    const maxSec = (width / pxPerSec) * 0.9
    const startX = e.clientX
    let sec = cur
    const handle = el.querySelector(`.fade-${edge}`) as HTMLElement | null
    const ramp = el.querySelector(`.fade-ramp-${edge}`) as HTMLElement | null
    const onMove = (ev: PointerEvent): void => {
      sec = Math.max(0, Math.min(maxSec, cur + ((ev.clientX - startX) * sign) / pxPerSec))
      const px = `${sec * pxPerSec}px`
      if (handle) handle.style[edge === 'in' ? 'left' : 'right'] = px
      if (ramp) ramp.style.width = px
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      useEditor.getState().setFade(clip.id, edge, sec)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  // CapCut volume line: drag the line over the waveform up/down to change the clip's
  // volume, live (waveform + audio update as you drag). beginHistory → one undo per drag.
  const beginVolume = (e: React.PointerEvent): void => {
    if (e.button !== 0 || clip.kind !== 'media') return
    e.stopPropagation()
    e.preventDefault()
    onSelect(clip.id)
    useEditor.getState().beginHistory()
    const startY = e.clientY
    const startVol = clip.mutedAudio ? 0 : clip.volume
    const onMove = (ev: PointerEvent): void => {
      const vol = Math.max(0, Math.min(2, startVol - (ev.clientY - startY) / 100)) // 100px = 1.0×
      useEditor.getState().liveSetClipVolume(clip.id, vol)
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={ref}
      data-clip-id={clip.id}
      className={`clip ${track.type === 'audio' ? 'clip--audio' : track.type === 'text' ? 'clip--text' : ''} ${selected ? 'selected' : ''}`}
      style={{ left, width }}
      onPointerDown={beginMove}
    >
      {clip.kind === 'media' && (thumbH > 0 || waveH > 0) && (
        <ClipMedia
          stripUrl={stripUrl}
          thumbCols={clip.kind === 'media' && source ? source.timelineThumbCols : null}
          isImage={isImage}
          aspect={aspect}
          peaks={waveH > 0 && source?.peaks ? source.peaks : null}
          volume={clip.kind === 'media' ? clip.volume : 1}
          muted={clip.kind === 'media' ? !!clip.mutedAudio : false}
          left={left}
          width={width}
          view={view}
          thumbH={thumbH}
          waveH={waveH}
          startFrac={startFrac}
          endFrac={endFrac}
        />
      )}
      <div className="clip-handle clip-handle--l" onPointerDown={beginTrim('start')} />
      <span className="clip-label">{label}</span>
      <div className="clip-handle clip-handle--r" onPointerDown={beginTrim('end')} />
      {clip.kind === 'media' && source?.hasAudio && !clip.mutedAudio && (
        <>
          <div className="fade-ramp fade-ramp-in" style={{ width: clip.fadeInSec * pxPerSec }} />
          <div className="fade-ramp fade-ramp-out" style={{ width: clip.fadeOutSec * pxPerSec }} />
          <div
            className="fade-handle fade-in"
            style={{ left: clip.fadeInSec * pxPerSec }}
            onPointerDown={beginFade('in')}
            title="Dissolvenza audio in entrata — trascina verso destra"
          />
          <div
            className="fade-handle fade-out"
            style={{ right: clip.fadeOutSec * pxPerSec }}
            onPointerDown={beginFade('out')}
            title="Dissolvenza audio in uscita — trascina verso sinistra"
          />
        </>
      )}
      {clip.kind === 'media' && waveH > 0 && source?.hasAudio && (
        <div
          className="vol-line"
          style={{ bottom: `${(Math.min(2, clip.mutedAudio ? 0 : clip.volume) / 2) * waveH}px` }}
          onPointerDown={beginVolume}
          title={`Volume ${Math.round((clip.mutedAudio ? 0 : clip.volume) * 100)}% — trascina su/giù`}
        >
          <span className="vol-label">{Math.round((clip.mutedAudio ? 0 : clip.volume) * 100)}%</span>
        </div>
      )}
    </div>
  )
}

/** Shared decoded filmstrip sprites, keyed by media:// url. */
const spriteCache = new Map<string, HTMLImageElement>()
// Consecutive load failures per sprite URL, so a broken/not-yet-generated strip is
// retried a bounded number of times instead of being cached as broken forever.
const spriteFails = new Map<string, number>()

/**
 * Virtualized clip thumbnails + waveform: renders ONLY the currently visible
 * horizontal slice of the clip into a canvas sized to that slice (never the whole
 * clip), sampling frames from the sprite and peaks from the source. This keeps
 * both crisp at ANY zoom (no fixed image stretched across a 40k-px clip) and
 * naturally shows more frames as you zoom in.
 */
const STRIP_FRAME_H = 144 // must match thumbnails.ts STRIP_HEIGHT (grid row height)

function ClipMedia({
  stripUrl,
  thumbCols,
  isImage,
  aspect,
  peaks,
  left,
  width,
  view,
  thumbH,
  waveH,
  volume,
  muted,
  startFrac,
  endFrac
}: {
  stripUrl: string | null
  thumbCols: number | null
  isImage: boolean
  aspect: number
  peaks: number[] | null
  volume: number
  muted: boolean
  left: number
  width: number
  view: { left: number; width: number }
  thumbH: number
  waveH: number
  startFrac: number
  endFrac: number
}): JSX.Element | null {
  const ref = useRef<HTMLCanvasElement>(null)
  const [tick, setTick] = useState(0)

  const vis0 = Math.max(left, view.left)
  const vis1 = Math.min(left + width, view.left + view.width)
  const visW = Math.max(0, vis1 - vis0)
  const clipH = thumbH + waveH

  useEffect(() => {
    const c = ref.current
    if (!c || visW <= 0 || clipH <= 0) return
    const dpr = window.devicePixelRatio || 1
    const cssW = Math.max(1, Math.ceil(visW))
    const bw = Math.min(Math.ceil(cssW * dpr), 8192)
    const bh = Math.max(1, Math.ceil(clipH * dpr))
    c.width = bw
    c.height = bh
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, bw, bh)
    ctx.scale(bw / cssW, bh / clipH) // work in CSS px, render at backing resolution
    ctx.imageSmoothingQuality = 'high'
    const span = Math.max(1e-4, endFrac - startFrac)
    const fracAt = (xCss: number): number => {
      const f = (vis0 + xCss - left) / width
      return startFrac + Math.max(0, Math.min(1, f)) * span
    }

    if (thumbH > 0 && stripUrl) {
      let img = spriteCache.get(stripUrl)
      if (!img) {
        img = new Image()
        img.src = stripUrl
        spriteCache.set(stripUrl, img)
      }
      if (img.complete && img.naturalWidth > 0) {
        // Frames are tiled in a grid (gridCols per row). For images it's a single
        // tile; for legacy single-row strips (no thumbCols) we infer cols from width.
        const nW = img.naturalWidth
        const nH = img.naturalHeight
        let gridCols: number
        let gridRows: number
        if (isImage) {
          gridCols = 1
          gridRows = 1
        } else if (thumbCols && thumbCols > 0) {
          gridCols = thumbCols
          gridRows = Math.max(1, Math.round(nH / STRIP_FRAME_H))
        } else {
          const fw = Math.max(1, Math.round(nH * aspect))
          gridCols = Math.max(1, Math.round(nW / fw))
          gridRows = 1
        }
        const frameW = nW / gridCols
        const frameH = nH / gridRows
        const total = gridCols * gridRows
        const thumbW = Math.max(10, thumbH * aspect)
        for (let x = 0; x < cssW; x += thumbW) {
          const idx = Math.min(total - 1, Math.max(0, Math.round(fracAt(x) * (total - 1))))
          const sx = (idx % gridCols) * frameW
          const sy = Math.floor(idx / gridCols) * frameH
          try {
            ctx.drawImage(img, sx, sy, frameW, frameH, x, 0, thumbW, thumbH)
          } catch {
            /* frame out of range */
          }
        }
      } else {
        ctx.fillStyle = '#1a1e22'
        ctx.fillRect(0, 0, cssW, thumbH)
        const url = stripUrl
        img.addEventListener(
          'load',
          () => {
            spriteFails.delete(url)
            setTick((t) => t + 1)
          },
          { once: true }
        )
        // If the sprite fails to load (e.g. its temp file is still being generated,
        // or /tmp was cleared), DON'T keep the broken Image cached forever — evict it
        // and retry a few times so frames appear once the file lands, without a manual
        // reload. Capped so a permanently-missing file can't spin a tight retry loop.
        img.addEventListener(
          'error',
          () => {
            spriteCache.delete(url)
            const n = (spriteFails.get(url) ?? 0) + 1
            spriteFails.set(url, n)
            if (n <= 10) setTimeout(() => setTick((t) => t + 1), 600)
          },
          { once: true }
        )
      }
    }

    if (waveH > 0 && peaks && peaks.length) {
      const top = thumbH
      const audioOnly = thumbH <= 0
      // CapCut-style audio: a DARK teal lane so the bright waveform reads clearly,
      // drawn at REAL amplitude (loud = tall, quiet = short) so you can read the
      // dynamics, sampling the MAX peak per pixel (true envelope, not 1 random sample).
      const g = ctx.createLinearGradient(0, top, 0, top + waveH)
      if (audioOnly) {
        g.addColorStop(0, 'rgba(7,46,42,0.55)')
        g.addColorStop(1, 'rgba(5,33,30,0.55)')
      } else {
        g.addColorStop(0, '#0e5751')
        g.addColorStop(1, '#0a3f3a')
      }
      ctx.fillStyle = g
      ctx.fillRect(0, top, cssW, waveH)
      const n = peaks.length
      const base = top + waveH // band bottom — the TRACK grows UP from here, BELOW the line
      const volF = muted ? 0 : Math.max(0, volume)
      // The volume LINE (DOM, bottom:(volume/2)*waveH) is the CEILING; the TRACK fills below
      // it — a full-scale peak just reaching the line. Lower volume → thinner track; raise →
      // taller (headroom to grow); and the hue escalates teal→YELLOW→RED as the gain runs
      // too hot ("supera troppi decibel"). Andrea's CapCut volume meter.
      const ceil = Math.min(waveH, (volF / 2) * waveH) // full-scale fill height = line pos
      // First pass: per-pixel max across the VISIBLE waveform, then a high-percentile
      // reference (robust to a lone transient) so the LOUD peaks reach the line ("i picchi
      // massimi devono toccare la linea") — not just one spike, and quiet stretches stay
      // proportionally lower. The draw pass reuses cols[x] (no recompute).
      const cols = new Array<number>(cssW)
      for (let x = 0; x < cssW; x++) {
        let a = Math.floor(fracAt(x) * (n - 1))
        let b = Math.floor(fracAt(x + 1) * (n - 1))
        if (a > b) [a, b] = [b, a]
        a = Math.max(0, Math.min(n - 1, a))
        b = Math.max(0, Math.min(n - 1, b))
        let mxx = 0
        for (let k = a; k <= b; k++) {
          const v = peaks[k] ?? 0
          if (v > mxx) mxx = v
        }
        cols[x] = mxx
      }
      const sorted = cols.slice().sort((p, q) => p - q)
      const ref = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.85))] : 0
      const pInv = ref > 1e-3 ? 1 / ref : 0
      const mix = (p: number[], q: number[], t: number): number[] => [
        Math.round(p[0] + (q[0] - p[0]) * t),
        Math.round(p[1] + (q[1] - p[1]) * t),
        Math.round(p[2] + (q[2] - p[2]) * t)
      ]
      const SAFE = [110, 240, 220]
      const YEL = [255, 209, 56]
      const RED = [255, 64, 56]
      const hot =
        volF <= 1.05
          ? SAFE
          : volF <= 1.45
            ? mix(SAFE, YEL, (volF - 1.05) / 0.4)
            : mix(YEL, RED, Math.min(1, (volF - 1.45) / 0.55))
      // Solid at the base, fading up → a filled meter that sits under the cyan line.
      const wg = ctx.createLinearGradient(0, base, 0, top)
      wg.addColorStop(0, `rgba(${hot[0]},${hot[1]},${hot[2]},${muted ? 0.4 : 0.98})`)
      wg.addColorStop(1, `rgba(${hot[0]},${hot[1]},${hot[2]},${muted ? 0.22 : 0.6})`)
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(0, Math.round(base) - 1, cssW, 1) // bottom baseline
      ctx.fillStyle = wg
      for (let x = 0; x < cssW; x++) {
        const amp = Math.pow(Math.min(1, cols[x] * pInv), 0.5) // loud peaks → reach the line
        const h = Math.max(volF <= 0.02 ? 0.4 : 1, amp * ceil)
        ctx.fillRect(x, base - h, 1, h)
      }
    }
  }, [stripUrl, thumbCols, isImage, aspect, peaks, volume, muted, left, width, vis0, visW, thumbH, waveH, startFrac, endFrac, clipH, tick])

  if (visW <= 0) return null
  return (
    <canvas
      ref={ref}
      className="clip-media"
      style={{ left: vis0 - left, width: visW, height: clipH }}
    />
  )
}
