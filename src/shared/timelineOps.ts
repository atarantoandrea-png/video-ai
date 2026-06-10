import type { Clip, Track } from './projectSchema'

/**
 * Pure timeline-geometry helpers, extracted from the store so they can be unit-tested
 * in isolation (the store itself pulls in face-api and other browser-only modules).
 *
 * The golden rule these enforce: an edit only moves the clips it HAS to. Dropping or
 * trimming a clip never re-packs the whole track or teleports unrelated sections — the
 * bug Andrea hit where a clip "got lost and jumped" on every cut/move.
 */

const EPS = 0.0015
const MIN_DUR = 0.05

/**
 * Place `clip` into `track` at `dropStart` and resolve overlaps by pushing only the
 * clips it runs into FORWARD (cascading). Clips it doesn't overlap keep their exact
 * position, so existing gaps survive and nothing teleports. Slotting on a seam inserts
 * the clip there (the dropped clip wins ties → it takes the earlier slot). `clip` need
 * not already be in `track.clips`. Mutates `track` in place.
 */
export function placeWithRipple(track: Track, clip: Clip, dropStart: number): void {
  const dur = clip.timelineEnd - clip.timelineStart
  const start = Math.max(0, dropStart)
  const others = track.clips
    .filter((c) => c.id !== clip.id)
    .sort((a, b) => a.timelineStart - b.timelineStart)
  let idx = others.findIndex((x) => x.timelineStart >= start - EPS)
  if (idx < 0) idx = others.length
  clip.trackId = track.id
  clip.timelineStart = start
  clip.timelineEnd = start + dur
  const order = [...others.slice(0, idx), clip, ...others.slice(idx)]
  // Walk left→right; a clip that starts before the running cursor (i.e. overlaps the
  // clip before it) is pushed forward by exactly the overlap. No overlap → no move.
  let cursor = 0
  for (const c of order) {
    if (c.timelineStart < cursor - EPS) {
      const shift = cursor - c.timelineStart
      c.timelineStart += shift
      c.timelineEnd += shift
    }
    cursor = c.timelineEnd
  }
  track.clips = order
}

/**
 * Ripple-close a track after a clip starting at `fromStart` (duration `dur`) has been
 * removed: every later clip slides left by `dur` to attach to the previous one.
 */
export function rippleClose(track: Track, fromStart: number, dur: number): void {
  for (const c of track.clips) {
    if (c.timelineStart >= fromStart - EPS) {
      c.timelineStart = Math.max(0, c.timelineStart - dur)
      c.timelineEnd = Math.max(0, c.timelineEnd - dur)
    }
  }
}

export interface TrimGeom {
  timelineStart: number
  timelineEnd: number
  sourceIn: number
  sourceOut: number
}

export interface TrimContext {
  /** End of the nearest clip before this one on the track (0 if none). */
  prevEnd: number
  /** Source media length in seconds; Infinity for images / unbounded sources. */
  srcDur: number
}

/**
 * Pure trim resolver: compute a media clip's new geometry after dragging one edge by
 * `delta` seconds. A trim can never (a) overlap the previous clip, (b) invert the clip,
 * or (c) run past the available footage (sourceIn → 0 on the head, sourceOut → srcDur on
 * the tail) — the trims that used to glitch by reading past the end of the source.
 * `rippleDelta` is how far clips after the OLD end should shift (end-edge only).
 */
export function resolveTrim(
  clip: TrimGeom & { speed: number },
  edge: 'start' | 'end',
  delta: number,
  ctx: TrimContext
): TrimGeom & { rippleDelta: number } {
  let { timelineStart, timelineEnd, sourceIn, sourceOut } = clip
  let rippleDelta = 0
  if (edge === 'start') {
    const minByHead = timelineStart - sourceIn / clip.speed // can't expose source before 0
    const lo = Math.max(ctx.prevEnd, minByHead)
    const newStart = Math.min(timelineEnd - MIN_DUR, Math.max(lo, timelineStart + delta))
    sourceIn = Math.max(0, sourceIn + (newStart - timelineStart) * clip.speed)
    timelineStart = newStart
  } else {
    const maxByTail = timelineStart + (ctx.srcDur - sourceIn) / clip.speed // can't pass source end
    const oldEnd = timelineEnd
    const newEnd = Math.min(maxByTail, Math.max(timelineStart + MIN_DUR, oldEnd + delta))
    rippleDelta = newEnd - oldEnd
    sourceOut = Math.min(ctx.srcDur, sourceOut + rippleDelta * clip.speed)
    timelineEnd = newEnd
  }
  return { timelineStart, timelineEnd, sourceIn, sourceOut, rippleDelta }
}
