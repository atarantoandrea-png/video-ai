import { useRef } from 'react'
import { useEditor } from '../state/store'
import { type MediaClip } from '@shared/projectSchema'
import { resolveTransformAt } from '@shared/anim'
import { clamp } from '@shared/geometry'

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN = 0.04

/**
 * Direct manipulation on the preview: click a clip to select it,
 * drag the body to move it within the frame, drag the corner/side handles to
 * resize it. Edits clip.transform (canvas-normalized), so the change is WYSIWYG
 * with the export. One undo step per gesture (beginHistory + liveUpdateClip).
 */
export function TransformOverlay({ frameW, frameH }: { frameW: number; frameH: number }): JSX.Element | null {
  const layerRef = useRef<HTMLDivElement>(null)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const clip = useEditor((s) => {
    if (!s.selectedClipId) return null
    for (const t of s.project.timeline.tracks) {
      for (const c of t.clips) if (c.id === s.selectedClipId && c.kind === 'media') return c as MediaClip
    }
    return null
  })
  const playhead = useEditor((s) => s.playhead)
  // Active media clips on video tracks at the playhead, bottom→top, for hit-testing.
  // Uses the RESOLVED (animated) transform so the box matches what's on screen.
  const active = useEditor((s) => {
    const out: { id: string; box: [number, number, number, number] }[] = []
    for (const t of s.project.timeline.tracks) {
      if (t.type !== 'video' || t.hidden) continue
      for (const c of t.clips) {
        if (c.kind !== 'media') continue
        if (s.playhead < c.timelineStart || s.playhead >= c.timelineEnd) continue
        const tr = resolveTransformAt(c, s.playhead - c.timelineStart)
        out.push({ id: c.id, box: [tr.x, tr.y, tr.w, tr.h] })
      }
    }
    return out
  })
  const selectClip = useEditor((s) => s.selectClip)
  const beginHistory = useEditor((s) => s.beginHistory)
  const liveSetClipTransform = useEditor((s) => s.liveSetClipTransform)
  const transformEdit = useEditor((s) => s.transformEdit)
  const reframeEdit = useEditor((s) => s.reframeEdit)
  const setReframeEdit = useEditor((s) => s.setReframeEdit)

  // Handles appear only in edit mode (toggled from the Inspector), so simply
  // clicking around the timeline never pops up the move/resize squares. While the
  // reframe (crop) editor is open, ITS overlay takes over — hide these handles.
  if (!transformEdit || reframeEdit || frameW < 2 || frameH < 2) return null

  const trOf = (c: MediaClip): MediaClip['transform'] =>
    resolveTransformAt(c, playhead - c.timelineStart)

  const startMove = (e: React.PointerEvent, c: MediaClip): void => {
    e.preventDefault()
    e.stopPropagation()
    beginHistory()
    const sx = e.clientX
    const sy = e.clientY
    const base = trOf(c)
    const ox = base.x
    const oy = base.y
    const onMove = (ev: PointerEvent): void => {
      const dx = (ev.clientX - sx) / frameW
      const dy = (ev.clientY - sy) / frameH
      liveSetClipTransform(c.id, { x: clamp(ox + dx, -3, 3), y: clamp(oy + dy, -3, 3) })
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const startResize = (e: React.PointerEvent, c: MediaClip, h: Handle): void => {
    e.preventDefault()
    e.stopPropagation()
    beginHistory()
    const rect = layerRef.current?.getBoundingClientRect()
    if (!rect) return
    const t = trOf(c)
    const left0 = t.x * frameW
    const top0 = t.y * frameH
    const w0 = Math.max(1, t.w * frameW)
    const h0 = Math.max(1, t.h * frameH)
    const right0 = left0 + w0
    const bottom0 = top0 + h0
    const corner = h.length === 2
    const onMove = (ev: PointerEvent): void => {
      const mx = ev.clientX - rect.left
      const my = ev.clientY - rect.top
      let left = left0
      let top = top0
      let right = right0
      let bottom = bottom0
      if (corner) {
        // Uniform scale (keep box aspect), anchored at the opposite corner.
        const anchorX = h.includes('w') ? right0 : left0
        const anchorY = h.includes('n') ? bottom0 : top0
        const sc = Math.max(MIN, Math.abs(mx - anchorX) / w0, Math.abs(my - anchorY) / h0)
        const nw = w0 * sc
        const nh = h0 * sc
        if (h.includes('w')) {
          left = anchorX - nw
          right = anchorX
        } else {
          left = anchorX
          right = anchorX + nw
        }
        if (h.includes('n')) {
          top = anchorY - nh
          bottom = anchorY
        } else {
          top = anchorY
          bottom = anchorY + nh
        }
      } else if (h === 'e') right = Math.max(left0 + frameW * MIN, mx)
      else if (h === 'w') left = Math.min(right0 - frameW * MIN, mx)
      else if (h === 's') bottom = Math.max(top0 + frameH * MIN, my)
      else if (h === 'n') top = Math.min(bottom0 - frameH * MIN, my)

      liveSetClipTransform(c.id, {
        x: left / frameW,
        y: top / frameH,
        w: Math.max(MIN, (right - left) / frameW),
        h: Math.max(MIN, (bottom - top) / frameH)
      })
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const startRotate = (e: React.PointerEvent, c: MediaClip): void => {
    e.preventDefault()
    e.stopPropagation()
    const rect = layerRef.current?.getBoundingClientRect()
    if (!rect) return
    beginHistory()
    const t = trOf(c)
    const cxp = rect.left + (t.x + t.w / 2) * frameW
    const cyp = rect.top + (t.y + t.h / 2) * frameH
    const onMove = (ev: PointerEvent): void => {
      let deg = (Math.atan2(ev.clientY - cyp, ev.clientX - cxp) * 180) / Math.PI + 90
      if (ev.shiftKey) deg = Math.round(deg / 15) * 15 // hold Shift to snap to 15°
      liveSetClipTransform(c.id, { rotation: Math.round(((deg % 360) + 360) % 360) })
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const onLayerDown = (e: React.PointerEvent): void => {
    const rect = layerRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = (e.clientX - rect.left) / frameW
    const py = (e.clientY - rect.top) / frameH
    for (let i = active.length - 1; i >= 0; i--) {
      const [bx, by, bw, bh] = active[i].box
      if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) {
        if (active[i].id !== selectedClipId) selectClip(active[i].id)
        return
      }
    }
  }

  const t = clip ? trOf(clip) : null
  return (
    <div ref={layerRef} className="xform-layer" onPointerDown={onLayerDown}>
      {clip && t && (
        <div
          className="xform-box"
          style={{
            left: t.x * frameW,
            top: t.y * frameH,
            width: t.w * frameW,
            height: t.h * frameH,
            transform: t.rotation ? `rotate(${t.rotation}deg)` : undefined
          }}
          onPointerDown={(e) => startMove(e, clip)}
          onDoubleClick={(e) => {
            // CapCut-style: double-click the box → reframe (pick which part of the
            // source shows, with the whole image visible behind a fixed frame).
            e.stopPropagation()
            setReframeEdit(true)
          }}
          title="Doppio clic per scegliere l'inquadratura (reframe)"
        >
          {HANDLES.map((h) => (
            <div
              key={h}
              className={`xform-handle xform-${h}`}
              onPointerDown={(e) => startResize(e, clip, h)}
            />
          ))}
          <div className="xform-rot-line" />
          <div className="xform-rot" title="Ruota (tieni Shift per scatti di 15°)" onPointerDown={(e) => startRotate(e, clip)} />
        </div>
      )}
    </div>
  )
}
