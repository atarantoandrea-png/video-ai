import { useRef } from 'react'
import { useEditor } from '../state/store'
import { type TextClip } from '@shared/projectSchema'
import { clamp } from '@shared/geometry'

type Handle = 'nw' | 'ne' | 'se' | 'sw'
const HANDLES: Handle[] = ['nw', 'ne', 'se', 'sw']
const MIN_FONT = 0.015
const MAX_FONT = 0.6

let measureCanvas: HTMLCanvasElement | null = null
/** Measure the rendered text box (px) with the clip's font, matching the compositor. */
function measureBox(clip: TextClip, fontPx: number, letterSpPx: number): { w: number; h: number } {
  const st = clip.style
  const lineH = fontPx * (st.lineHeightMul || 1.2)
  const lines = (clip.text ?? '').split('\n')
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return { w: fontPx * 4, h: lineH * lines.length }
  const weight = st.bold ? '700' : '400'
  const italic = st.italic ? 'italic ' : ''
  ctx.font = `${italic}${weight} ${fontPx}px ${st.fontFamily}`
  ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${letterSpPx}px`
  let w = 0
  for (const ln of lines) w = Math.max(w, ctx.measureText(ln || ' ').width)
  return { w: Math.max(w, fontPx), h: lineH * lines.length }
}

/**
 * Direct manipulation of TEXT clips / stickers on the preview, Canva-style: CLICK any
 * visible text/sticker to select it, drag the body to move, drag a corner to resize the
 * font. Once selected, ⌫ deletes it. One undo step per gesture (beginHistory + live).
 */
export function TextOverlay({ frameW, frameH }: { frameW: number; frameH: number }): JSX.Element | null {
  const layerRef = useRef<HTMLDivElement>(null)
  const playhead = useEditor((s) => s.playhead)
  const selectedId = useEditor((s) => s.selectedClipId)
  const tracks = useEditor((s) => s.project.timeline.tracks)
  const selectClip = useEditor((s) => s.selectClip)
  const beginHistory = useEditor((s) => s.beginHistory)
  const liveUpdateTextClip = useEditor((s) => s.liveUpdateTextClip)

  if (frameW < 2 || frameH < 2) return null
  // Every text/sticker clip visible at the playhead gets a clickable box.
  const clips: TextClip[] = []
  for (const t of tracks) {
    if (t.type !== 'text' || t.hidden) continue
    for (const c of t.clips) {
      if (c.kind === 'text' && playhead >= c.timelineStart && playhead < c.timelineEnd) clips.push(c as TextClip)
    }
  }
  if (!clips.length) return null

  const startMove = (e: React.PointerEvent, clip: TextClip): void => {
    e.preventDefault()
    e.stopPropagation()
    beginHistory()
    const sx = e.clientX
    const sy = e.clientY
    const ox = clip.style.posX
    const oy = clip.style.posY
    const onMove = (ev: PointerEvent): void => {
      liveUpdateTextClip(clip.id, (c) => {
        c.style.posX = clamp(ox + (ev.clientX - sx) / frameW, -0.2, 1.2)
        c.style.posY = clamp(oy + (ev.clientY - sy) / frameH, -0.2, 1.2)
      })
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const startResize = (e: React.PointerEvent, clip: TextClip, cx: number, cy: number): void => {
    e.preventDefault()
    e.stopPropagation()
    const rect = layerRef.current?.getBoundingClientRect()
    if (!rect) return
    beginHistory()
    const centerX = rect.left + cx
    const centerY = rect.top + cy
    const base = clip.style.fontSizeFrac
    const startDist = Math.max(8, Math.hypot(e.clientX - centerX, e.clientY - centerY))
    const onMove = (ev: PointerEvent): void => {
      const dist = Math.hypot(ev.clientX - centerX, ev.clientY - centerY)
      liveUpdateTextClip(clip.id, (c) => {
        c.style.fontSizeFrac = clamp(base * (dist / startDist), MIN_FONT, MAX_FONT)
      })
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  return (
    <div ref={layerRef} className="xform-layer text-xform-layer">
      {clips.map((clip) => {
        const st = clip.style
        const fontPx = st.fontSizeFrac * frameH
        const { w: tw, h: th } = measureBox(clip, fontPx, (st.letterSpacingFrac || 0) * frameH)
        const pad = Math.max(6, fontPx * 0.2)
        const cx = st.posX * frameW
        const cy = st.posY * frameH
        const left = (st.align === 'left' ? cx : st.align === 'right' ? cx - tw : cx - tw / 2) - pad
        const top = cy - th / 2 - pad
        const isSel = clip.id === selectedId
        return (
          <div
            key={clip.id}
            className={`xform-box ${isSel ? '' : 'text-hit'}`}
            style={{ left, top, width: tw + pad * 2, height: th + pad * 2 }}
            title={isSel ? undefined : 'Clic per selezionare · ⌫ per eliminare'}
            onPointerDown={(e) => {
              if (isSel) startMove(e, clip)
              else {
                e.stopPropagation()
                e.preventDefault()
                selectClip(clip.id)
              }
            }}
          >
            {isSel && HANDLES.map((h) => (
              <div key={h} className={`xform-handle xform-${h}`} onPointerDown={(e) => startResize(e, clip, cx, cy)} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
