import { useRef } from 'react'
import { useEditor } from '../state/store'
import { type MediaClip } from '@shared/projectSchema'
import { mediaUrl } from '@shared/media'

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN = 0.05
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/**
 * Visual crop tool: the source poster with a draggable crop rectangle + handles.
 * Edits clip.crop (source-normalized 0..1) — the same field the numeric fields and
 * the export use, so it's WYSIWYG. Shown in the Inspector under "Ritaglio".
 */
export function CropBox({ clip }: { clip: MediaClip }): JSX.Element | null {
  const wrapRef = useRef<HTMLDivElement>(null)
  const src = useEditor((s) => s.project.sources.find((x) => x.id === clip.sourceId) ?? null)
  const beginHistory = useEditor((s) => s.beginHistory)
  const live = useEditor((s) => s.liveUpdateClip)
  if (!src) return null
  const aspect = src.width > 0 && src.height > 0 ? src.width / src.height : 16 / 9
  const poster = src.thumbnailPath ? mediaUrl(src.thumbnailPath) : null
  const c = clip.crop

  const startMove = (e: React.PointerEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    beginHistory()
    const sx = e.clientX
    const sy = e.clientY
    const ox = c.x
    const oy = c.y
    const onMove = (ev: PointerEvent): void => {
      const nx = clamp(ox + (ev.clientX - sx) / rect.width, 0, 1 - c.w)
      const ny = clamp(oy + (ev.clientY - sy) / rect.height, 0, 1 - c.h)
      live(clip.id, (cl) => {
        cl.crop.x = nx
        cl.crop.y = ny
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
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    beginHistory()
    let left = c.x
    let top = c.y
    let right = c.x + c.w
    let bottom = c.y + c.h
    const onMove = (ev: PointerEvent): void => {
      const mx = clamp((ev.clientX - rect.left) / rect.width, 0, 1)
      const my = clamp((ev.clientY - rect.top) / rect.height, 0, 1)
      if (h.includes('w')) left = Math.min(mx, right - MIN)
      if (h.includes('e')) right = Math.max(mx, left + MIN)
      if (h.includes('n')) top = Math.min(my, bottom - MIN)
      if (h.includes('s')) bottom = Math.max(my, top + MIN)
      live(clip.id, (cl) => {
        cl.crop.x = left
        cl.crop.y = top
        cl.crop.w = right - left
        cl.crop.h = bottom - top
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
    <div className="crop-box" style={{ aspectRatio: String(aspect) }} ref={wrapRef}>
      {poster && <img src={poster} className="crop-box-img" draggable={false} alt="" />}
      <div
        className="crop-rect"
        style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` }}
        onPointerDown={startMove}
      >
        {HANDLES.map((h) => (
          <div key={h} className={`xform-handle xform-${h}`} onPointerDown={(e) => startResize(e, h)} />
        ))}
      </div>
    </div>
  )
}
