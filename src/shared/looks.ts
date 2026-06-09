/**
 * Filter "looks" — one-click colour grades. Each look is a compact param bundle;
 * `lookCss()` emits a CSS `filter` string for the live preview (Canvas2D) and
 * `lookFfmpeg()` emits the matching ffmpeg filters for export, from the SAME params,
 * so preview and the rendered MP4 always agree. Intensity 0..1 scales the whole look
 * toward the identity (no-op), so the strength slider is free.
 */

export interface LookParams {
  /** brightness add (0 = none; CSS brightness(1+b), ffmpeg eq brightness=b). */
  b?: number
  /** contrast delta (0 = none; multiplier 1+c). */
  c?: number
  /** saturation delta (0 = none; multiplier 1+s). */
  s?: number
  /** sepia amount 0..1. */
  sep?: number
  /** grayscale amount 0..1 (desaturates). */
  gray?: number
  /** hue rotation in degrees. */
  hue?: number
  /** soft blur in px (dreamy looks). */
  blur?: number
}

export interface LookDef {
  id: string
  label: string
  params: LookParams
}

/** The look library (id 'none' = no grade). Tuned to read like CapCut presets. */
export const LOOKS: LookDef[] = [
  { id: 'none', label: 'Nessuno', params: {} },
  { id: 'vivid', label: 'Vivido', params: { c: 0.18, s: 0.35, b: 0.02 } },
  { id: 'cinema', label: 'Cinema', params: { c: 0.22, s: 0.08, sep: 0.1, b: -0.02 } },
  { id: 'warm', label: 'Caldo', params: { sep: 0.22, s: 0.18, b: 0.03 } },
  { id: 'cool', label: 'Freddo', params: { hue: -12, s: 0.12, b: 0.03, c: 0.06 } },
  { id: 'bw', label: 'Bianco e nero', params: { gray: 1, c: 0.12 } },
  { id: 'noir', label: 'Noir', params: { gray: 1, c: 0.42, b: -0.05 } },
  { id: 'vintage', label: 'Vintage', params: { sep: 0.38, c: -0.08, s: -0.12, b: 0.04 } },
  { id: 'fade', label: 'Sbiadito', params: { b: 0.08, c: -0.16, s: -0.18 } },
  { id: 'punch', label: 'Punch', params: { c: 0.3, s: 0.45 } },
  { id: 'pastel', label: 'Pastello', params: { b: 0.07, s: -0.22, c: -0.06 } },
  { id: 'sunset', label: 'Tramonto', params: { sep: 0.16, s: 0.3, hue: 6, c: 0.1 } },
  { id: 'teal', label: 'Teal & Orange', params: { hue: -6, s: 0.26, c: 0.16 } },
  { id: 'dreamy', label: 'Sognante', params: { b: 0.06, s: 0.16, blur: 1.2, c: -0.04 } },
  { id: 'mono-blue', label: 'Blu notte', params: { gray: 0.85, hue: 200, s: 0.4, b: -0.03, c: 0.1 } },
  { id: 'matte', label: 'Matte', params: { c: -0.12, s: -0.08, b: 0.05 } },
  { id: 'film', label: 'Film', params: { c: 0.1, s: 0.06, sep: 0.08, b: -0.01 } },
  { id: 'gold', label: 'Golden hour', params: { sep: 0.2, s: 0.24, b: 0.05, c: 0.08 } },
  { id: 'moody', label: 'Moody', params: { b: -0.06, c: 0.18, s: -0.1 } },
  { id: 'cyber', label: 'Cyber', params: { hue: -20, s: 0.42, c: 0.2 } },
  { id: 'autumn', label: 'Autunno', params: { sep: 0.18, hue: -8, s: 0.2, c: 0.08 } },
  { id: 'frost', label: 'Frost', params: { hue: 10, s: -0.05, b: 0.06, c: 0.06 } },
  { id: 'crisp', label: 'Nitido', params: { c: 0.12, s: 0.18, b: 0.02 } }
]

export function lookById(id: string | undefined | null): LookDef | undefined {
  return id ? LOOKS.find((l) => l.id === id) : undefined
}

const n3 = (v: number): string => (Math.round(v * 1000) / 1000).toString()

/** CSS `filter` substring for live preview (or '' for none/identity). */
export function lookCss(id: string | undefined | null, intensity = 1): string {
  const def = lookById(id)
  if (!def || def.id === 'none') return ''
  const p = def.params
  const i = Math.max(0, Math.min(1, intensity))
  const out: string[] = []
  if (p.b) out.push(`brightness(${n3(1 + p.b * i)})`)
  if (p.c) out.push(`contrast(${n3(1 + p.c * i)})`)
  if (p.gray) out.push(`grayscale(${n3(p.gray * i)})`)
  if (p.s) out.push(`saturate(${n3(1 + p.s * i)})`)
  if (p.sep) out.push(`sepia(${n3(p.sep * i)})`)
  if (p.hue) out.push(`hue-rotate(${n3(p.hue * i)}deg)`)
  if (p.blur) out.push(`blur(${n3(p.blur * i)}px)`)
  return out.join(' ')
}

/** ffmpeg filter list for export (empty for none/identity). Order kept close to CSS. */
export function lookFfmpeg(id: string | undefined | null, intensity = 1): string[] {
  const def = lookById(id)
  if (!def || def.id === 'none') return []
  const p = def.params
  const i = Math.max(0, Math.min(1, intensity))
  const out: string[] = []
  // eq: brightness add, contrast mult, saturation mult (grayscale folds into saturation)
  const brightness = (p.b ?? 0) * i
  const contrast = 1 + (p.c ?? 0) * i
  const sat = (1 + (p.s ?? 0) * i) * (1 - (p.gray ?? 0) * i)
  if (brightness !== 0 || contrast !== 1 || sat !== 1) {
    out.push(`eq=brightness=${n3(brightness)}:contrast=${n3(contrast)}:saturation=${n3(Math.max(0, sat))}`)
  }
  if (p.hue) out.push(`hue=h=${n3((p.hue ?? 0) * i)}`)
  if (p.sep) {
    // sepia matrix blended toward identity by amount a (one colorchannelmixer pass)
    const a = (p.sep ?? 0) * i
    const mix = (id1: number, sep: number): string => n3(id1 * (1 - a) + sep * a)
    const rr = mix(1, 0.393), rg = mix(0, 0.769), rb = mix(0, 0.189)
    const gr = mix(0, 0.349), gg = mix(1, 0.686), gb = mix(0, 0.168)
    const br = mix(0, 0.272), bg = mix(0, 0.534), bb = mix(1, 0.131)
    out.push(`colorchannelmixer=${rr}:${rg}:${rb}:0:${gr}:${gg}:${gb}:0:${br}:${bg}:${bb}:0`)
  }
  if (p.blur) out.push(`gblur=sigma=${n3((p.blur ?? 0) * i)}`)
  return out
}
