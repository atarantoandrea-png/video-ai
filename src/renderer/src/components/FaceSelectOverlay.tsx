import { useEditor } from '../state/store'
import { resolveClipLayout } from '@shared/geometry'
import { isMediaClip } from '@shared/projectSchema'

/**
 * When several faces are detected, overlays a clickable box on each so the user
 * picks WHICH face the blur should follow. Maps source-normalized faces through the
 * clip's crop+transform to the preview.
 */
export function FaceSelectOverlay({ frameW, frameH }: { frameW: number; frameH: number }): JSX.Element | null {
  const faceSelect = useEditor((s) => s.faceSelect)
  const pickFace = useEditor((s) => s.pickFace)
  const cancel = useEditor((s) => s.cancelFaceSelect)
  const canvasW = useEditor((s) => s.project.canvas.width)
  const canvasH = useEditor((s) => s.project.canvas.height)
  const clip = useEditor((s) => {
    if (!s.faceSelect) return null
    for (const t of s.project.timeline.tracks) {
      for (const c of t.clips) if (c.id === s.faceSelect.clipId && isMediaClip(c)) return c
    }
    return null
  })
  const src = useEditor((s) =>
    clip ? (s.project.sources.find((x) => x.id === clip.sourceId) ?? null) : null
  )

  if (!faceSelect || !clip || !src || frameW < 2) return null
  const layout = resolveClipLayout(clip.crop, clip.transform, src.width, src.height, canvasW, canvasH)
  const sr = layout.sourceRect
  const cr = layout.contentRect
  const kx = frameW / canvasW
  const ky = frameH / canvasH

  return (
    <div className="face-select-layer">
      <div className="face-select-hint">Tocca il volto da seguire</div>
      {faceSelect.faces.map((f, i) => {
        const cxPx = cr.x + ((f.cx * src.width - sr.x) / sr.w) * cr.w
        const cyPx = cr.y + ((f.cy * src.height - sr.y) / sr.h) * cr.h
        const wPx = ((f.w * src.width) / sr.w) * cr.w
        const hPx = ((f.h * src.height) / sr.h) * cr.h
        return (
          <button
            key={i}
            className="face-box"
            style={{
              left: (cxPx - wPx / 2) * kx,
              top: (cyPx - hPx / 2) * ky,
              width: wPx * kx,
              height: hPx * ky
            }}
            onClick={() => pickFace(i)}
          >
            <span>{i + 1}</span>
          </button>
        )
      })}
      <button className="btn face-cancel" onClick={cancel}>
        Annulla
      </button>
    </div>
  )
}
