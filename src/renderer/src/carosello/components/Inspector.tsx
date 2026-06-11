import { CFONTS } from '../fonts'
import type { PhotoLayer, TextLayer } from '../types'
import { useCarosello, useCurrentSlide } from '../state/caroselloStore'

export function Inspector(): JSX.Element {
  const slide = useCurrentSlide()
  const currentIndex = useCarosello((s) => s.currentIndex)
  const selId = useCarosello((s) => s.selectedLayerId)
  const meta = useCarosello((s) => s.project.meta)
  const updateLayer = useCarosello((s) => s.updateLayer)
  const removeLayer = useCarosello((s) => s.removeLayer)
  const raiseLayer = useCarosello((s) => s.raiseLayer)
  const setSlideBgColor = useCarosello((s) => s.setSlideBgColor)

  const layer = slide?.layers.find((l) => l.id === selId)

  if (!layer) {
    return (
      <div className="car-inspector">
        <div className="car-field">
          <label>Sfondo slide (colore base)</label>
          <div className="car-row">
            <input
              type="color"
              value={slide?.bgColor ?? '#ffffff'}
              onChange={(e) => setSlideBgColor(currentIndex, e.target.value)}
            />
            <span className="car-hint">Visibile dove non c'è l'immagine di sfondo.</span>
          </div>
        </div>
        <p className="car-hint">
          Seleziona un testo o una foto sullo stage per modificarne le proprietà, oppure usa la
          barra in alto per aggiungere <b>Testo</b>, lo <b>Sfondo</b> (immagine di GPT) o una{' '}
          <b>Foto di Elisa</b>.
        </p>
        {meta && (meta.caption || meta.hashtag?.length || meta.commentoFissato) && (
          <div className="car-meta">
            {meta.tema && (
              <div>
                <b>Tema:</b> {meta.tema}
              </div>
            )}
            {meta.caption && (
              <div style={{ marginTop: 6 }}>
                <b>Didascalia:</b> {meta.caption}
              </div>
            )}
            {meta.hashtag?.length ? (
              <div style={{ marginTop: 6 }}>
                <b>Hashtag:</b> {meta.hashtag.join(' ')}
              </div>
            ) : null}
            {meta.commentoFissato && (
              <div style={{ marginTop: 6 }}>
                <b>Commento da fissare:</b> {meta.commentoFissato}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="car-inspector">
      {layer.kind === 'text' ? (
        <TextControls layer={layer} update={(p) => updateLayer(layer.id, p)} />
      ) : (
        <PhotoControls layer={layer} update={(p) => updateLayer(layer.id, p)} />
      )}
      <div className="car-row">
        <button className="car-btn ghost" onClick={() => raiseLayer(layer.id, 1)}>
          ↑ Avanti
        </button>
        <button className="car-btn ghost" onClick={() => raiseLayer(layer.id, -1)}>
          ↓ Indietro
        </button>
      </div>
      <button className="car-btn" onClick={() => removeLayer(layer.id)}>
        🗑 Elimina layer
      </button>
    </div>
  )
}

function TextControls({
  layer,
  update
}: {
  layer: TextLayer
  update: (p: Partial<TextLayer>) => void
}): JSX.Element {
  return (
    <>
      <div className="car-field">
        <label>Testo</label>
        <textarea value={layer.text} onChange={(e) => update({ text: e.target.value })} />
      </div>
      <div className="car-field">
        <label>Font</label>
        <select value={layer.fontFamily} onChange={(e) => update({ fontFamily: e.target.value })}>
          {CFONTS.map((f) => (
            <option key={f.label} value={f.css}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div className="car-field">
        <label>Dimensione</label>
        <input
          type="range"
          min={0.02}
          max={0.16}
          step={0.002}
          value={layer.fontSizeFrac}
          onChange={(e) => update({ fontSizeFrac: Number(e.target.value) })}
        />
      </div>
      <div className="car-row">
        <div className="car-field">
          <label>Colore</label>
          <input type="color" value={layer.color} onChange={(e) => update({ color: e.target.value })} />
        </div>
        <div className="car-seg">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button key={a} className={layer.align === a ? 'on' : ''} onClick={() => update({ align: a })}>
              {a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}
            </button>
          ))}
        </div>
      </div>
      <div className="car-row">
        <label className="car-chk">
          <input type="checkbox" checked={layer.bold} onChange={(e) => update({ bold: e.target.checked })} />
          Grassetto
        </label>
        <label className="car-chk">
          <input type="checkbox" checked={layer.italic} onChange={(e) => update({ italic: e.target.checked })} />
          Corsivo
        </label>
      </div>
      <div className="car-row">
        <label className="car-chk">
          <input
            type="checkbox"
            checked={layer.uppercase}
            onChange={(e) => update({ uppercase: e.target.checked })}
          />
          MAIUSCOLO
        </label>
        <label className="car-chk">
          <input type="checkbox" checked={layer.shadow} onChange={(e) => update({ shadow: e.target.checked })} />
          Ombra
        </label>
      </div>
      <div className="car-field">
        <label className="car-chk">
          <input
            type="checkbox"
            checked={layer.highlight}
            onChange={(e) => update({ highlight: e.target.checked })}
          />
          Sfondo dietro al testo
        </label>
        {layer.highlight && (
          <input
            type="color"
            value={layer.highlightColor}
            onChange={(e) => update({ highlightColor: e.target.value })}
          />
        )}
      </div>
      <div className="car-field">
        <label>Larghezza riquadro</label>
        <input
          type="range"
          min={0.2}
          max={1}
          step={0.02}
          value={layer.widthFrac}
          onChange={(e) => update({ widthFrac: Number(e.target.value) })}
        />
      </div>
      <div className="car-field">
        <label>Interlinea</label>
        <input
          type="range"
          min={0.9}
          max={2}
          step={0.05}
          value={layer.lineHeightMul}
          onChange={(e) => update({ lineHeightMul: Number(e.target.value) })}
        />
      </div>
    </>
  )
}

function PhotoControls({
  layer,
  update
}: {
  layer: PhotoLayer
  update: (p: Partial<PhotoLayer>) => void
}): JSX.Element {
  return (
    <>
      <div className="car-field">
        <label>Dimensione foto</label>
        <input
          type="range"
          min={0.2}
          max={1.7}
          step={0.02}
          value={layer.heightFrac}
          onChange={(e) => update({ heightFrac: Number(e.target.value) })}
        />
      </div>
      <div className="car-field">
        <label>Opacità ({Math.round(layer.opacity * 100)}%)</label>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.02}
          value={layer.opacity}
          onChange={(e) => update({ opacity: Number(e.target.value) })}
        />
      </div>
      <div className="car-field">
        <label>Rotazione</label>
        <input
          type="range"
          min={-45}
          max={45}
          step={1}
          value={layer.rotation}
          onChange={(e) => update({ rotation: Number(e.target.value) })}
        />
      </div>
      <div className="car-row">
        <label className="car-chk">
          <input
            type="checkbox"
            checked={layer.grayscale}
            onChange={(e) => update({ grayscale: e.target.checked })}
          />
          Bianco/nero
        </label>
        <label className="car-chk">
          <input type="checkbox" checked={layer.flip} onChange={(e) => update({ flip: e.target.checked })} />
          Specchia
        </label>
      </div>
      <p className="car-hint">
        Per l'effetto "viso in sottofondo" abbassa l'opacità (~30%) e attiva il bianco/nero.
      </p>
    </>
  )
}
