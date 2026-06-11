import {
  type CaroselloProject,
  type Format,
  type Slide,
  makeSlide,
  makeTextLayer
} from './types'

/** Vertical anchor presets matching the Brief's `layout.testoPos`. */
const POS_Y: Record<string, number> = {
  alto: 0.2,
  centro: 0.5,
  'centro-basso': 0.66,
  basso: 0.82
}

/** Font size (fraction of canvas height) by slide role. */
const SIZE_BY_ROLE: Record<string, number> = {
  hook: 0.072,
  corpo: 0.05,
  cta: 0.058
}

interface BriefSlide {
  n?: number
  ruolo?: string
  testo?: string
  layout?: { viso?: string; visoOpacita?: number; testoPos?: string; accentoColore?: string }
}
interface BriefDoc {
  meta?: { tema?: string; obiettivo?: string; formato?: string }
  caption?: string
  hashtag?: string[]
  commentoFissato?: string | null
  slides?: BriefSlide[]
}

/** Strip ```json fences and grab the first {...} block if the user pasted markdown. */
function extractJson(raw: string): string {
  let s = raw.trim()
  const fence = s.match(/```(?:json|jsonc)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  if (!s.startsWith('{')) {
    const i = s.indexOf('{')
    const j = s.lastIndexOf('}')
    if (i >= 0 && j > i) s = s.slice(i, j + 1)
  }
  // tolerate // line comments (jsonc) and trailing commas
  s = s.replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1')
  return s
}

export interface ParseResult {
  ok: boolean
  project?: CaroselloProject
  error?: string
}

export function parseBrief(raw: string): ParseResult {
  let doc: BriefDoc
  try {
    doc = JSON.parse(extractJson(raw)) as BriefDoc
  } catch (e) {
    return { ok: false, error: 'JSON non valido: ' + (e as Error).message }
  }
  const briefSlides = Array.isArray(doc.slides) ? doc.slides : []
  if (!briefSlides.length) return { ok: false, error: 'Il Brief non contiene "slides".' }

  const fmt: Format = doc.meta?.formato === '1:1' ? '1:1' : '4:5'
  const slides: Slide[] = briefSlides.map((bs) => {
    const role = (bs.ruolo || 'corpo').toLowerCase()
    const size = SIZE_BY_ROLE[role] ?? 0.052
    const posY = POS_Y[(bs.layout?.testoPos || 'centro').toLowerCase()] ?? 0.5
    const text = makeTextLayer({
      text: bs.testo || '',
      fontSizeFrac: size,
      yFrac: posY,
      xFrac: 0.5,
      widthFrac: 0.84,
      align: 'left',
      bold: true,
      color: '#1a1a1a'
    })
    return makeSlide({ layers: [text] })
  })

  return {
    ok: true,
    project: {
      format: fmt,
      slides,
      meta: {
        tema: doc.meta?.tema,
        obiettivo: doc.meta?.obiettivo,
        caption: doc.caption,
        hashtag: doc.hashtag,
        commentoFissato: doc.commentoFissato ?? null
      }
    }
  }
}
