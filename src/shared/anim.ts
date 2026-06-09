import type { Keyframe, Mask, MediaClip, Transform } from './projectSchema'

export function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f
}

function lerpTransform(a: Transform, b: Transform, f: number): Transform {
  return {
    x: lerp(a.x, b.x, f),
    y: lerp(a.y, b.y, f),
    w: lerp(a.w, b.w, f),
    h: lerp(a.h, b.h, f),
    rotation: lerp(a.rotation, b.rotation, f),
    opacity: lerp(a.opacity, b.opacity, f),
    fit: a.fit,
    flipH: a.flipH,
    flipV: a.flipV
  }
}

/** Sorted keyframes, or null when the clip is static (0/1 keyframes are treated
 *  as "no animation" — a single keyframe just equals the base transform). */
export function activeKeyframes(clip: MediaClip): Keyframe[] | null {
  const k = clip.keyframes
  if (!k || k.length === 0) return null
  return [...k].sort((p, q) => p.t - q.t)
}

/**
 * The clip's transform at `tInClip` seconds from its start. Linearly interpolates
 * between keyframes (holding the first/last value beyond the ends); falls back to
 * the static transform when there is no animation. Used IDENTICALLY by the live
 * compositor and the export builder.
 */
export function resolveTransformAt(clip: MediaClip, tInClip: number): Transform {
  const kfs = activeKeyframes(clip)
  if (!kfs) return clip.transform
  if (tInClip <= kfs[0].t) return kfs[0].transform
  const last = kfs[kfs.length - 1]
  if (tInClip >= last.t) return last.transform
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i]
    const b = kfs[i + 1]
    if (tInClip < b.t) {
      const f = b.t > a.t ? (tInClip - a.t) / (b.t - a.t) : 0
      return lerpTransform(a.transform, b.transform, f)
    }
  }
  return last.transform
}

function lerpMask(a: Mask, b: Mask, f: number): Mask {
  return {
    shape: a.shape,
    x: lerp(a.x, b.x, f),
    y: lerp(a.y, b.y, f),
    w: lerp(a.w, b.w, f),
    h: lerp(a.h, b.h, f),
    feather: lerp(a.feather, b.feather, f),
    invert: a.invert
  }
}

/** The clip's mask at `tInClip` seconds, interpolating maskKeyframes (used by the
 *  face-blur tracking); falls back to the static mask when not animated. */
export function resolveMaskAt(clip: MediaClip, tInClip: number): Mask {
  const k = clip.maskKeyframes
  if (!k || k.length === 0) return clip.mask
  const kfs = [...k].sort((p, q) => p.t - q.t)
  if (tInClip <= kfs[0].t) return kfs[0].mask
  const last = kfs[kfs.length - 1]
  if (tInClip >= last.t) return last.mask
  for (let i = 0; i < kfs.length - 1; i++) {
    if (tInClip < kfs[i + 1].t) {
      const a = kfs[i]
      const b = kfs[i + 1]
      const f = b.t > a.t ? (tInClip - a.t) / (b.t - a.t) : 0
      return lerpMask(a.mask, b.mask, f)
    }
  }
  return last.mask
}

/**
 * Build an ffmpeg piecewise-linear expression of `t` (timeline seconds) through
 * the points (times[i], values[i]); clamped flat outside the range. Used to bake
 * keyframed scale/position into scale(eval=frame)/overlay expressions on export.
 */
export function pwlExpr(times: number[], values: number[], v = 't'): string {
  const n = times.length
  if (n === 0) return '0'
  if (n === 1) return values[0].toFixed(2)
  const num = (x: number): string => x.toFixed(3)
  // Build from the last segment backwards into nested if().
  let expr = num(values[n - 1])
  for (let i = n - 2; i >= 0; i--) {
    const t0 = times[i]
    const t1 = times[i + 1]
    const v0 = values[i]
    const v1 = values[i + 1]
    const dt = t1 - t0
    const seg =
      dt > 1e-6
        ? `(${num(v0)}+(${num(v1)}-${num(v0)})*(${v}-${num(t0)})/${num(dt)})`
        : num(v1)
    expr = `if(lt(${v},${num(t1)}),${seg},${expr})`
  }
  // Before the first time, hold the first value.
  expr = `if(lt(${v},${num(times[0])}),${num(values[0])},${expr})`
  return expr
}
