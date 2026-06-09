import { useRef } from 'react'
import { useEditor } from '../state/store'
import { type MediaClip } from '@shared/projectSchema'

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN = 0.03

/**
 * Direct manipulation of the blur-region mask on the preview: drag the body to
 * move it, drag the handles to resize it freely (any width/height). Shown only
 * while "Modifica sull'anteprima" is on and the clip has a rectangle/ellipse mask.
 */
export function MaskOverlay({ frameW, frameH }: { frameW: number; frameH: number }): JSX.Element | null {
  const layerRef = useRef<HTMLDivElement>(null)
  const maskEdit = useEditor((s) => s.maskEdit)
  const clip = useEditor((s) => {
    if (!s.selectedClipId) return null
    for (const t of s.project.timeline.tracks) {
      for (const c of t.clips) if (c.id === s.selectedClipId && c.kind === 'media') return c as MediaClip
    }
    return null
  })
  const beginHistory = useEditor((s) => s.beginHistory)
  const liveUpdateClip = useEditor((s) => s.liveUpdateClip)

  if (!maskEdit || !clip || clip.mask.shape === 'none' || frameW < 2 || frameH < 2) return null
  const m = clip.mask

  const startMove = (e: React.PointerEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    beginHistory()
    const sx = e.clientX
    const sy = e.clientY
    const ox = m.x
    const oy = m.y
    const onMove = (ev: PointerEvent): void => {
      const nx = ox + (ev.clientX - sx) / frameW
      const ny = oy + (ev.clientY - sy) / frameH
      liveUpdateClip(clip.id, (cl) => {
        cl.mask.x = Math.max(-0.5, Math.min(1.5, nx))
        cl.mask.y = Math.max(-0.5, Math.min(1.5, ny))
      })
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const startResize = (e: React.PointerEvent, h: Handle): void => {
    e.preventDefault()
    e.stopPropagation()
    beginHistory()
    const rect = layerRef.current?.getBoundingClientRect()
    if (!rect) return
    let left = m.x * frameW
    let top = m.y * frameH
    let right = left + m.w * frameW
    let bottom = top + m.h * frameH
    const onMove = (ev: PointerEvent): void => {
      const mx = ev.clientX - rect.left
      const my = ev.clientY - rect.top
      if (h.includes('w')) left = Math.min(right - frameW * MIN, mx)
      if (h.includes('e')) right = Math.max(left + frameW * MIN, mx)
      if (h.includes('n')) top = Math.min(bottom - frameH * MIN, my)
      if (h.includes('s')) bottom = Math.max(top + frameH * MIN, my)
      liveUpdateClip(clip.id, (cl) => {
        cl.mask.x = left / frameW
        cl.mask.y = top / frameH
        cl.mask.w = Math.max(MIN, (right - left) / frameW)
        cl.mask.h = Math.max(MIN, (bottom - top) / frameH)
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
    <div ref={layerRef} className="mask-layer">
      <div
        className={`mask-box ${m.shape === 'ellipse' ? 'mask-box--ellipse' : ''}`}
        style={{ left: m.x * frameW, top: m.y * frameH, width: m.w * frameW, height: m.h * frameH }}
        onPointerDown={startMove}
      >
        {HANDLES.map((h) => (
          <div key={h} className={`xform-handle mask-handle xform-${h}`} onPointerDown={(e) => startResize(e, h)} />
        ))}
      </div>
    </div>
  )
}
