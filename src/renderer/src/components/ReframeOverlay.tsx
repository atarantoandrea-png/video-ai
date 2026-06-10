import { useEffect, useRef } from 'react'
import { type CropRect, type MediaClip } from '@shared/projectSchema'
import { useEditor } from '../state/store'
import { mediaUrl } from '@shared/media'
import { clamp } from '@shared/geometry'

type Corner = 'nw' | 'ne' | 'se' | 'sw'
const CORNERS: Corner[] = ['nw', 'ne', 'se', 'sw']
const MIN_SHAPE = 0.06

/**
 * CapCut-style REFRAME (visual crop + shape). Enter with a double-click on the move/resize
 * box. The output frame stays FIXED; the WHOLE source image is shown behind it (cropped
 * parts dimmed); you drag the image to choose what's inside (change subject) and scroll to
 * zoom. A shape selector (Pieno / Rettangolo / Cerchio) turns the frame into a RESIZABLE
 * rectangle or circle mask — the clip is cut to that shape (rest transparent), exactly like
 * CapCut. Edits clip.crop (kept at output aspect) + clip.mask. WYSIWYG with the export.
 */
export function ReframeOverlay({ frameW, frameH }: { frameW: number; frameH: number }): JSX.Element | null {
  const layerRef = useRef<HTMLDivElement>(null)
  const wheelSession = useRef<number | null>(null)
  const reframeEdit = useEditor((s) => s.reframeEdit)
  const setReframeEdit = useEditor((s) => s.setReframeEdit)
  const beginHistory = useEditor((s) => s.beginHistory)
  const liveSetClipCrop = useEditor((s) => s.liveSetClipCrop)
  const liveSetClipMask = useEditor((s) => s.liveSetClipMask)
  const setMask = useEditor((s) => s.setMask)
  const canvasW = useEditor((s) => s.project.canvas.width)
  const canvasH = useEditor((s) => s.project.canvas.height)
  const clip = useEditor((s) => {
    if (!s.selectedClipId) return null
    for (const t of s.project.timeline.tracks)
      for (const c of t.clips) if (c.id === s.selectedClipId && c.kind === 'media') return c as MediaClip
    return null
  })
  const source = useEditor((s) => {
    const id = clip?.sourceId
    return id ? (s.project.sources.find((x) => x.id === id) ?? null) : null
  })

  useEffect(() => {
    if (!reframeEdit) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === 'Enter') setReframeEdit(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reframeEdit, setReframeEdit])

  if (!reframeEdit || !clip || !source || frameW < 4 || frameH < 4) return null
  const sw = source.width
  const sh = source.height
  if (sw <= 0 || sh <= 0) return null
  const imgUrl = source.thumbnailPath
    ? mediaUrl(source.thumbnailPath)
    : source.kind === 'image'
      ? mediaUrl(source.path)
      : null

  const crop = clip.crop
  const mask = clip.mask
  const hasShape = mask.shape !== 'none'
  const aspectFactor = (sw * canvasH) / (sh * canvasW) // crop.h = crop.w * aspectFactor

  // Fixed output frame: centred, 64% of the preview.
  const FW = frameW * 0.64
  const FH = frameH * 0.64
  const FL = (frameW - FW) / 2
  const FT = (frameH - FH) / 2

  // Image scaled & positioned so its crop sub-rect lands on the frame.
  const scale = FW / (crop.w * sw)
  const imgW = sw * scale
  const imgH = sh * scale
  const imgL = FL - crop.x * imgW
  const imgT = FT - crop.y * imgH

  // Mask shape rect on screen (mask coords are canvas-normalized → relative to the frame).
  const mL = FL + mask.x * FW
  const mT = FT + mask.y * FH
  const mW = mask.w * FW
  const mH = mask.h * FH

  const liveCrop = (): CropRect => {
    const st = useEditor.getState()
    for (const t of st.project.timeline.tracks)
      for (const c of t.clips) if (c.id === clip.id && c.kind === 'media') return (c as MediaClip).crop
    return crop
  }

  const startPan = (e: React.PointerEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    beginHistory()
    const sx = e.clientX
    const sy = e.clientY
    const ox = crop.x
    const oy = crop.y
    const onMove = (ev: PointerEvent): void => {
      const c = liveCrop()
      liveSetClipCrop(clip.id, {
        x: clamp(ox - (ev.clientX - sx) / imgW, 0, Math.max(0, 1 - c.w)),
        y: clamp(oy - (ev.clientY - sy) / imgH, 0, Math.max(0, 1 - c.h))
      })
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const onWheel = (e: React.WheelEvent): void => {
    if (wheelSession.current == null) beginHistory()
    if (wheelSession.current != null) window.clearTimeout(wheelSession.current)
    wheelSession.current = window.setTimeout(() => (wheelSession.current = null), 350)
    const c = liveCrop()
    const factor = Math.exp(e.deltaY * 0.0014)
    let nw = clamp(c.w * factor, 0.06, 1)
    let nh = nw * aspectFactor
    if (nh > 1) {
      nh = 1
      nw = nh / aspectFactor
    }
    const cx = c.x + c.w / 2
    const cy = c.y + c.h / 2
    liveSetClipCrop(clip.id, {
      w: nw,
      h: nh,
      x: clamp(cx - nw / 2, 0, Math.max(0, 1 - nw)),
      y: clamp(cy - nh / 2, 0, Math.max(0, 1 - nh))
    })
  }

  // ---- shape mask: move + resize (edits clip.mask, canvas-normalized) ----
  const startShapeMove = (e: React.PointerEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    beginHistory()
    const sx = e.clientX
    const sy = e.clientY
    const ox = mask.x
    const oy = mask.y
    const onMove = (ev: PointerEvent): void => {
      liveSetClipMask(clip.id, { x: ox + (ev.clientX - sx) / FW, y: oy + (ev.clientY - sy) / FH })
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const startShapeResize = (e: React.PointerEvent, h: Corner): void => {
    e.preventDefault()
    e.stopPropagation()
    const rect = layerRef.current?.getBoundingClientRect()
    if (!rect) return
    beginHistory()
    const left0 = mL
    const top0 = mT
    const right0 = mL + mW
    const bottom0 = mT + mH
    const onMove = (ev: PointerEvent): void => {
      const px = ev.clientX - rect.left
      const py = ev.clientY - rect.top
      let left = left0
      let top = top0
      let right = right0
      let bottom = bottom0
      if (h.includes('w')) left = Math.min(right0 - MIN_SHAPE * FW, px)
      else right = Math.max(left0 + MIN_SHAPE * FW, px)
      if (h.includes('n')) top = Math.min(bottom0 - MIN_SHAPE * FH, py)
      else bottom = Math.max(top0 + MIN_SHAPE * FH, py)
      liveSetClipMask(clip.id, {
        x: (left - FL) / FW,
        y: (top - FT) / FH,
        w: (right - left) / FW,
        h: (bottom - top) / FH
      })
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const pickShape = (shape: 'none' | 'rectangle' | 'ellipse'): void => setMask(clip.id, { shape })

  return (
    <div ref={layerRef} className="reframe-layer" onWheel={onWheel} onPointerDown={(e) => e.stopPropagation()}>
      {imgUrl ? (
        <img
          className="reframe-img"
          src={imgUrl}
          draggable={false}
          style={{ left: imgL, top: imgT, width: imgW, height: imgH }}
          onPointerDown={startPan}
        />
      ) : (
        <div
          className="reframe-img reframe-noimg"
          style={{ left: imgL, top: imgT, width: imgW, height: imgH }}
          onPointerDown={startPan}
        />
      )}

      {hasShape ? (
        <>
          {/* faint output bounds so you still see the 9:16 frame */}
          <div className="reframe-frameoutline" style={{ left: FL, top: FT, width: FW, height: FH }} />
          {/* the resizable, movable shape (rectangle or circle); dims everything outside it */}
          <div
            className={`reframe-shape ${mask.shape === 'ellipse' ? 'is-circle' : ''}`}
            style={{ left: mL, top: mT, width: mW, height: mH }}
            onPointerDown={startShapeMove}
          >
            {CORNERS.map((h) => (
              <div
                key={h}
                className={`reframe-mh reframe-mh-${h}`}
                onPointerDown={(e) => startShapeResize(e, h)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="reframe-frame" style={{ left: FL, top: FT, width: FW, height: FH }} />
      )}

      <button
        className="reframe-done"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setReframeEdit(false)}
        title="Conferma l'inquadratura (Esc)"
      >
        ✓ Fatto
      </button>

      <div className="reframe-shapes" onPointerDown={(e) => e.stopPropagation()}>
        <button className={!hasShape ? 'on' : ''} title="Pieno (nessuna forma)" onClick={() => pickShape('none')}>
          ▢
        </button>
        <button
          className={mask.shape === 'rectangle' ? 'on' : ''}
          title="Rettangolo (ridimensionabile)"
          onClick={() => pickShape('rectangle')}
        >
          ▭
        </button>
        <button
          className={mask.shape === 'ellipse' ? 'on' : ''}
          title="Cerchio (ridimensionabile)"
          onClick={() => pickShape('ellipse')}
        >
          ⬭
        </button>
      </div>

      <div className="reframe-hint">
        {hasShape ? 'Trascina la forma · maniglie = ridimensiona · rotella = zoom' : 'Trascina = sposta · rotella = zoom'}
      </div>
    </div>
  )
}
