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
 * Direct manipulation of a TEXT clip on the preview, Canva-style: drag the body to
 * move it, drag a corner to resize (font size). Appears automatically whenever a
 * text clip is selected and visible at the playhead — no edit-mode toggle needed.
 * One undo step per gesture (beginHistory + liveUpdateTextClip).
 */
export function TextOverlay({ frameW, frameH }: { frameW: number; frameH: number }): JSX.Element | null {
  const layerRef = useRef<HTMLDivElement>(null)
  const playhead = useEditor((s) => s.playhead)
  const clip = useEditor((s) => {
    if (!s.selectedClipId) return null
    for (const t of s.project.timeline.tracks) {
      for (const c of t.clips) if (c.id === s.selectedClipId && c.kind === 'text') return c as TextClip
    }
    return null
  })
  const beginHistory = useEditor((s) => s.beginHistory)
  const liveUpdateTextClip = useEditor((s) => s.liveUpdateTextClip)

  if (!clip || frameW < 2 || frameH < 2) return null
  if (playhead < clip.timelineStart || playhead >= clip.timelineEnd) return null

  const st = clip.style
  const fontPx = st.fontSizeFrac * frameH
  const { w: tw, h: th } = measureBox(clip, fontPx, (st.letterSpacingFrac || 0) * frameH)
  const pad = Math.max(6, fontPx * 0.2)
  const cx = st.posX * frameW
  const cy = st.posY * frameH
  const left = (st.align === 'left' ? cx : st.align === 'right' ? cx - tw : cx - tw / 2) - pad
  const top = cy - th / 2 - pad

  const startMove = (e: React.PointerEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    beginHistory()
    const sx = e.clientX
    const sy = e.clientY
    const ox = st.posX
    const oy = st.posY
    const onMove = (ev: PointerEvent): void => {
      const nx = ox + (ev.clientX - sx) / frameW
      const ny = oy + (ev.clientY - sy) / frameH
      liveUpdateTextClip(clip.id, (c) => {
        c.style.posX = clamp(nx, -0.2, 1.2)
        c.style.posY = clamp(ny, -0.2, 1.2)
      })
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const startResize = (e: React.PointerEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const rect = layerRef.current?.getBoundingClientRect()
    if (!rect) return
    beginHistory()
    // Uniform font scale around the text anchor (its centre): ratio of the cursor's
    // distance from the centre now vs. at gesture start.
    const centerX = rect.left + cx
    const centerY = rect.top + cy
    const base = st.fontSizeFrac
    const startDist = Math.max(8, Math.hypot(e.clientX - centerX, e.clientY - centerY))
    const onMove = (ev: PointerEvent): void => {
      const dist = Math.hypot(ev.clientX - centerX, ev.clientY - centerY)
      const frac = clamp(base * (dist / startDist), MIN_FONT, MAX_FONT)
      liveUpdateTextClip(clip.id, (c) => {
        c.style.fontSizeFrac = frac
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
      <div
        className="xform-box"
        style={{ left, top, width: tw + pad * 2, height: th + pad * 2 }}
        onPointerDown={startMove}
      >
        {HANDLES.map((h) => (
          <div key={h} className={`xform-handle xform-${h}`} onPointerDown={startResize} />
        ))}
      </div>
    </div>
  )
}
