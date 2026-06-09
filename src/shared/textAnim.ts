import type { TextAnim, TextStyle } from './projectSchema'

export interface TextMotion {
  /** Multiplier applied to the text opacity (0..1). */
  alpha: number
  /** Pixel offset as a fraction of canvas WIDTH (slide) — caller multiplies by W. */
  dxFracW: number
  /** Pixel offset as a fraction of FONT size (rise) — caller multiplies by fontPx. */
  dyFracFont: number
  /** Uniform scale around the anchor. */
  scale: number
  /** Fraction of characters visible (typewriter); 1 = all. */
  charFrac: number
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
const easeOut = (p: number): number => 1 - Math.pow(1 - clamp01(p), 3)

/** Neutral motion (fully visible, no transform). */
export function identityMotion(opacity = 1): TextMotion {
  return { alpha: opacity, dxFracW: 0, dyFracFont: 0, scale: 1, charFrac: 1 }
}

function applyPhase(m: TextMotion, anim: TextAnim, lin: number, entering: boolean): void {
  if (anim === 'none') return
  const p = easeOut(lin)
  const dir = entering ? 1 : -1
  switch (anim) {
    case 'fade':
      m.alpha *= lin
      break
    case 'pop':
      m.alpha *= lin
      m.scale *= 0.6 + 0.4 * p
      break
    case 'rise':
      m.alpha *= lin
      m.dyFracFont += dir * (1 - p) * 0.9
      break
    case 'slide':
      m.alpha *= lin
      m.dxFracW += dir * (1 - p) * 0.18
      break
    case 'typewriter':
      // Only the entrance reveals progressively; exit just holds full text.
      if (entering) m.charFrac = lin
      break
  }
}

/**
 * Resolve the entrance/exit motion of a text clip at time `t` seconds into the
 * clip (duration `dur`). Shared so preview and any future renderer agree.
 */
export function resolveTextMotion(style: TextStyle, t: number, dur: number): TextMotion {
  const m = identityMotion(clamp01(style.opacity ?? 1))
  const ad = Math.min(Math.max(0.05, style.animDurSec || 0), Math.max(0.05, dur / 2))
  if (style.animIn && style.animIn !== 'none' && t < ad) {
    applyPhase(m, style.animIn, clamp01(t / ad), true)
  }
  if (style.animOut && style.animOut !== 'none' && t > dur - ad) {
    applyPhase(m, style.animOut, clamp01((dur - t) / ad), false)
  }
  return m
}
