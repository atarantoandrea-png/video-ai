import { useEffect, useRef } from 'react'
import { useEditor } from '../state/store'
import { type CropRect, type MediaClip } from '@shared/projectSchema'
import { mediaUrl } from '@shared/media'
import { clamp } from '@shared/geometry'

/**
 * CapCut-style REFRAME (visual crop). Enter with a double-click on the move/resize box.
 * The output frame stays FIXED in the middle; the WHOLE source image is shown behind it
 * (the cropped-away parts dimmed); you drag the image to choose what's inside the frame
 * (change subject) and scroll to zoom. It edits clip.crop, kept at the output aspect so
 * the framing never distorts — WYSIWYG with the export.
 */
export function ReframeOverlay({ frameW, frameH }: { frameW: number; frameH: number }): JSX.Element | null {
  const reframeEdit = useEditor((s) => s.reframeEdit)
  const setReframeEdit = useEditor((s) => s.setReframeEdit)
  const beginHistory = useEditor((s) => s.beginHistory)
  const liveSetClipCrop = useEditor((s) => s.liveSetClipCrop)
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
  const wheelSession = useRef<number | null>(null)

  // Esc / Enter / double-click confirm and leave.
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
  // crop.h is tied to the output aspect: (crop.w*sw)/(crop.h*sh) = canvasW/canvasH.
  const aspectFactor = (sw * canvasH) / (sh * canvasW) // → crop.h = crop.w * aspectFactor

  // Fixed output frame: centred, 64% of the preview, leaving a margin to show the dimmed
  // overflow of the image around it.
  const FW = frameW * 0.64
  const FH = frameH * 0.64
  const FL = (frameW - FW) / 2
  const FT = (frameH - FH) / 2

  // Scale & position the full image so its crop sub-rect lands exactly on the frame.
  const scale = FW / (crop.w * sw)
  const imgW = sw * scale
  const imgH = sh * scale
  const imgL = FL - crop.x * imgW
  const imgT = FT - crop.y * imgH

  /** Latest crop straight from the store (so rapid wheel/drag events compound correctly). */
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
      const nx = clamp(ox - (ev.clientX - sx) / imgW, 0, Math.max(0, 1 - c.w))
      const ny = clamp(oy - (ev.clientY - sy) / imgH, 0, Math.max(0, 1 - c.h))
      liveSetClipCrop(clip.id, { x: nx, y: ny })
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const onWheel = (e: React.WheelEvent): void => {
    // One undo step per burst of scrolling.
    if (wheelSession.current == null) beginHistory()
    if (wheelSession.current != null) window.clearTimeout(wheelSession.current)
    wheelSession.current = window.setTimeout(() => (wheelSession.current = null), 350)
    const c = liveCrop()
    const factor = Math.exp(e.deltaY * 0.0014) // scroll up (deltaY<0) → factor<1 → zoom in
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

  return (
    <div className="reframe-layer" onWheel={onWheel} onPointerDown={(e) => e.stopPropagation()}>
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
      <div className="reframe-frame" style={{ left: FL, top: FT, width: FW, height: FH }} />
      <button
        className="reframe-done"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setReframeEdit(false)}
        title="Conferma l'inquadratura (Esc)"
      >
        ✓ Fatto
      </button>
      <div className="reframe-hint">Trascina = sposta · rotella = zoom</div>
    </div>
  )
}
