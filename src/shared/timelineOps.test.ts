import { describe, it, expect } from 'vitest'
import { placeWithRipple, rippleClose, resolveTrim } from './timelineOps'
import type { Clip, Track } from './projectSchema'

const clip = (id: string, start: number, end: number): Clip =>
  ({ id, trackId: 't', kind: 'media', timelineStart: start, timelineEnd: end }) as unknown as Clip
const track = (clips: Clip[]): Track =>
  ({ id: 't', type: 'video', name: 'V', clips }) as unknown as Track
const pos = (t: Track): Array<[string, number, number]> =>
  t.clips.map((c) => [c.id, +c.timelineStart.toFixed(3), +c.timelineEnd.toFixed(3)])

describe('placeWithRipple (drop / move)', () => {
  it('drops in empty space and stays EXACTLY there — no teleport, gaps preserved', () => {
    const t = track([clip('a', 0, 5)])
    placeWithRipple(t, clip('b', 0, 4), 20)
    expect(pos(t)).toEqual([
      ['a', 0, 5],
      ['b', 20, 24]
    ])
  })

  it('pushes ONLY the clip it overlaps, leaving distant clips untouched', () => {
    const t = track([clip('a', 0, 5), clip('c', 30, 35)])
    placeWithRipple(t, clip('b', 0, 4), 3) // overlaps a → after a; c never moves
    expect(pos(t)).toEqual([
      ['a', 0, 5],
      ['b', 5, 9],
      ['c', 30, 35]
    ])
  })

  it('inserting on a seam shifts the following section (insert-between)', () => {
    const t = track([clip('a', 0, 5), clip('c', 5, 10)])
    placeWithRipple(t, clip('b', 0, 3), 5)
    expect(pos(t)).toEqual([
      ['a', 0, 5],
      ['b', 5, 8],
      ['c', 8, 13]
    ])
  })

  it('moving a clip across a gap does NOT collapse the other clips (regression: no re-pack)', () => {
    const a = clip('a', 0, 5)
    const b = clip('b', 5, 10)
    const c = clip('c', 10, 15)
    const t = track([a, b, c])
    t.clips = [a, c] // pull b out, as moveClip does
    placeWithRipple(t, b, 20)
    expect(pos(t)).toEqual([
      ['a', 0, 5],
      ['c', 10, 15], // the gap 5→10 survives — old bug re-packed everything to 0
      ['b', 20, 25]
    ])
  })
})

describe('rippleClose (delete)', () => {
  it('slides later clips left by the removed duration', () => {
    const t = track([clip('a', 0, 5), clip('c', 12, 18)]) // b(5→12, dur 7) was deleted
    rippleClose(t, 5, 7)
    expect(pos(t)).toEqual([
      ['a', 0, 5],
      ['c', 5, 11]
    ])
  })
})

describe('resolveTrim', () => {
  const base = { timelineStart: 10, timelineEnd: 15, sourceIn: 4, sourceOut: 9, speed: 1 }

  it('end: lengthens and reports a positive ripple for following clips', () => {
    const r = resolveTrim(base, 'end', 3, { prevEnd: 0, srcDur: 100 })
    expect(r.timelineEnd).toBeCloseTo(18)
    expect(r.sourceOut).toBeCloseTo(12)
    expect(r.rippleDelta).toBeCloseTo(3)
  })

  it('end: CANNOT lengthen past the available footage (clamped to source end)', () => {
    const r = resolveTrim(base, 'end', 999, { prevEnd: 0, srcDur: 12 }) // only 8s of tail left
    expect(r.timelineEnd).toBeCloseTo(18)
    expect(r.sourceOut).toBeCloseTo(12) // never beyond srcDur
  })

  it('end: shortening reports a negative ripple (following clips slide left)', () => {
    const r = resolveTrim(base, 'end', -2, { prevEnd: 0, srcDur: 100 })
    expect(r.timelineEnd).toBeCloseTo(13)
    expect(r.rippleDelta).toBeCloseTo(-2)
  })

  it('start: CANNOT expose footage before source 0 (clamped by head)', () => {
    const r = resolveTrim(base, 'start', -999, { prevEnd: 0, srcDur: 100 })
    expect(r.timelineStart).toBeCloseTo(6) // only 4s of head footage
    expect(r.sourceIn).toBeCloseTo(0)
  })

  it('start: stops at the previous clip (never overlaps a neighbour)', () => {
    const r = resolveTrim(base, 'start', -999, { prevEnd: 8, srcDur: 100 })
    expect(r.timelineStart).toBeCloseTo(8)
  })

  it('respects clip speed when converting timeline ↔ source seconds', () => {
    const fast = { timelineStart: 0, timelineEnd: 5, sourceIn: 0, sourceOut: 10, speed: 2 }
    // 5s of source left after sourceOut? srcDur 12, sourceOut 10 → 2s source = 1s timeline at 2×
    const r = resolveTrim(fast, 'end', 999, { prevEnd: 0, srcDur: 12 })
    expect(r.timelineEnd).toBeCloseTo(6) // 5 + (12-10)/2
    expect(r.sourceOut).toBeCloseTo(12)
  })
})
