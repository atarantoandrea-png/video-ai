import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as RPointerEvent } from 'react'
import { FORMATS, type Layer, type PhotoLayer, type TextLayer } from '../types'
import { useCarosello, useCurrentSlide } from '../state/caroselloStore'

/** Interactive editing stage: the current slide rendered full-res and scaled to fit.
 *  Photos and text are draggable; the canvas export mirrors this layout. */
export function Stage(): JSX.Element {
  const slide = useCurrentSlide()
  const format = useCarosello((s) => s.project.format)
  const selectedId = useCarosello((s) => s.selectedLayerId)
  const selectLayer = useCarosello((s) => s.selectLayer)
  const updateLayer = useCarosello((s) => s.updateLayer)
  const { w: W, h: H } = FORMATS[format]

  const wrapRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setBox({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const scale = box.w && box.h ? Math.min(box.w / W, box.h / H) : 0

  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null)
  function onLayerDown(e: RPointerEvent, lay: Layer): void {
    e.stopPropagation()
    selectLayer(lay.id)
    if (!scale) return
    drag.current = { id: lay.id, sx: e.clientX, sy: e.clientY, ox: lay.xFrac, oy: lay.yFrac }
    const move = (ev: PointerEvent): void => {
      const d = drag.current
      if (!d) return
      updateLayer(d.id, {
        xFrac: clamp(d.ox + (ev.clientX - d.sx) / (scale * W)),
        yFrac: clamp(d.oy + (ev.clientY - d.sy) / (scale * H))
      })
    }
    const up = (): void => {
      drag.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  if (!slide) return <div className="car-stage-wrap" ref={wrapRef} />

  return (
    <div className="car-stage-wrap" ref={wrapRef} onPointerDown={() => selectLayer(null)}>
      <div
        className="car-stage"
        style={{ width: W, height: H, transform: `scale(${scale})`, background: slide.bgColor }}
      >
        {slide.bg && <img className="car-bg" src={slide.bg} alt="" draggable={false} />}
        {slide.layers.map((lay) =>
          lay.kind === 'photo' ? (
            <img
              key={lay.id}
              className={'car-layer car-photo' + (selectedId === lay.id ? ' sel' : '')}
              src={lay.src}
              alt=""
              draggable={false}
              onPointerDown={(e) => onLayerDown(e, lay)}
              style={photoStyle(lay, H)}
            />
          ) : (
            <div
              key={lay.id}
              className={'car-layer car-text' + (selectedId === lay.id ? ' sel' : '')}
              onPointerDown={(e) => onLayerDown(e, lay)}
              style={textStyle(lay, H)}
            >
              {lay.uppercase ? lay.text.toUpperCase() : lay.text}
            </div>
          )
        )}
      </div>
    </div>
  )
}

const clamp = (v: number): number => Math.min(1.2, Math.max(-0.2, v))

function photoStyle(p: PhotoLayer, H: number): CSSProperties {
  return {
    height: p.heightFrac * H,
    left: `${p.xFrac * 100}%`,
    top: `${p.yFrac * 100}%`,
    opacity: p.opacity,
    filter: p.grayscale ? 'grayscale(1)' : 'none',
    transform: `translate(-50%,-50%) rotate(${p.rotation}deg) scaleX(${p.flip ? -1 : 1})`
  }
}

function textStyle(t: TextLayer, H: number): CSSProperties {
  return {
    left: `${(t.xFrac - t.widthFrac / 2) * 100}%`,
    top: `${t.yFrac * 100}%`,
    width: `${t.widthFrac * 100}%`,
    transform: 'translateY(-50%)',
    fontFamily: t.fontFamily,
    fontSize: t.fontSizeFrac * H,
    lineHeight: t.lineHeightMul,
    color: t.color,
    fontWeight: t.bold ? 700 : 400,
    fontStyle: t.italic ? 'italic' : 'normal',
    textAlign: t.align,
    textTransform: t.uppercase ? 'uppercase' : 'none',
    opacity: t.opacity,
    textShadow: t.shadow ? '0 2px 8px rgba(0,0,0,0.45)' : 'none',
    background: t.highlight ? t.highlightColor : 'transparent',
    padding: t.highlight ? '0.06em 0.18em' : 0,
    borderRadius: t.highlight ? '0.1em' : 0
  }
}
