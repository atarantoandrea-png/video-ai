import { useState } from 'react'
import { useEditor } from '../state/store'

/**
 * Export settings popover: resolution (720p/1080p/4K), fps, quality and container
 * (MP4/MOV/GIF). Confirms with the real export. Resolution is a scale on the canvas
 * (whose minor side is 1080), so 0.667 = 720p, 1 = 1080p, 2 = 4K-class.
 */
export function ExportMenu({ onClose }: { onClose: () => void }): JSX.Element {
  const startExport = useEditor((s) => s.startExport)
  const startHifiExport = useEditor((s) => s.startHifiExport)
  const canvasW = useEditor((s) => s.project.canvas.width)
  const canvasH = useEditor((s) => s.project.canvas.height)
  // A smooth speed ramp can only be rendered frame-accurately, so its presence forces the
  // hi-fi (canvas) export path — otherwise the variable speed would be lost.
  const hasRamp = useEditor((s) =>
    s.project.timeline.tracks.some((t) =>
      t.clips.some((c) => c.kind === 'media' && !!c.speedRamp && c.speedRamp.length >= 2)
    )
  )
  const [scale, setScale] = useState(1)
  const [fps, setFps] = useState(0) // 0 = keep project fps
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high')
  const [format, setFormat] = useState<'mp4' | 'mov' | 'gif' | 'mp3'>('mp4')
  const [hifi, setHifi] = useState(false)

  const outW = Math.round((canvasW * scale) / 2) * 2
  const outH = Math.round((canvasH * scale) / 2) * 2

  const PRESETS: {
    label: string
    s: number
    fps: number
    q: 'low' | 'medium' | 'high'
    fmt: 'mp4' | 'mov' | 'gif' | 'mp3'
  }[] = [
    { label: 'Social 1080p', s: 1, fps: 30, q: 'high', fmt: 'mp4' },
    { label: 'Social leggero', s: 0.6667, fps: 30, q: 'medium', fmt: 'mp4' },
    { label: 'Max 4K', s: 2, fps: 60, q: 'high', fmt: 'mp4' },
    { label: 'Solo audio', s: 1, fps: 30, q: 'high', fmt: 'mp3' },
    { label: 'GIF', s: 0.6667, fps: 15, q: 'medium', fmt: 'gif' }
  ]

  const run = (): void => {
    onClose()
    const s = { outputScale: scale, fps: fps || undefined, quality, format }
    if ((hifi || hasRamp) && format !== 'gif' && format !== 'mp3') void startHifiExport(s)
    else void startExport(s)
  }

  return (
    <div className="export-menu" onPointerDown={(e) => e.stopPropagation()}>
      <div className="export-title">Impostazioni export</div>

      <div className="chip-row" style={{ marginBottom: 8 }}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className="chip"
            title={`Imposta ${p.label}`}
            onClick={() => {
              setScale(p.s)
              setFps(p.fps)
              setQuality(p.q)
              setFormat(p.fmt)
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {format !== 'mp3' && (
        <label className="export-row">
          <span>Risoluzione</span>
          <select className="select" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))}>
            <option value={0.6667}>720p</option>
            <option value={1}>1080p</option>
            <option value={1.3333}>2K (1440p)</option>
            <option value={2}>4K</option>
          </select>
        </label>
      )}

      {format !== 'mp3' && (
        <label className="export-row">
          <span>FPS</span>
          <select className="select" value={fps} onChange={(e) => setFps(parseInt(e.target.value, 10))}>
            <option value={0}>Originale</option>
            <option value={24}>24</option>
            <option value={25}>25</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </label>
      )}

      <label className="export-row">
        <span>Qualità</span>
        <select
          className="select"
          value={quality}
          onChange={(e) => setQuality(e.target.value as 'low' | 'medium' | 'high')}
        >
          <option value="low">Bassa</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
        </select>
      </label>

      <label className="export-row">
        <span>Formato</span>
        <select
          className="select"
          value={format}
          onChange={(e) => setFormat(e.target.value as 'mp4' | 'mov' | 'gif' | 'mp3')}
        >
          <option value="mp4">MP4 (H.264)</option>
          <option value="mov">MOV (QuickTime)</option>
          <option value="mp3">MP3 (solo audio)</option>
          <option value="gif">GIF animata</option>
        </select>
      </label>

      {format !== 'gif' && format !== 'mp3' && (
        <label className="export-row" style={{ cursor: 'pointer' }} title="Renderizza ogni fotogramma col motore dell'anteprima: identico ma molto più lento">
          <span>Alta fedeltà (lento)</span>
          <input type="checkbox" checked={hifi} onChange={(e) => setHifi(e.target.checked)} />
        </label>
      )}

      <div className="export-out">
        {format === 'mp3' ? 'Solo audio' : `${outW}×${outH}`} · {format.toUpperCase()}
        {format === 'gif' && <span className="export-note"> (senza audio)</span>}
        {format === 'mp3' && <span className="export-note"> (MP3 stereo)</span>}
        {hifi && format !== 'gif' && format !== 'mp3' && <span className="export-note"> · alta fedeltà</span>}
      </div>

      <button className="btn btn--primary" style={{ width: '100%' }} onClick={run}>
        Esporta
      </button>
    </div>
  )
}
