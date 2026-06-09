import { useEditor } from '../state/store'
import { isMediaClip, timelineDuration } from '@shared/projectSchema'
import { formatTimecode } from '../util/format'
import { fitWithin, useElementSize } from '../util/useElementSize'
import { PreviewCanvas } from '../preview/PreviewCanvas'
import { TransformOverlay } from './TransformOverlay'
import { MaskOverlay } from './MaskOverlay'
import { TextOverlay } from './TextOverlay'
import { FaceSelectOverlay } from './FaceSelectOverlay'

const BROWSER_CODECS = new Set(['h264', 'avc1', 'vp8', 'vp9', 'av1', 'theora'])

export function Player(): JSX.Element {
  const canvasW = useEditor((s) => s.project.canvas.width)
  const canvasH = useEditor((s) => s.project.canvas.height)
  const playhead = useEditor((s) => s.playhead)
  const isPlaying = useEditor((s) => s.isPlaying)
  const togglePlay = useEditor((s) => s.togglePlay)
  const setPlayhead = useEditor((s) => s.setPlayhead)
  const duration = useEditor((s) => timelineDuration(s.project.timeline))
  const optimizing = useEditor((s) => {
    // Only the TOP-MOST clip on screen matters: if an image/other clip covers the
    // HEVC video, there's nothing to "optimize" for the viewer, so no overlay.
    let topSourceId: string | null = null
    let topTi = -1
    s.project.timeline.tracks.forEach((t, ti) => {
      if (t.type !== 'video' || t.hidden) return
      for (const c of t.clips) {
        if (!isMediaClip(c) || s.playhead < c.timelineStart || s.playhead >= c.timelineEnd) continue
        if (ti >= topTi) {
          topTi = ti
          topSourceId = c.sourceId
        }
      }
    })
    if (!topSourceId) return false
    const src = s.project.sources.find((x) => x.id === topSourceId)
    // Only real videos need the HEVC proxy; images (codec 'png'/'mjpeg') never do.
    return !!(
      src &&
      src.kind === 'video' &&
      !src.proxyPath &&
      src.videoCodec &&
      !BROWSER_CODECS.has(src.videoCodec)
    )
  })

  const [stageRef, stage] = useElementSize<HTMLDivElement>()
  const frame = fitWithin(stage.w - 32, stage.h - 32, canvasW, canvasH)

  return (
    <div className="panel panel--center">
      <div className="panel-head">Anteprima</div>

      <div className="player-stage" ref={stageRef}>
        <div className="player-frame" style={{ width: frame.w, height: frame.h }}>
          <PreviewCanvas width={frame.w} height={frame.h} />
          <TransformOverlay frameW={frame.w} frameH={frame.h} />
          <MaskOverlay frameW={frame.w} frameH={frame.h} />
          <TextOverlay frameW={frame.w} frameH={frame.h} />
          <FaceSelectOverlay frameW={frame.w} frameH={frame.h} />
          {optimizing && (
            <div className="optimizing-overlay">
              Ottimizzazione video…
              <br />
              <span style={{ fontSize: 11, opacity: 0.7 }}>(creazione anteprima per codec HEVC)</span>
            </div>
          )}
        </div>
      </div>

      <div className="player-transport">
        <button className="iconbtn" title="Vai all'inizio" onClick={() => setPlayhead(0)}>
          ⏮
        </button>
        <button className="iconbtn" title="Play/Pausa (spazio)" onClick={togglePlay}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button className="iconbtn" title="Vai alla fine" onClick={() => setPlayhead(duration)}>
          ⏭
        </button>
        <span className="timecode">
          {formatTimecode(playhead)} / {formatTimecode(duration)}
        </span>
      </div>
    </div>
  )
}
