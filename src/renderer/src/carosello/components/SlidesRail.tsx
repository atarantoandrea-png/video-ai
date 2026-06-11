import { useEffect, useState } from 'react'
import { renderSlide } from '../export'
import { FORMATS, type Format, type Slide } from '../types'
import { useCarosello } from '../state/caroselloStore'

function Thumb({ slide, format }: { slide: Slide; format: Format }): JSX.Element {
  const [url, setUrl] = useState('')
  const key = JSON.stringify(slide) + format
  useEffect(() => {
    let alive = true
    renderSlide(slide, format)
      .then((c) => {
        if (alive) setUrl(c.toDataURL('image/png'))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const arPct = (FORMATS[format].h / FORMATS[format].w) * 100
  return url ? (
    <img src={url} alt="" />
  ) : (
    <div style={{ width: '100%', paddingTop: `${arPct}%`, background: '#0d0d11' }} />
  )
}

export function SlidesRail(): JSX.Element {
  const slides = useCarosello((s) => s.project.slides)
  const format = useCarosello((s) => s.project.format)
  const current = useCarosello((s) => s.currentIndex)
  const selectSlide = useCarosello((s) => s.selectSlide)
  const addSlide = useCarosello((s) => s.addSlide)
  const removeSlide = useCarosello((s) => s.removeSlide)

  return (
    <div className="car-rail">
      {slides.map((sl, i) => (
        <div
          key={sl.id}
          className={'car-thumb' + (i === current ? ' sel' : '')}
          onClick={() => selectSlide(i)}
        >
          <Thumb slide={sl} format={format} />
          <span className="n">{i + 1}</span>
          {slides.length > 1 && (
            <button
              className="del"
              title="Elimina slide"
              onClick={(e) => {
                e.stopPropagation()
                removeSlide(i)
              }}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button className="car-add" onClick={addSlide}>
        + Slide
      </button>
    </div>
  )
}
