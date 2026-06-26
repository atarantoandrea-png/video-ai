import { useEditor, locateClip } from '../state/store'
import {
  isMediaClip,
  type Effect,
  type EffectType,
  type FitMode,
  type MediaClip,
  type TextClip,
  type TextAnim,
  type TextEffect
} from '@shared/projectSchema'
import { resolveTransformAt } from '@shared/anim'
import { FONTS } from '@shared/fonts'
import { LOOKS } from '@shared/looks'
import { REEL_TEMPLATES } from '@shared/templates'
import { CropBox } from './CropBox'

type LayoutKind = 'fill' | 'top' | 'bottom' | 'cropLeft' | 'cropRight'

function applyLayout(kind: LayoutKind): (cl: MediaClip) => void {
  return (cl) => {
    switch (kind) {
      case 'fill':
        cl.transform = { ...cl.transform, x: 0, y: 0, w: 1, h: 1, fit: 'cover' }
        cl.crop = { x: 0, y: 0, w: 1, h: 1 }
        break
      case 'top':
        cl.transform = { ...cl.transform, x: 0, y: 0, w: 1, h: 0.5, fit: 'cover' }
        break
      case 'bottom':
        cl.transform = { ...cl.transform, x: 0, y: 0.5, w: 1, h: 0.5, fit: 'cover' }
        break
      case 'cropLeft':
        cl.crop = { x: 0, y: 0, w: 0.5, h: 1 }
        break
      case 'cropRight':
        cl.crop = { x: 0.5, y: 0, w: 0.5, h: 1 }
        break
    }
  }
}

type EffectDef = { label: string; param: string; min: number; max: number; step: number }
const EFFECT_DEFS: Partial<Record<EffectType, EffectDef>> = {
  gblur: { label: 'Sfocatura', param: 'sigma', min: 0, max: 40, step: 1 },
  brightness: { label: 'Luminosità', param: 'value', min: -1, max: 1, step: 0.05 },
  contrast: { label: 'Contrasto', param: 'value', min: -1, max: 1, step: 0.05 },
  saturation: { label: 'Saturazione', param: 'value', min: -1, max: 1, step: 0.05 },
  hue: { label: 'Tinta', param: 'value', min: -180, max: 180, step: 5 },
  sepia: { label: 'Seppia', param: 'value', min: 0, max: 1, step: 0.05 },
  grayscale: { label: 'B/N', param: 'value', min: 0, max: 1, step: 0.05 },
  vignette: { label: 'Vignettatura', param: 'value', min: 0, max: 1, step: 0.05 },
  grain: { label: 'Grana', param: 'value', min: 0, max: 1, step: 0.05 },
  invert: { label: 'Negativo', param: 'value', min: 0, max: 1, step: 1 }
}
const FALLBACK_DEF: EffectDef = { label: 'Effetto', param: 'value', min: -1, max: 1, step: 0.05 }
const EFFECT_TYPES = Object.keys(EFFECT_DEFS) as EffectType[]

export function Inspector(): JSX.Element {
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const project = useEditor((s) => s.project)
  const loc = selectedClipId ? locateClip(project, selectedClipId) : null

  return (
    <div className="panel panel--right">
      <div className="panel-head">Proprietà</div>
      {!loc ? (
        <div className="empty-hint">
          Seleziona una clip nella timeline per modificarne posizione, ritaglio, effetti e audio.
        </div>
      ) : loc.clip.kind === 'text' ? (
        <TextInspector clip={loc.clip} />
      ) : (
        <MediaInspector clip={loc.clip} />
      )}
    </div>
  )
}

function MediaInspector({ clip }: { clip: MediaClip }): JSX.Element {
  const updateClip = useEditor((s) => s.updateClip)
  const removeClip = useEditor((s) => s.rippleDelete) // default delete = close the gap (CapCut)
  const makeStack = useEditor((s) => s.makeTwoPersonStack)
  const addEffect = useEditor((s) => s.addEffect)
  const removeEffect = useEditor((s) => s.removeEffect)
  const updateEffect = useEditor((s) => s.updateEffect)
  const setLook = useEditor((s) => s.setLook)
  const applyReelTemplate = useEditor((s) => s.applyReelTemplate)
  const selCount = useEditor((s) => s.selectedClipIds.length)
  const setFade = useEditor((s) => s.setFade)
  const makeBlur = useEditor((s) => s.makeBlurRegion)
  const setMask = useEditor((s) => s.setMask)
  const transformEdit = useEditor((s) => s.transformEdit)
  const toggleTransformEdit = useEditor((s) => s.toggleTransformEdit)
  const setReframeEdit = useEditor((s) => s.setReframeEdit)
  const reframeEdit = useEditor((s) => s.reframeEdit)
  const flipClip = useEditor((s) => s.flipClip)
  const duplicateClip = useEditor((s) => s.duplicateClip)
  const setSpeed = useEditor((s) => s.setSpeed)
  const setSpeedRamp = useEditor((s) => s.setSpeedRamp)
  const toggleReverse = useEditor((s) => s.toggleReverse)
  const extractAudio = useEditor((s) => s.extractAudio)
  const toggleClipAudioFlag = useEditor((s) => s.toggleClipAudioFlag)
  const detectBeats = useEditor((s) => s.detectBeats)
  const setChroma = useEditor((s) => s.setChroma)
  const srcHasAudio = useEditor((s) => !!s.project.sources.find((x) => x.id === clip.sourceId)?.hasAudio)
  const maskEdit = useEditor((s) => s.maskEdit)
  const toggleMaskEdit = useEditor((s) => s.toggleMaskEdit)
  const setClipTransform = useEditor((s) => s.setClipTransform)
  const addKeyframe = useEditor((s) => s.addKeyframe)
  const clearKeyframes = useEditor((s) => s.clearKeyframes)
  const playhead = useEditor((s) => s.playhead)
  const beginFaceSelect = useEditor((s) => s.beginFaceSelect)
  const faceTracking = useEditor((s) => s.faceTracking)

  const animated = !!(clip.keyframes && clip.keyframes.length)
  // Show the live (interpolated) transform at the playhead when animated.
  const t = animated ? resolveTransformAt(clip, playhead - clip.timelineStart) : clip.transform
  const c = clip.crop
  const setT = (patch: Partial<MediaClip['transform']>): void => setClipTransform(clip.id, patch)
  const setC = (patch: Partial<MediaClip['crop']>): void =>
    updateClip(clip.id, (cl) => void Object.assign(cl.crop, patch))

  return (
    <div className="inspector">
      <button
        className={`btn ${transformEdit ? 'btn--toggle-on' : ''}`}
        style={{ width: '100%' }}
        onClick={toggleTransformEdit}
        title="Mostra/nascondi le maniglie per spostare e ridimensionare sull'anteprima"
      >
        {transformEdit ? '✥ Modifica riquadro: ATTIVA' : '✥ Sposta / ridimensiona sull’anteprima'}
      </button>
      <button
        className={`btn ${reframeEdit ? 'btn--toggle-on' : ''}`}
        style={{ width: '100%', marginTop: 6 }}
        onClick={() => setReframeEdit(!reframeEdit)}
        title="Scegli a occhio quale parte dell'immagine si vede, come su CapCut (anche: doppio clic sul riquadro)"
      >
        {reframeEdit ? '⛶ Reframe: ATTIVO' : '⛶ Scegli inquadratura (reframe)'}
      </button>
      {reframeEdit && (
        <>
          <div className="seg-row" style={{ marginTop: 6 }}>
            <button
              className={`seg-btn ${clip.mask.shape === 'none' ? 'seg-on' : ''}`}
              title="Inquadratura piena (nessuna forma)"
              onClick={() => setMask(clip.id, { shape: 'none' })}
            >
              ▢ Pieno
            </button>
            <button
              className={`seg-btn ${clip.mask.shape === 'rectangle' ? 'seg-on' : ''}`}
              title="Ritaglia in un rettangolo ridimensionabile"
              onClick={() => setMask(clip.id, { shape: 'rectangle' })}
            >
              ▭ Rettangolo
            </button>
            <button
              className={`seg-btn ${clip.mask.shape === 'ellipse' ? 'seg-on' : ''}`}
              title="Ritaglia in un cerchio ridimensionabile"
              onClick={() => setMask(clip.id, { shape: 'ellipse' })}
            >
              ⬭ Cerchio
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '6px 2px 0', lineHeight: 1.4 }}>
            Sull’anteprima: trascina l’immagine o la forma · maniglie = ridimensiona · rotella = zoom
          </p>
        </>
      )}
      <div className="seg-row">
        <button className={`seg-btn ${clip.transform.flipH ? 'seg-on' : ''}`} title="Specchia orizzontale" onClick={() => flipClip(clip.id, 'h')}>
          ⇆
        </button>
        <button className={`seg-btn ${clip.transform.flipV ? 'seg-on' : ''}`} title="Specchia verticale" onClick={() => flipClip(clip.id, 'v')}>
          ⇅
        </button>
        <button className="seg-btn" style={{ flex: 1 }} title="Duplica (⌘D)" onClick={() => duplicateClip(clip.id)}>
          ⧉ Duplica
        </button>
      </div>
      <div className="field">
        <div className="section-title">Velocità {clip.speed.toFixed(2)}×</div>
        <input
          type="range"
          min={0.25}
          max={4}
          step={0.05}
          value={clip.speed}
          onChange={(e) => setSpeed(clip.id, parseFloat(e.target.value))}
        />
        <div className="chip-row" style={{ marginTop: 6 }}>
          {[0.5, 1, 2].map((v) => (
            <button
              key={v}
              className={`chip ${Math.abs(clip.speed - v) < 0.01 ? 'chip--active' : ''}`}
              onClick={() => setSpeed(clip.id, v)}
            >
              {v}×
            </button>
          ))}
          <button
            className={`chip ${clip.reverse ? 'chip--active' : ''}`}
            onClick={() => toggleReverse(clip.id)}
          >
            ⇄ Inverti
          </button>
        </div>
        <div className="section-title" style={{ marginTop: 12 }}>
          Speed ramp (velocità morbida)
        </div>
        <div className="chip-row" style={{ marginTop: 6 }}>
          <button
            className={`chip ${!clip.speedRamp ? 'chip--active' : ''}`}
            title="Velocità costante (nessun ramp)"
            onClick={() => setSpeedRamp(clip.id, null)}
          >
            Costante
          </button>
          <button className="chip" title="Rallenta al centro, veloce ai lati (slow-mo)" onClick={() => setSpeedRamp(clip.id, 'slowmo')}>
            🐢 Slow-mo
          </button>
          <button className="chip" title="Parte piano e accelera" onClick={() => setSpeedRamp(clip.id, 'speedup')}>
            ⏩ Accelera
          </button>
          <button className="chip" title="Parte veloce e rallenta" onClick={() => setSpeedRamp(clip.id, 'slowdown')}>
            ⏬ Rallenta
          </button>
        </div>
      </div>
      {srcHasAudio && (
        <div className="field">
          <div className="section-title">Audio</div>
          <div className="chip-row">
            <button className="chip" title="Stacca l'audio su una traccia separata" onClick={() => extractAudio(clip.id)}>
              ♪ Estrai audio
            </button>
            <button
              className={`chip ${clip.denoise ? 'chip--active' : ''}`}
              title="Riduzione rumore (afftdn)"
              onClick={() => toggleClipAudioFlag(clip.id, 'denoise')}
            >
              ✧ Riduci rumore
            </button>
            <button
              className={`chip ${clip.voiceDisguise ? 'chip--active' : ''}`}
              title="Maschera voce: abbassa il tono per rendere chi parla irriconoscibile (privacy consulti)"
              onClick={() => toggleClipAudioFlag(clip.id, 'voiceDisguise')}
            >
              🎭 Maschera voce
            </button>
            <button
              className={`chip ${clip.duck ? 'chip--active' : ''}`}
              title="Abbassa questo audio sotto la voce"
              onClick={() => toggleClipAudioFlag(clip.id, 'duck')}
            >
              ⤵ Ducking
            </button>
            <button
              className={`chip ${clip.mutedAudio ? 'chip--active' : ''}`}
              title="Muta l'audio di questa clip"
              onClick={() => toggleClipAudioFlag(clip.id, 'mutedAudio')}
            >
              🔇 Muto
            </button>
            <button className="chip" title="Trova i beat e aggiungi marker" onClick={() => detectBeats(clip.id)}>
              ♩ Trova beat
            </button>
          </div>
        </div>
      )}
      <button className="btn btn--primary" style={{ width: '100%' }} onClick={() => makeStack(clip.id)}>
        ▣ Stack 2 persone (verticale)
      </button>
      <button
        className="btn"
        style={{ width: '100%' }}
        onClick={() => {
          makeBlur(clip.id)
          if (!maskEdit) toggleMaskEdit()
        }}
      >
        ◐ Sfoca una zona (volto/area)
      </button>
      <button
        className="btn"
        style={{ width: '100%' }}
        disabled={!!faceTracking}
        onClick={() => void beginFaceSelect(clip.id)}
      >
        {faceTracking
          ? `Analisi volto… ${faceTracking.done}/${faceTracking.total}`
          : '🙂 Sfoca e segui il volto (auto)'}
      </button>

      <div className="field">
        <div className="section-title">Layout rapido</div>
        <div className="chip-row">
          <button className="chip" onClick={() => updateClip(clip.id, applyLayout('fill'))}>Riempi</button>
          <button className="chip" onClick={() => updateClip(clip.id, applyLayout('top'))}>Metà sup.</button>
          <button className="chip" onClick={() => updateClip(clip.id, applyLayout('bottom'))}>Metà inf.</button>
          <button className="chip" onClick={() => updateClip(clip.id, applyLayout('cropLeft'))}>Sorgente sx</button>
          <button className="chip" onClick={() => updateClip(clip.id, applyLayout('cropRight'))}>Sorgente dx</button>
        </div>
      </div>

      <div className="field">
        <div className="section-title">Posizione sul fotogramma</div>
        <div className="field-row">
          <PercentField label="X" value={t.x} onChange={(v) => setT({ x: v })} />
          <PercentField label="Y" value={t.y} onChange={(v) => setT({ y: v })} />
          <PercentField label="Largh." value={t.w} onChange={(v) => setT({ w: v })} />
          <PercentField label="Alt." value={t.h} onChange={(v) => setT({ h: v })} />
        </div>
        <div className="field-row">
          <PercentField label="Opacità" value={t.opacity} onChange={(v) => setT({ opacity: v })} />
          <NumField label="Rotazione°" value={t.rotation} onChange={(v) => setT({ rotation: v })} />
        </div>
        <div className="field">
          <span className="field-label">Adattamento</span>
          <select className="select" value={t.fit} onChange={(e) => setT({ fit: e.target.value as FitMode })}>
            <option value="cover">Riempi (cover)</option>
            <option value="contain">Contieni (contain)</option>
            <option value="stretch">Distorci (stretch)</option>
          </select>
        </div>
      </div>

      <div className="field">
        <div className="section-title">
          Animazione {animated ? `· ${clip.keyframes!.length} keyframe` : ''}
        </div>
        <div className="chip-row">
          <button
            className={`chip ${animated ? 'chip--active' : ''}`}
            title="Cattura un keyframe della posizione/scala qui (sposta la linea e ripeti per animare)"
            onClick={() => addKeyframe(clip.id)}
          >
            ◆ Aggiungi keyframe
          </button>
          {animated && (
            <button className="chip" title="Rimuovi tutta l'animazione" onClick={() => clearKeyframes(clip.id)}>
              ✕ Azzera
            </button>
          )}
        </div>
        {!animated && (
          <span className="field-label" style={{ textTransform: 'none' }}>
            Sposta la linea, cambia posizione/scala e aggiungi keyframe per animare.
          </span>
        )}
      </div>

      <div className="field">
        <div className="section-title">Chroma key (green screen)</div>
        <button
          className={`btn btn--toggle ${clip.chroma ? 'btn--toggle-on' : ''}`}
          onClick={() => setChroma(clip.id, clip.chroma ? null : {})}
        >
          {clip.chroma ? '◧ Chroma attivo' : '◨ Attiva chroma key'}
        </button>
        {clip.chroma && (
          <div className="field-row" style={{ marginTop: 8 }}>
            <div className="field">
              <span className="field-label">Colore</span>
              <input
                type="color"
                className="input swatch"
                value={clip.chroma.keyColor}
                onChange={(e) => setChroma(clip.id, { keyColor: e.target.value })}
              />
            </div>
            <div className="field">
              <span className="field-label">Tolleranza</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={clip.chroma.similarity}
                onChange={(e) => setChroma(clip.id, { similarity: parseFloat(e.target.value) })}
              />
            </div>
            <div className="field">
              <span className="field-label">Sfuma</span>
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.02}
                value={clip.chroma.blend}
                onChange={(e) => setChroma(clip.id, { blend: parseFloat(e.target.value) })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="field">
        <div className="section-title">Ritaglio sorgente</div>
        <CropBox clip={clip} />
        <div className="field-row" style={{ marginTop: 8 }}>
          <PercentField label="X" value={c.x} onChange={(v) => setC({ x: v })} />
          <PercentField label="Y" value={c.y} onChange={(v) => setC({ y: v })} />
          <PercentField label="Largh." value={c.w} onChange={(v) => setC({ w: v })} />
          <PercentField label="Alt." value={c.h} onChange={(v) => setC({ h: v })} />
        </div>
        <button
          className="btn"
          style={{ width: '100%', marginTop: 6 }}
          onClick={() => setC({ x: 0, y: 0, w: 1, h: 1 })}
        >
          ⤢ Ripristina ritaglio
        </button>
      </div>

      <div className="field">
        <div className="section-title">Sfoca zona / Maschera</div>
        <div className="chip-row">
          <button
            className={`chip ${clip.mask.shape === 'rectangle' ? 'chip--active' : ''}`}
            onClick={() => setMask(clip.id, { shape: 'rectangle' })}
          >
            ▭ Rettangolo
          </button>
          <button
            className={`chip ${clip.mask.shape === 'ellipse' ? 'chip--active' : ''}`}
            onClick={() => setMask(clip.id, { shape: 'ellipse' })}
          >
            ⬭ Cerchio
          </button>
          {clip.mask.shape !== 'none' && (
            <button className="chip" onClick={() => setMask(clip.id, { shape: 'none' })}>
              ✕ Nessuna
            </button>
          )}
        </div>
        {clip.mask.shape !== 'none' && (
          <>
            <button
              className={`btn ${maskEdit ? 'btn--toggle-on' : ''}`}
              style={{ width: '100%' }}
              onClick={toggleMaskEdit}
              title="Trascina il riquadro/cerchio sull'anteprima per spostarlo e ridimensionarlo"
            >
              {maskEdit ? '✎ Modifica zona: ATTIVA' : '✎ Sposta / ridimensiona la zona sull’anteprima'}
            </button>
            <div className="field">
              <span className="field-label">Morbidezza bordi</span>
              <input
                type="range"
                min={0}
                max={0.9}
                step={0.05}
                value={clip.mask.feather}
                onChange={(e) => setMask(clip.id, { feather: parseFloat(e.target.value) })}
              />
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={clip.mask.invert}
                onChange={(e) => setMask(clip.id, { invert: e.target.checked })}
              />
              Inverti (sfoca fuori dalla zona)
            </label>
          </>
        )}
      </div>

      <div className="field">
        <div className="section-title">Modelli reel</div>
        <div className="chip-row">
          {REEL_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              className="chip"
              title={`Applica il modello «${tpl.label}» a TUTTO il reel (colore + transizioni)`}
              onClick={() => applyReelTemplate(tpl.id)}
            >
              {tpl.label}
            </button>
          ))}
        </div>
        <span className="field-label" style={{ opacity: 0.7 }}>
          Stilizza l'intero reel in un click. Annulla con ⌘Z.
        </span>
      </div>

      <div className="field">
        <div className="section-title">
          Filtri
          {selCount > 1 && <span className="multi-hint multi-hint--inline">✦ {selCount} clip</span>}
        </div>
        <div className="chip-row">
          {LOOKS.map((lk) => {
            const active = (clip.look?.id ?? 'none') === lk.id
            return (
              <button
                key={lk.id}
                className={`chip ${active ? 'chip--active' : ''}`}
                title={lk.id === 'none' ? 'Nessun filtro' : `Applica «${lk.label}»`}
                onClick={() => setLook(clip.id, lk.id)}
              >
                {lk.label}
              </button>
            )
          })}
        </div>
        {clip.look && clip.look.id !== 'none' && (
          <div className="field" style={{ marginTop: 6 }}>
            <span className="field-label">Intensità {Math.round((clip.look.intensity ?? 1) * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={clip.look.intensity ?? 1}
              onChange={(e) => setLook(clip.id, clip.look?.id ?? null, parseFloat(e.target.value))}
            />
          </div>
        )}
      </div>

      <div className="field">
        <div className="section-title">
          Effetti
          {selCount > 1 && <span className="multi-hint multi-hint--inline">✦ {selCount} clip</span>}
        </div>
        <div className="chip-row">
          {EFFECT_TYPES.map((type) => {
            const existing = clip.effects.find((e) => e.type === type)
            return (
              <button
                key={type}
                className={`chip ${existing ? 'chip--active' : ''}`}
                title={existing ? 'Attivo — clicca per rimuovere' : 'Clicca per applicare'}
                onClick={() => (existing ? removeEffect(clip.id, existing.id) : addEffect(clip.id, type))}
              >
                {existing ? '● ' : '+ '}
                {(EFFECT_DEFS[type] ?? FALLBACK_DEF).label}
              </button>
            )
          })}
        </div>
        {clip.effects.map((fx) => (
          <EffectControl
            key={fx.id}
            fx={fx}
            onChange={(params) => updateEffect(clip.id, fx.id, params)}
            onRemove={() => removeEffect(clip.id, fx.id)}
          />
        ))}
      </div>

      <div className="field">
        <div className="section-title">Dissolvenze & audio</div>
        <div className="field-row">
          <NumField
            label="Fade in (s)"
            value={clip.fadeInSec}
            step={0.1}
            active={clip.fadeInSec > 0}
            onChange={(v) => setFade(clip.id, 'in', v)}
          />
          <NumField
            label="Fade out (s)"
            value={clip.fadeOutSec}
            step={0.1}
            active={clip.fadeOutSec > 0}
            onChange={(v) => setFade(clip.id, 'out', v)}
          />
        </div>
        <div className={`field ${clip.volume !== 1 ? 'field--active' : ''}`}>
          <span className="field-label">Volume {Math.round(clip.volume * 100)}%</span>
          <div className="field-row" style={{ alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min={0}
              max={4}
              step={0.05}
              value={clip.volume}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
              onChange={(e) => updateClip(clip.id, (cl) => void (cl.volume = parseFloat(e.target.value)))}
            />
            <input
              className="input"
              type="number"
              style={{ width: 62 }}
              min={0}
              max={400}
              step={5}
              value={Math.round(clip.volume * 100)}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!Number.isNaN(v)) updateClip(clip.id, (cl) => void (cl.volume = Math.max(0, Math.min(4, v / 100))))
              }}
            />
          </div>
        </div>
      </div>

      <button className="btn" style={{ color: 'var(--danger)' }} onClick={() => removeClip(clip.id)}>
        Elimina clip
      </button>
    </div>
  )
}

function EffectControl({
  fx,
  onChange,
  onRemove
}: {
  fx: Effect
  onChange: (params: Record<string, number>) => void
  onRemove: () => void
}): JSX.Element {
  const def = EFFECT_DEFS[fx.type] ?? FALLBACK_DEF
  const value = fx.params[def.param] ?? 0
  return (
    <div className="field" style={{ background: 'var(--bg-1)', padding: 8, borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="field-label">{def.label}</span>
        <button className="iconbtn track-iconbtn" title="Rimuovi effetto" onClick={onRemove}>
          ✕
        </button>
      </div>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => onChange({ [def.param]: parseFloat(e.target.value) })}
      />
    </div>
  )
}

const TEXT_EFFECTS: { id: TextEffect; label: string }[] = [
  { id: 'none', label: 'Nessuno' },
  { id: 'shadow', label: 'Ombra' },
  { id: 'lift', label: 'Rialzo' },
  { id: 'hollow', label: 'Cavo' },
  { id: 'outline', label: 'Contorno' },
  { id: 'splice', label: 'Splice' },
  { id: 'echo', label: 'Eco' },
  { id: 'glow', label: 'Bagliore' },
  { id: 'neon', label: 'Neon' }
]
const TEXT_ANIMS: { id: TextAnim; label: string }[] = [
  { id: 'none', label: 'Nessuna' },
  { id: 'fade', label: 'Dissolvenza' },
  { id: 'pop', label: 'Pop' },
  { id: 'rise', label: 'Salita' },
  { id: 'slide', label: 'Scorri' },
  { id: 'typewriter', label: 'Macchina' }
]
const EFFECT_HAS_COLOR = new Set<TextEffect>(['shadow', 'outline', 'splice', 'echo', 'glow', 'neon'])

function TextInspector({ clip }: { clip: TextClip }): JSX.Element {
  const updateTextClip = useEditor((s) => s.updateTextClip)
  const removeClip = useEditor((s) => s.rippleDelete) // default delete = close the gap (CapCut)
  const st = clip.style
  const set = (recipe: (c: TextClip) => void): void => updateTextClip(clip.id, recipe)

  return (
    <div className="inspector text-inspector">
      <textarea
        className="input text-input"
        style={{ height: 64, padding: 8, resize: 'vertical' }}
        value={clip.text}
        onChange={(e) => set((c) => void (c.text = e.target.value))}
      />

      {/* Font + size */}
      <div className="field-row">
        <div className="field" style={{ flex: 2 }}>
          <span className="field-label">Font</span>
          <select
            className="select"
            value={st.fontFamily}
            onChange={(e) => set((c) => void (c.style.fontFamily = e.target.value))}
          >
            {FONTS.map((f) => (
              <option key={f.label} value={f.css} style={{ fontFamily: f.css }}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <span className="field-label">Dim. {Math.round(st.fontSizeFrac * 100)}</span>
          <input
            type="range"
            min={0.02}
            max={0.22}
            step={0.005}
            value={st.fontSizeFrac}
            onChange={(e) => set((c) => void (c.style.fontSizeFrac = parseFloat(e.target.value)))}
          />
        </div>
      </div>

      {/* B / I / U + alignment */}
      <div className="seg-row">
        <button className={`seg-btn ${st.bold ? 'seg-on' : ''}`} style={{ fontWeight: 800 }} title="Grassetto" onClick={() => set((c) => void (c.style.bold = !c.style.bold))}>
          G
        </button>
        <button className={`seg-btn ${st.italic ? 'seg-on' : ''}`} style={{ fontStyle: 'italic' }} title="Corsivo" onClick={() => set((c) => void (c.style.italic = !c.style.italic))}>
          C
        </button>
        <button className={`seg-btn ${st.underline ? 'seg-on' : ''}`} style={{ textDecoration: 'underline' }} title="Sottolineato" onClick={() => set((c) => void (c.style.underline = !c.style.underline))}>
          S
        </button>
        <span className="seg-gap" />
        {(['left', 'center', 'right'] as const).map((a) => (
          <button
            key={a}
            className={`seg-btn ${st.align === a ? 'seg-on' : ''}`}
            title={a === 'left' ? 'Sinistra' : a === 'center' ? 'Centro' : 'Destra'}
            onClick={() => set((c) => void (c.style.align = a))}
          >
            {a === 'left' ? '⯇' : a === 'center' ? '≡' : '⯈'}
          </button>
        ))}
      </div>

      {/* Colour + opacity */}
      <div className="field-row">
        <div className="field">
          <span className="field-label">Colore testo</span>
          <input type="color" className="input swatch" value={st.color} onChange={(e) => set((c) => void (c.style.color = e.target.value))} />
        </div>
        <div className="field" style={{ flex: 2 }}>
          <span className="field-label">Opacità {Math.round(st.opacity * 100)}%</span>
          <input type="range" min={0} max={1} step={0.02} value={st.opacity} onChange={(e) => set((c) => void (c.style.opacity = parseFloat(e.target.value)))} />
        </div>
      </div>

      {/* Effects */}
      <div className="section-title">Effetti</div>
      <div className="chip-row">
        {TEXT_EFFECTS.map((fx) => (
          <button
            key={fx.id}
            className={`chip ${st.effect === fx.id ? 'chip--active' : ''}`}
            onClick={() => set((c) => void (c.style.effect = fx.id))}
          >
            {fx.label}
          </button>
        ))}
      </div>
      {EFFECT_HAS_COLOR.has(st.effect) && (
        <div className="field-row">
          <div className="field">
            <span className="field-label">Colore effetto</span>
            <input type="color" className="input swatch" value={st.effectColor} onChange={(e) => set((c) => void (c.style.effectColor = e.target.value))} />
          </div>
          <div className="field" style={{ flex: 2 }}>
            <span className="field-label">Intensità</span>
            <input type="range" min={0} max={1} step={0.05} value={st.effectIntensity} onChange={(e) => set((c) => void (c.style.effectIntensity = parseFloat(e.target.value)))} />
          </div>
        </div>
      )}

      {/* Highlight / background */}
      <div className="section-title">Evidenziatore</div>
      <button
        className={`btn btn--toggle ${st.highlight ? 'btn--toggle-on' : ''}`}
        onClick={() => set((c) => void (c.style.highlight = !c.style.highlight))}
      >
        {st.highlight ? '◼ Sfondo attivo' : '◻ Aggiungi sfondo'}
      </button>
      {st.highlight && (
        <div className="field-row">
          <div className="field">
            <span className="field-label">Colore</span>
            <input type="color" className="input swatch" value={st.highlightColor} onChange={(e) => set((c) => void (c.style.highlightColor = e.target.value))} />
          </div>
          <div className="field">
            <span className="field-label">Opacità</span>
            <input type="range" min={0} max={1} step={0.05} value={st.highlightOpacity} onChange={(e) => set((c) => void (c.style.highlightOpacity = parseFloat(e.target.value)))} />
          </div>
          <div className="field">
            <span className="field-label">Angoli</span>
            <input type="range" min={0} max={0.5} step={0.02} value={st.highlightRadiusFrac} onChange={(e) => set((c) => void (c.style.highlightRadiusFrac = parseFloat(e.target.value)))} />
          </div>
        </div>
      )}

      {/* Spacing */}
      <div className="section-title">Spaziatura</div>
      <div className="field-row">
        <div className="field">
          <span className="field-label">Lettere</span>
          <input type="range" min={-0.01} max={0.12} step={0.005} value={st.letterSpacingFrac} onChange={(e) => set((c) => void (c.style.letterSpacingFrac = parseFloat(e.target.value)))} />
        </div>
        <div className="field">
          <span className="field-label">Interlinea</span>
          <input type="range" min={0.8} max={2.4} step={0.05} value={st.lineHeightMul} onChange={(e) => set((c) => void (c.style.lineHeightMul = parseFloat(e.target.value)))} />
        </div>
      </div>

      {/* Position */}
      <div className="section-title">Posizione</div>
      <div className="field-row">
        <div className="field">
          <span className="field-label">Orizzontale</span>
          <input type="range" min={0} max={1} step={0.01} value={st.posX} onChange={(e) => set((c) => void (c.style.posX = parseFloat(e.target.value)))} />
        </div>
        <div className="field">
          <span className="field-label">Verticale</span>
          <input type="range" min={0} max={1} step={0.01} value={st.posY} onChange={(e) => set((c) => void (c.style.posY = parseFloat(e.target.value)))} />
        </div>
      </div>

      {/* Animation */}
      <div className="section-title">Animazione — entrata</div>
      <div className="chip-row">
        {TEXT_ANIMS.map((an) => (
          <button key={an.id} className={`chip ${st.animIn === an.id ? 'chip--active' : ''}`} onClick={() => set((c) => void (c.style.animIn = an.id))}>
            {an.label}
          </button>
        ))}
      </div>
      <div className="section-title">Animazione — uscita</div>
      <div className="chip-row">
        {TEXT_ANIMS.map((an) => (
          <button key={an.id} className={`chip ${st.animOut === an.id ? 'chip--active' : ''}`} onClick={() => set((c) => void (c.style.animOut = an.id))}>
            {an.label}
          </button>
        ))}
      </div>
      {(st.animIn !== 'none' || st.animOut !== 'none') && (
        <div className="field">
          <span className="field-label">Durata animazione {st.animDurSec.toFixed(1)}s</span>
          <input type="range" min={0.1} max={2} step={0.1} value={st.animDurSec} onChange={(e) => set((c) => void (c.style.animDurSec = parseFloat(e.target.value)))} />
        </div>
      )}

      <button className="btn" style={{ color: 'var(--danger)', marginTop: 10 }} onClick={() => removeClip(clip.id)}>
        Elimina testo
      </button>
    </div>
  )
}

function PercentField({
  label,
  value,
  onChange
}: {
  label: string
  value: number
  onChange: (v: number) => void
}): JSX.Element {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <input
        className="input"
        type="number"
        value={Math.round(value * 1000) / 10}
        step={1}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!Number.isNaN(v)) onChange(v / 100)
        }}
      />
    </div>
  )
}

function NumField({
  label,
  value,
  step = 1,
  active = false,
  onChange
}: {
  label: string
  value: number
  step?: number
  active?: boolean
  onChange: (v: number) => void
}): JSX.Element {
  return (
    <div className={`field ${active ? 'field--active' : ''}`}>
      <span className="field-label">{label}</span>
      <input
        className="input"
        type="number"
        value={value}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!Number.isNaN(v)) onChange(v)
        }}
      />
    </div>
  )
}
