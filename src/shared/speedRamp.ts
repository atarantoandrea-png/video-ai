/**
 * Smooth speed ramp (variable playback speed) math, shared by the preview Compositor and
 * the hi-fi export (which renders frames through the SAME Compositor) — so a ramp is
 * WYSIWYG with the export.
 *
 * A ramp is a piecewise-linear curve of RELATIVE speed over the clip's OUTPUT duration:
 * `t` is the output fraction 0..1, `speed` is a multiplier of the clip's base speed.
 * The curve is normalised so its average is 1, which keeps the source coverage and the
 * clip's output duration unchanged — the ramp just redistributes speed (e.g. slow in the
 * middle, faster at the edges: the classic reel speed-ramp).
 */
export interface SpeedKey {
  t: number
  speed: number
}

/** Mean speed of the curve over [0,1] (trapezoidal), used to normalise to average 1. */
export function rampAvg(keys: SpeedKey[]): number {
  if (keys.length < 2) return keys[0]?.speed ?? 1
  let area = 0
  for (let i = 1; i < keys.length; i++) {
    area += ((keys[i - 1].speed + keys[i].speed) / 2) * (keys[i].t - keys[i - 1].t)
  }
  const span = keys[keys.length - 1].t - keys[0].t
  return span > 0 ? area / span : 1
}

/** Scale a preset's speeds so the average is exactly 1 (preserves coverage + duration). */
export function normalizeRamp(keys: SpeedKey[]): SpeedKey[] {
  const avg = rampAvg(keys) || 1
  return keys.map((k) => ({ t: k.t, speed: k.speed / avg }))
}

/** Instantaneous relative speed at output fraction f (0..1). */
export function rampSpeedAt(keys: SpeedKey[], f: number): number {
  if (!keys.length) return 1
  if (f <= keys[0].t) return keys[0].speed
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i].t) {
      const a = keys[i - 1]
      const b = keys[i]
      const u = b.t > a.t ? (f - a.t) / (b.t - a.t) : 0
      return a.speed + (b.speed - a.speed) * u
    }
  }
  return keys[keys.length - 1].speed
}

/**
 * ∫₀^f speed(u) du — the fraction of (normalised) source covered by output fraction f.
 * For a normalised ramp, rampIntegral(keys, 1) ≈ 1, so total coverage = base over the clip.
 */
export function rampIntegral(keys: SpeedKey[], f: number): number {
  if (keys.length < 2) return (keys[0]?.speed ?? 1) * f
  let acc = 0
  let prevT = keys[0].t
  let prevS = keys[0].speed
  if (f <= prevT) return prevS * f
  for (let i = 1; i < keys.length; i++) {
    const t = keys[i].t
    const s = keys[i].speed
    if (f <= t) {
      const u = t > prevT ? (f - prevT) / (t - prevT) : 0
      const sAtF = prevS + (s - prevS) * u
      return acc + ((prevS + sAtF) / 2) * (f - prevT)
    }
    acc += ((prevS + s) / 2) * (t - prevT)
    prevT = t
    prevS = s
  }
  return acc + prevS * (f - prevT) // f beyond the last key
}

/** Smooth speed-ramp presets (un-normalised shapes; call normalizeRamp before storing). */
export const SPEED_RAMP_PRESETS: Record<string, SpeedKey[]> = {
  // slow-motion wave: normal → slow in the middle → normal (the iconic reel ramp)
  slowmo: [
    { t: 0, speed: 1.7 },
    { t: 0.42, speed: 0.28 },
    { t: 0.58, speed: 0.28 },
    { t: 1, speed: 1.7 }
  ],
  // ease into fast: slow start, accelerate to the end
  speedup: [
    { t: 0, speed: 0.45 },
    { t: 1, speed: 1.9 }
  ],
  // ease into slow: fast start, decelerate to the end
  slowdown: [
    { t: 0, speed: 1.9 },
    { t: 1, speed: 0.45 }
  ]
}

export type SpeedRampPreset = keyof typeof SPEED_RAMP_PRESETS
