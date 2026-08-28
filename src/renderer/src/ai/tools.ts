import type Anthropic from '@anthropic-ai/sdk'
import { useEditor, locateClip } from '../state/store'
import { detectFacesAt, detectContentBounds, type NormFace } from '../preview/faceDetect'
import { mediaUrl } from '@shared/media'
import type {
  AspectPreset,
  CropRect,
  EffectType,
  MediaClip,
  PostMeta,
  Source,
  TextStyle,
  TransitionPreset
} from '@shared/projectSchema'
import { LOOKS } from '@shared/looks'

/**
 * The tool surface the in-app AI drives to build a reel. Each handler reads/writes the
 * real editor via `useEditor.getState()`, validates inputs, and returns a small JSON-able
 * result (or `{ error }`) so the model self-corrects instead of the app throwing.
 */

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'set_format',
    description:
      "Imposta il formato (aspect ratio) del canvas. Per i reel social usa '9:16'. Primo passo tipico.",
    input_schema: {
      type: 'object',
      properties: { aspect: { type: 'string', enum: ['9:16', '1:1', '4:5', '16:9'] } },
      required: ['aspect']
    }
  },
  {
    name: 'list_sources',
    description:
      'Elenca i media importati (id, nome file, larghezza, altezza, durata in s, audio, orizzontale). Mappa gli alias del brief (es. src_main) al sourceId reale tramite il nome file.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'get_timeline_state',
    description:
      'Stato attuale della timeline: tracce e clip (clipId, sourceId, tempi reel, tagli sorgente, fit), durata totale, formato. Per verificare o capire se la timeline è già occupata.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'start_fresh',
    description:
      "Svuota la timeline (mantenendo i media). SOLO dopo conferma con ask_user se contiene già clip.",
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'add_segment',
    description:
      'Aggiunge un segmento da una sorgente, ACCODANDOLO sulla traccia video principale. sourceIn/sourceOut = tempi nel SORGENTE (secondi). Una chiamata per segmento, nell\'ordine del brief. Ritorna il clipId.',
    input_schema: {
      type: 'object',
      properties: {
        sourceId: { type: 'string' },
        sourceIn: { type: 'number' },
        sourceOut: { type: 'number' }
      },
      required: ['sourceId', 'sourceIn', 'sourceOut']
    }
  },
  {
    name: 'detect_people',
    description:
      'Rileva quante persone (volti) ci sono in una clip e dove, per decidere il layout verticale. Ritorna count + posizioni normalizzate 0..1. Campiona il punto medio della clip (o timeSec sorgente).',
    input_schema: {
      type: 'object',
      properties: { clipId: { type: 'string' }, timeSec: { type: 'number', description: 'tempo sorgente, opzionale' } },
      required: ['clipId']
    }
  },
  {
    name: 'reframe_vertical',
    description:
      "Reframe orizzontale→verticale di una clip. mode: 'center-face' (zoom 9:16 centrato sul volto), 'two-person-stack' (due persone impilate), 'fit-contain' (intero frame con barre), 'manual-crop' (cropRect 0..1), 'auto' (decide dai volti: 0→contain, 1→center, 2→stack, >2→center sul principale). Per >2 persone, preferisci prima detect_people + ask_user.",
    input_schema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        mode: { type: 'string', enum: ['center-face', 'two-person-stack', 'fit-contain', 'manual-crop', 'auto'] },
        faceIndex: { type: 'number', description: 'quale volto centrare (0 = più grande)' },
        blur: {
          type: 'string',
          enum: ['none', 'top', 'bottom', 'both'],
          description: "SOLO per two-person-stack: oscura la persona in alto (sinistra) o in basso (destra). Sfoca il suo riquadro INTERO (rettangolo a copertura piena, non il solo volto) col blur al MASSIMO: dev'essere irriconoscibile. Usa dopo conferma utente."
        },
        cropRect: {
          type: 'object',
          description: 'per manual-crop, frazioni 0..1 del sorgente',
          properties: { x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } }
        }
      },
      required: ['clipId', 'mode']
    }
  },
  {
    name: 'blur_person',
    description:
      "Sfoca una persona (volto, con tracking nel tempo) o una REGIONE fissa. CHIAMA SOLO dopo conferma dell'utente con ask_user. Con faceIndex sfoca quel volto. Con region {x,y,w,h} (0..1, canvas) sfoca un'area: di DEFAULT copre il RIQUADRO INTERO con maschera RETTANGOLARE + blur FORTE (sigma 48), ideale per oscurare un tile Zoom (es. persona a sinistra = {x:0,y:0,w:0.5,h:1}; in alto = {x:0,y:0,w:1,h:0.5}). shape:'ellipse' per un ovale morbido; strength 8..80 regola il blur (default 48 = massimo).",
    input_schema: {
      type: 'object',
      properties: {
        clipId: { type: 'string' },
        faceIndex: { type: 'number' },
        region: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } }
        },
        shape: { type: 'string', enum: ['rectangle', 'ellipse'], description: "forma maschera per region: 'rectangle' (default, copre tutto il tile) o 'ellipse'" },
        strength: { type: 'number', description: 'forza del blur per region (sigma 8..80; default 48 = massimo)' }
      },
      required: ['clipId']
    }
  },
  {
    name: 'add_caption',
    description:
      "Aggiunge una caption/titolo a schermo, con tempi riferiti al REEL (0 = inizio). style: 'caption' (sottotitolo, default) o 'title' (titolo grande dell'hook, in alto).",
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        startSec: { type: 'number' },
        endSec: { type: 'number' },
        style: { type: 'string', enum: ['caption', 'title'] }
      },
      required: ['text', 'startSec', 'endSec']
    }
  },
  {
    name: 'add_captions_bulk',
    description: 'Aggiunge molte captions a parlato in una volta. segments: [{start,end,text}] con tempi sul REEL.',
    input_schema: {
      type: 'object',
      properties: {
        segments: {
          type: 'array',
          items: {
            type: 'object',
            properties: { start: { type: 'number' }, end: { type: 'number' }, text: { type: 'string' } },
            required: ['start', 'end', 'text']
          }
        }
      },
      required: ['segments']
    }
  },
  {
    name: 'add_transition',
    description:
      "Transizione tra una clip e la successiva. preset: fade (default), wipeleft/right/up/down, slideleft/right/up/down, zoomin, circleopen, dissolve. durSec ~0.3-0.6.",
    input_schema: {
      type: 'object',
      properties: { clipId: { type: 'string' }, preset: { type: 'string' }, durSec: { type: 'number' } },
      required: ['clipId']
    }
  },
  {
    name: 'set_speed',
    description: 'Cambia la velocità di una clip (0.1–10×). Rallenta/accelera; ricalcola la durata sul reel.',
    input_schema: { type: 'object', properties: { clipId: { type: 'string' }, speed: { type: 'number' } }, required: ['clipId', 'speed'] }
  },
  {
    name: 'set_fade',
    description: "Dissolvenza a inizio/fine clip. edge: 'in' | 'out'; sec: durata.",
    input_schema: {
      type: 'object',
      properties: { clipId: { type: 'string' }, edge: { type: 'string', enum: ['in', 'out'] }, sec: { type: 'number' } },
      required: ['clipId', 'edge', 'sec']
    }
  },
  {
    name: 'set_volume',
    description: 'Imposta il volume lineare di una clip (1 = invariato, 0 = muto).',
    input_schema: { type: 'object', properties: { clipId: { type: 'string' }, volume: { type: 'number' } }, required: ['clipId', 'volume'] }
  },
  {
    name: 'mute_clip',
    description: "Muta o smuta l'audio di una clip (per la continuità audio quando ricuci segmenti).",
    input_schema: { type: 'object', properties: { clipId: { type: 'string' }, muted: { type: 'boolean' } }, required: ['clipId'] }
  },
  {
    name: 'trim_clip',
    description: "Rifinisce un bordo della clip. edge: 'start' | 'end'; deltaSec: positivo allunga, negativo accorcia.",
    input_schema: {
      type: 'object',
      properties: { clipId: { type: 'string' }, edge: { type: 'string', enum: ['start', 'end'] }, deltaSec: { type: 'number' } },
      required: ['clipId', 'edge', 'deltaSec']
    }
  },
  {
    name: 'set_look',
    description:
      "Applica un FILTRO colore con nome alla clip (look one-click stile CapCut/Canva; vale in anteprima ED export). look: none | vivid (Vivido) | cinema (Cinema) | warm (Caldo) | cool (Freddo) | bw (Bianco e nero) | noir | vintage | fade (Sbiadito) | punch | pastel (Pastello) | sunset (Tramonto) | teal (Teal & Orange) | dreamy (Sognante) | mono-blue (Blu notte) | matte | film | gold (Golden hour) | moody | cyber | autumn (Autunno) | frost | crisp (Nitido). intensity 0..1 (default 1). È il modo consigliato per dare un colore d'insieme.",
    input_schema: {
      type: 'object',
      properties: { clipId: { type: 'string' }, look: { type: 'string' }, intensity: { type: 'number' } },
      required: ['clipId', 'look']
    }
  },
  {
    name: 'set_filter',
    description:
      "Regolazione FINE di un singolo parametro colore della clip (si somma al look; vale in anteprima ED export). type: brightness|contrast|saturation (value = delta: 0 invariato, +0.2 = +20%, range ~ -1..1) · hue (value = gradi, -180..180) · sepia|grayscale|invert|sharpen|vignette|grain (value 0..1). Per un colore d'insieme usa set_look.",
    input_schema: {
      type: 'object',
      properties: { clipId: { type: 'string' }, type: { type: 'string' }, value: { type: 'number' } },
      required: ['clipId', 'type', 'value']
    }
  },
  {
    name: 'ask_user',
    description:
      'Fai UNA domanda all\'utente e attendi la risposta. Per scelte che spettano a lui: confermare di svuotare la timeline, sfocare una persona, layout con >2 persone, ambiguità. Fornisci opzioni rapide quando ha senso.',
    input_schema: {
      type: 'object',
      properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } },
      required: ['question']
    }
  },
  {
    name: 'set_post_meta',
    description:
      "Salva NEL PROGETTO la copy social del reel (NON la scrive sul video): titolo, descrizione del post, hashtag, primo commento e i 5 hook. Resta salvata col progetto, così riaprendo il reel l'utente la rilegge/copia nella scheda «Social». Prendi questi testi dal «Reel Build Brief» (sezioni Descrizione, Primo commento, Hook). Chiamabile ANCHE da solo (senza segmenti/tagli), per aggiornare solo titolo/descrizione/commento di un progetto già montato senza toccare la timeline. Chiamalo una sola volta, prima di finish.",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titolo del post/reel (breve, per riferimento e riconoscimento del progetto)' },
        description: { type: 'string', description: 'Descrizione/didascalia del post' },
        hashtags: { type: 'string', description: 'Riga di hashtag, es. "#ElisaSoulMedium #medium"' },
        firstComment: { type: 'string', description: 'Il primo commento da fissare (lunghezza libera)' },
        hooks: { type: 'array', items: { type: 'string' }, description: 'I 5 hook tra cui scegliere' },
        extraDescription: { type: 'string', description: 'Descrizione extra FISSA (promo libro di Elisa) sotto ogni video' },
        notes: { type: 'string', description: 'Note libere opzionali' }
      }
    }
  },
  {
    name: 'finish',
    description: 'Concludi: breve riepilogo in italiano (segmenti, durata, formato, reframe/captions applicati).',
    input_schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] }
  }
]

export interface ToolContext {
  askUser: (question: string, options?: string[]) => Promise<string>
}

// ---- input + math helpers ----
function asString(v: unknown, name: string): string {
  if (typeof v !== 'string' || !v) throw new Error(`Parametro "${name}" mancante o non valido`)
  return v
}
function asNumber(v: unknown, name: string): number {
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (typeof n !== 'number' || !isFinite(n)) throw new Error(`Parametro "${name}" deve essere un numero`)
  return n
}
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
const round2 = (n: number): number => Math.round(n * 100) / 100

const CAPTION_STYLE: Partial<TextStyle> = { fontSizeFrac: 0.055, posY: 0.62, bold: true, effect: 'shadow' }
const TITLE_STYLE: Partial<TextStyle> = { fontSizeFrac: 0.095, posY: 0.16, bold: true, effect: 'shadow' }

function clipAndSource(clipId: string): { clip: MediaClip; src: Source } | null {
  const p = useEditor.getState().project
  const loc = locateClip(p, clipId)
  if (!loc || loc.clip.kind !== 'media') return null
  const clip = loc.clip as MediaClip
  const src = p.sources.find((s) => s.id === clip.sourceId)
  return src ? { clip, src } : null
}

const midSourceTime = (clip: MediaClip): number => clip.sourceIn + (clip.sourceOut - clip.sourceIn) / 2
const faceUrl = (src: Source): string => mediaUrl(src.proxyPath ?? src.path)

/** A source-normalized crop of aspect `targetAR` (w/h), sized to and centered on a
 *  face. Sizing to the face (head+shoulders) keeps the crop INSIDE the real content,
 *  so it naturally avoids letterbox/black bars instead of swallowing them. */
function cropForFace(face: NormFace, sw: number, sh: number, targetAR: number, faceFill = 0.4): CropRect {
  const faceHpx = Math.max(face.h * sh, 0.08 * sh)
  let cropHpx = clamp(faceHpx / faceFill, 0.25 * sh, sh) // frame head+shoulders
  let cropWpx = cropHpx * targetAR
  if (cropWpx > sw) {
    cropWpx = sw
    cropHpx = sw / targetAR
  }
  const cw = cropWpx / sw
  const ch = cropHpx / sh
  const x = clamp(face.cx - cw / 2, 0, 1 - cw)
  const y = clamp(face.cy - ch / 2, 0, 1 - ch)
  return { x, y, w: cw, h: ch }
}

const clampN = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** Geometric two-person stack: split the content (black bars removed) into left/right
 *  tiles, crop each to the destination half's aspect, and stack them (left→top,
 *  right→bottom). Robust to hands-on-face — it does NOT need a face to be detected;
 *  detected faces only refine the horizontal centering. */
function twoPersonStackGeom(
  clipId: string,
  sw: number,
  sh: number,
  canvasW: number,
  canvasH: number,
  faces: NormFace[],
  bounds: { top: number; bottom: number; left: number; right: number }
): { topId: string; bottomId: string | null } {
  const ed = useEditor.getState()
  ed.makeTwoPersonStack(clipId) // builds top (clipId) + bottom (selected); we set the crops below
  const bottomId = useEditor.getState().selectedClipId
  const halfAR = canvasW / (canvasH / 2) // each half = full-width × half-height
  const bandTop = bounds.top * sh
  const bandH = (bounds.bottom - bounds.top) * sh
  const leftPx = bounds.left * sw
  const rightPx = bounds.right * sw
  const midPx = (leftPx + rightPx) / 2
  const midNorm = (bounds.left + bounds.right) / 2
  const tileCrop = (x0: number, x1: number, faceCx: number | null): CropRect => {
    let chPx = bandH
    let cwPx = chPx * halfAR
    const tileW = x1 - x0
    if (cwPx > tileW) {
      cwPx = tileW
      chPx = cwPx / halfAR
    }
    const cxPx = faceCx != null ? faceCx * sw : (x0 + x1) / 2
    const xPx = clampN(cxPx - cwPx / 2, x0, x1 - cwPx)
    const yPx = clampN(bandTop + bandH / 2 - chPx / 2, bandTop, bandTop + bandH - chPx)
    return { x: xPx / sw, y: yPx / sh, w: cwPx / sw, h: chPx / sh }
  }
  const leftFace = faces.find((f) => f.cx < midNorm)
  const rightFace = faces.find((f) => f.cx >= midNorm)
  ed.updateClip(clipId, (c) => {
    c.crop = tileCrop(leftPx, midPx, leftFace ? leftFace.cx : null)
  })
  if (bottomId && bottomId !== clipId) {
    ed.updateClip(bottomId, (c) => {
      c.crop = tileCrop(midPx, rightPx, rightFace ? rightFace.cx : null)
    })
  }
  return { topId: clipId, bottomId }
}

/** Privacy blur for one half of a stack.
 *  REGOLA (Andrea): si oscura la persona INTERAMENTE — tutto il suo riquadro, non solo il
 *  volto — e col blur al MASSIMO, così non si riconosce praticamente niente. Quindi:
 *  maschera RETTANGOLARE a copertura piena della sua metà + sigma max. Niente ellissi sulla
 *  faccia (lasciavano scoperti corpo, vestiti e sfondo) e niente tracking per-frame. */
function blurStackHalf(clipId: string, isBottom: boolean): void {
  const ed = useEditor.getState()
  ed.makeBlurRegion(clipId) // dup on a new track + gaussian blur
  const blurId = useEditor.getState().selectedClipId
  if (!blurId) return
  // Coordinate CANVAS: metà alta (sinistra) o metà bassa (destra). Sconfino un filo oltre la
  // giunzione e uso un feather minimo, così non resta alcun bordo nitido.
  ed.setMask(blurId, {
    shape: 'rectangle',
    x: 0,
    y: isBottom ? 0.49 : 0,
    w: 1,
    h: 0.51,
    feather: 0.02,
    invert: false
  })
  // Blur al massimo consentito (sigma 8..80): il riquadro dev'essere irriconoscibile.
  ed.updateClip(blurId, (c) => {
    const fx = (c as MediaClip).effects.find((e) => e.type === 'gblur')
    if (fx) fx.params.sigma = 80
  })
}

function setContain(clipId: string): void {
  useEditor.getState().updateClip(clipId, (c) => {
    c.crop = { x: 0, y: 0, w: 1, h: 1 }
    c.transform = { ...c.transform, x: 0, y: 0, w: 1, h: 1, fit: 'contain' }
  })
}
function setCenteredCrop(clipId: string, crop: CropRect): void {
  useEditor.getState().updateClip(clipId, (c) => {
    c.crop = crop
    c.transform = { ...c.transform, x: 0, y: 0, w: 1, h: 1, fit: 'cover' }
  })
}

/** A centered fill crop (used when no face is found): never letterbox a person. */
function centerFillCrop(sw: number, sh: number, targetAR: number): CropRect {
  return cropForFace({ cx: 0.5, cy: 0.42, w: 0, h: 0 }, sw, sh, targetAR)
}

function addBoundedText(text: string, start: number, end: number, style: Partial<TextStyle>): void {
  const ed = useEditor.getState()
  ed.setPlayhead(Math.max(0, start))
  ed.addTextClip(text, style)
  const id = useEditor.getState().selectedClipId
  if (id) {
    useEditor.getState().updateTextClip(id, (c) => {
      c.timelineStart = Math.max(0, start)
      c.timelineEnd = Math.max(start + 0.3, end)
    })
  }
}

async function detectAt(clip: MediaClip, src: Source, timeSec?: number): Promise<NormFace[]> {
  const t = clamp(typeof timeSec === 'number' ? timeSec : midSourceTime(clip), clip.sourceIn, clip.sourceOut)
  try {
    return await detectFacesAt(faceUrl(src), t)
  } catch {
    return []
  }
}

/** Dispatch a tool call to its handler. Returns `{ error }` on bad input/state. */
export async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const ed = useEditor.getState()

  switch (name) {
    case 'set_format': {
      const aspect = asString(input.aspect, 'aspect') as AspectPreset
      if (!['9:16', '1:1', '4:5', '16:9'].includes(aspect)) return { error: `aspect non valido: ${aspect}` }
      ed.setAspect(aspect)
      return { ok: true, aspect }
    }

    case 'list_sources':
      return {
        sources: ed.project.sources.map((s) => ({
          sourceId: s.id,
          fileName: s.fileName,
          kind: s.kind,
          width: s.width,
          height: s.height,
          durationSec: round2(s.durationSec),
          hasAudio: s.hasAudio,
          horizontal: s.width >= s.height
        }))
      }

    case 'get_timeline_state': {
      const p = useEditor.getState().project
      const tracks = p.timeline.tracks.map((t) => ({
        trackId: t.id,
        type: t.type,
        clips: t.clips.map((c) =>
          c.kind === 'media'
            ? {
                clipId: c.id,
                kind: c.kind,
                sourceId: c.sourceId,
                timelineStart: round2(c.timelineStart),
                timelineEnd: round2(c.timelineEnd),
                sourceIn: round2(c.sourceIn),
                sourceOut: round2(c.sourceOut),
                fit: c.transform.fit
              }
            : { clipId: c.id, kind: c.kind, timelineStart: round2(c.timelineStart), timelineEnd: round2(c.timelineEnd), text: c.text }
        )
      }))
      const dur = Math.max(0, ...p.timeline.tracks.flatMap((t) => t.clips.map((c) => c.timelineEnd)))
      return { aspect: `${p.canvas.width}x${p.canvas.height}`, timelineDuration: round2(dur), tracks }
    }

    case 'start_fresh':
      ed.newProject()
      return { ok: true }

    case 'add_segment': {
      const sourceId = asString(input.sourceId, 'sourceId')
      let sourceIn = asNumber(input.sourceIn, 'sourceIn')
      let sourceOut = asNumber(input.sourceOut, 'sourceOut')
      const src = ed.project.sources.find((s) => s.id === sourceId)
      if (!src) return { error: `sorgente ${sourceId} non trovata; chiama list_sources` }
      const dur = src.durationSec > 0 ? src.durationSec : 5
      sourceIn = clamp(sourceIn, 0, dur)
      sourceOut = clamp(sourceOut, sourceIn + 0.05, dur)
      let track = ed.project.timeline.tracks.find((t) => t.type === 'video')
      if (!track) {
        ed.addTrack('video')
        track = useEditor.getState().project.timeline.tracks.find((t) => t.type === 'video')
      }
      if (!track) return { error: 'impossibile creare la traccia video' }
      const trackId = track.id
      const startSec = track.clips.reduce((m, c) => Math.max(m, c.timelineEnd), 0)
      ed.addSourceToTrackAt(sourceId, trackId, startSec)
      const clipId = useEditor.getState().selectedClipId
      if (!clipId) return { error: 'aggiunta clip non riuscita' }
      useEditor.getState().updateClip(clipId, (c) => {
        c.sourceIn = sourceIn
        c.sourceOut = sourceOut
        c.timelineEnd = c.timelineStart + (sourceOut - sourceIn)
      })
      return { ok: true, clipId, timelineStart: round2(startSec), durationSec: round2(sourceOut - sourceIn) }
    }

    case 'detect_people': {
      const clipId = asString(input.clipId, 'clipId')
      const cs = clipAndSource(clipId)
      if (!cs) return { error: `clip ${clipId} non trovata o senza sorgente` }
      const faces = await detectAt(cs.clip, cs.src, typeof input.timeSec === 'number' ? (input.timeSec as number) : undefined)
      return {
        count: faces.length,
        faces: faces.map((f, i) => ({ index: i, cx: round2(f.cx), cy: round2(f.cy), w: round2(f.w), h: round2(f.h) }))
      }
    }

    case 'reframe_vertical': {
      const clipId = asString(input.clipId, 'clipId')
      const mode = asString(input.mode, 'mode')
      const cs = clipAndSource(clipId)
      if (!cs) return { error: `clip ${clipId} non trovata o senza sorgente` }
      const canvas = useEditor.getState().project.canvas
      const sw = cs.src.width
      const sh = cs.src.height
      const fullAR = canvas.width / canvas.height

      if (mode === 'fit-contain') {
        setContain(clipId)
        return { ok: true, mode }
      }
      if (mode === 'manual-crop') {
        const cr = input.cropRect as Partial<CropRect> | undefined
        if (!cr || typeof cr.x !== 'number' || typeof cr.y !== 'number' || typeof cr.w !== 'number' || typeof cr.h !== 'number')
          return { error: 'manual-crop richiede cropRect {x,y,w,h} (0..1)' }
        setCenteredCrop(clipId, { x: clamp(cr.x, 0, 1), y: clamp(cr.y, 0, 1), w: clamp(cr.w, 0.05, 1), h: clamp(cr.h, 0.05, 1) })
        return { ok: true, mode }
      }

      // two-person-stack / center-face / active-speaker / auto → detect faces first
      const faces = await detectAt(cs.clip, cs.src)
      let eff = mode
      // auto NEVER letterboxes: a reel must FILL the 9:16. 2+ faces → stack; else → fill on the face.
      if (mode === 'auto') eff = faces.length >= 2 ? 'two-person-stack' : 'center-face'

      if (eff === 'fit-contain') {
        // explicit letterbox only — rare (group shot with no clear subject)
        setContain(clipId)
        return { ok: true, mode: 'fit-contain', faces: faces.length }
      }
      if (eff === 'two-person-stack') {
        // Always split into two tiles (left→top, right→bottom). Works even with hands
        // on faces; detected faces only refine centering; black bars are cropped out.
        let bounds = { top: 0, bottom: 1, left: 0, right: 1 }
        try {
          bounds = await detectContentBounds(faceUrl(cs.src), midSourceTime(cs.clip))
        } catch {
          /* full frame */
        }
        const { topId, bottomId } = twoPersonStackGeom(clipId, sw, sh, canvas.width, canvas.height, faces, bounds)
        const stackBlur = typeof input.blur === 'string' ? input.blur : 'none'
        if ((stackBlur === 'bottom' || stackBlur === 'both') && bottomId) blurStackHalf(bottomId, true)
        if (stackBlur === 'top' || stackBlur === 'both') blurStackHalf(topId, false)
        return {
          ok: true,
          mode: 'two-person-stack',
          faces: faces.length,
          contentBand: `${round2(bounds.top)}–${round2(bounds.bottom)}`,
          blur: stackBlur
        }
      }
      // center-face / active-speaker → FILL, centered on the chosen face (or frame center if none)
      const idx = typeof input.faceIndex === 'number' ? (input.faceIndex as number) : 0
      const face = faces[idx] ?? faces[0]
      const crop = face ? cropForFace(face, sw, sh, fullAR) : centerFillCrop(sw, sh, fullAR)
      setCenteredCrop(clipId, crop)
      return { ok: true, mode: face ? 'center-face' : 'center-fill', faces: faces.length, crop: { x: round2(crop.x), y: round2(crop.y), w: round2(crop.w), h: round2(crop.h) } }
    }

    case 'blur_person': {
      const clipId = asString(input.clipId, 'clipId')
      const cs = clipAndSource(clipId)
      if (!cs) return { error: `clip ${clipId} non trovata o senza sorgente` }
      const region = input.region as Partial<CropRect> | undefined
      if (region && typeof region.x === 'number' && typeof region.y === 'number') {
        ed.makeBlurRegion(clipId)
        const blurId = useEditor.getState().selectedClipId
        // Default per privacy: RETTANGOLO che copre tutto il tile (niente angoli scoperti) + blur MASSIMO.
        const shape = input.shape === 'ellipse' ? 'ellipse' : 'rectangle'
        if (blurId) {
          ed.setMask(blurId, {
            shape,
            x: clamp(region.x, 0, 1),
            y: clamp(region.y, 0, 1),
            w: clamp(typeof region.w === 'number' ? region.w : 0.3, 0.05, 1),
            h: clamp(typeof region.h === 'number' ? region.h : 0.3, 0.05, 1),
            feather: shape === 'rectangle' ? 0.03 : 0.3
          })
          // "Blur al massimo": sigma forte → riquadro irriconoscibile (default 48; range 8..80).
          const sigma = clamp(typeof input.strength === 'number' ? (input.strength as number) : 48, 8, 80)
          ed.updateClip(blurId, (c) => {
            const fx = (c as MediaClip).effects.find((e) => e.type === 'gblur')
            if (fx) fx.params.sigma = sigma
          })
        }
        return { ok: true, kind: 'region', shape, blurClipId: blurId }
      }
      const faces = await detectAt(cs.clip, cs.src)
      const idx = typeof input.faceIndex === 'number' ? (input.faceIndex as number) : 0
      const face = faces[idx] ?? faces[0]
      await ed.trackFaceBlur(clipId, face ? { cx: face.cx, cy: face.cy } : undefined)
      return { ok: true, kind: 'face', tracked: !!face }
    }

    case 'add_caption': {
      const text = asString(input.text, 'text')
      const start = asNumber(input.startSec, 'startSec')
      const end = asNumber(input.endSec, 'endSec')
      addBoundedText(text, start, Math.max(start + 0.3, end), input.style === 'title' ? TITLE_STYLE : CAPTION_STYLE)
      return { ok: true }
    }

    case 'add_captions_bulk': {
      const segs = Array.isArray(input.segments) ? input.segments : []
      let added = 0
      for (const seg of segs) {
        const s = seg as Record<string, unknown>
        if (typeof s.text !== 'string' || typeof s.start !== 'number' || typeof s.end !== 'number') continue
        addBoundedText(s.text, s.start, Math.max(s.start + 0.3, s.end), CAPTION_STYLE)
        added++
      }
      return { ok: true, added }
    }

    case 'add_transition': {
      const clipId = asString(input.clipId, 'clipId')
      const preset = (typeof input.preset === 'string' ? input.preset : 'fade') as TransitionPreset
      const durSec = typeof input.durSec === 'number' ? clamp(input.durSec as number, 0.1, 2) : 0.4
      ed.applyTransition(clipId, durSec, preset)
      return { ok: true, preset, durSec }
    }

    case 'set_speed': {
      const clipId = asString(input.clipId, 'clipId')
      ed.setSpeed(clipId, clamp(asNumber(input.speed, 'speed'), 0.1, 10))
      return { ok: true }
    }

    case 'set_fade': {
      const clipId = asString(input.clipId, 'clipId')
      const edge = asString(input.edge, 'edge')
      if (edge !== 'in' && edge !== 'out') return { error: "edge deve essere 'in' o 'out'" }
      ed.setFade(clipId, edge, Math.max(0, asNumber(input.sec, 'sec')))
      return { ok: true }
    }

    case 'set_volume': {
      const clipId = asString(input.clipId, 'clipId')
      const volume = clamp(asNumber(input.volume, 'volume'), 0, 4)
      const loc = locateClip(useEditor.getState().project, clipId)
      if (!loc || loc.clip.kind !== 'media') return { error: 'clip non trovata' }
      ed.updateClip(clipId, (c) => void (c.volume = volume))
      return { ok: true, volume }
    }

    case 'mute_clip': {
      const clipId = asString(input.clipId, 'clipId')
      const muted = input.muted !== false
      const loc = locateClip(useEditor.getState().project, clipId)
      if (!loc || loc.clip.kind !== 'media') return { error: 'clip non trovata' }
      if (!!(loc.clip as MediaClip).mutedAudio !== muted) ed.toggleClipAudioFlag(clipId, 'mutedAudio')
      return { ok: true, muted }
    }

    case 'trim_clip': {
      const clipId = asString(input.clipId, 'clipId')
      const edge = asString(input.edge, 'edge')
      if (edge !== 'start' && edge !== 'end') return { error: "edge deve essere 'start' o 'end'" }
      ed.trimClip(clipId, edge, asNumber(input.deltaSec, 'deltaSec'))
      return { ok: true }
    }

    case 'set_look': {
      const clipId = asString(input.clipId, 'clipId')
      const look = asString(input.look, 'look').toLowerCase()
      if (!LOOKS.some((l) => l.id === look))
        return { error: `look "${look}" sconosciuto. Validi: ${LOOKS.map((l) => l.id).join(', ')}` }
      const loc = locateClip(useEditor.getState().project, clipId)
      if (!loc || loc.clip.kind !== 'media') return { error: 'clip non trovata' }
      const intensity = typeof input.intensity === 'number' ? clamp(input.intensity as number, 0, 1) : 1
      ed.setLook(clipId, look === 'none' ? null : look, intensity)
      return { ok: true, look, intensity }
    }

    case 'set_filter': {
      const clipId = asString(input.clipId, 'clipId')
      const type = asString(input.type, 'type').toLowerCase() as EffectType
      const allowed: EffectType[] = [
        'brightness', 'contrast', 'saturation', 'hue', 'sepia', 'grayscale', 'invert', 'sharpen', 'vignette', 'grain'
      ]
      if (!allowed.includes(type)) return { error: `type "${type}" non valido. Validi: ${allowed.join(', ')}` }
      const loc = locateClip(useEditor.getState().project, clipId)
      if (!loc || loc.clip.kind !== 'media') return { error: 'clip non trovata' }
      const raw = asNumber(input.value, 'value')
      const value = type === 'hue' ? clamp(raw, -180, 180) : clamp(raw, -1, 1)
      ed.addEffect(clipId, type, { value })
      return { ok: true, type, value }
    }

    case 'ask_user': {
      const question = asString(input.question, 'question')
      const options = Array.isArray(input.options)
        ? (input.options.filter((o) => typeof o === 'string') as string[])
        : undefined
      return { answer: await ctx.askUser(question, options) }
    }

    case 'set_post_meta': {
      const patch: Record<string, unknown> = {}
      if (typeof input.title === 'string') patch.title = input.title
      if (typeof input.description === 'string') patch.description = input.description
      if (typeof input.hashtags === 'string') patch.hashtags = input.hashtags
      if (typeof input.firstComment === 'string') patch.firstComment = input.firstComment
      if (typeof input.extraDescription === 'string') patch.extraDescription = input.extraDescription
      if (typeof input.notes === 'string') patch.notes = input.notes
      if (Array.isArray(input.hooks)) patch.hooks = (input.hooks as unknown[]).filter((h): h is string => typeof h === 'string')
      if (Object.keys(patch).length === 0) return { error: 'set_post_meta: nessun campo valido (title/description/hashtags/firstComment/hooks/notes)' }
      ed.setPostMeta(patch as Partial<PostMeta>)
      return { ok: true, saved: Object.keys(patch) }
    }

    case 'finish':
      return { ok: true, summary: typeof input.summary === 'string' ? input.summary : 'Reel completato.' }

    default:
      return { error: `tool sconosciuto: ${name}` }
  }
}
