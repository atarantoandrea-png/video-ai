import { describe, it, expect } from 'vitest'
import { fitContentRect, resolveClipLayout } from './geometry'
import { defaultTransform } from './projectSchema'

describe('fitContentRect', () => {
  const box = { x: 0, y: 0, w: 100, h: 100 }

  it('stretch returns exactly the box', () => {
    expect(fitContentRect(200, 50, box, 'stretch')).toEqual(box)
  })

  it('contain letterboxes wide content inside the box', () => {
    const r = fitContentRect(200, 100, box, 'contain')
    expect(r.w).toBe(100)
    expect(r.h).toBe(50)
    expect(r.y).toBe(25)
    expect(r.x).toBe(0)
  })

  it('cover fills the box and overflows on the long axis', () => {
    const r = fitContentRect(200, 100, box, 'cover')
    expect(r.h).toBe(100)
    expect(r.w).toBe(200)
    expect(r.x).toBe(-50)
    expect(r.y).toBe(0)
  })
})

describe('resolveClipLayout — 2-person vertical stack (the headline feature)', () => {
  it('puts the left half of a 1920x1080 source into the top half of a 1080x1920 canvas', () => {
    const crop = { x: 0, y: 0, w: 0.5, h: 1 }
    const transform = { ...defaultTransform(), x: 0, y: 0, w: 1, h: 0.5, fit: 'cover' as const }
    const layout = resolveClipLayout(crop, transform, 1920, 1080, 1080, 1920)
    expect(layout.sourceRect).toEqual({ x: 0, y: 0, w: 960, h: 1080 })
    expect(layout.canvasBox).toEqual({ x: 0, y: 0, w: 1080, h: 960 })
    expect(layout.clipToBox).toBe(true)
  })

  it('puts the right half into the bottom half', () => {
    const crop = { x: 0.5, y: 0, w: 0.5, h: 1 }
    const transform = { ...defaultTransform(), x: 0, y: 0.5, w: 1, h: 0.5, fit: 'cover' as const }
    const layout = resolveClipLayout(crop, transform, 1920, 1080, 1080, 1920)
    expect(layout.sourceRect).toEqual({ x: 960, y: 0, w: 960, h: 1080 })
    expect(layout.canvasBox).toEqual({ x: 0, y: 960, w: 1080, h: 960 })
  })
})
