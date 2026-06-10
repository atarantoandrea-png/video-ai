import { describe, it, expect } from 'vitest'
import { rampAvg, normalizeRamp, rampSpeedAt, rampIntegral, SPEED_RAMP_PRESETS } from './speedRamp'

describe('speedRamp', () => {
  it('normalizeRamp gives average 1 for every preset (keeps coverage + duration)', () => {
    for (const keys of Object.values(SPEED_RAMP_PRESETS)) {
      expect(rampAvg(normalizeRamp(keys))).toBeCloseTo(1, 4)
    }
  })

  it('full-clip integral ≈ 1 for a normalised ramp (whole source covered)', () => {
    expect(rampIntegral(normalizeRamp(SPEED_RAMP_PRESETS.slowmo), 1)).toBeCloseTo(1, 3)
  })

  it('integral starts at 0 and is monotonic', () => {
    const n = normalizeRamp(SPEED_RAMP_PRESETS.speedup)
    expect(rampIntegral(n, 0)).toBeCloseTo(0, 6)
    expect(rampIntegral(n, 0.5)).toBeGreaterThan(0)
    expect(rampIntegral(n, 0.5)).toBeLessThan(rampIntegral(n, 0.9))
  })

  it('slow-mo is slowest at the centre, faster at the edges', () => {
    const n = normalizeRamp(SPEED_RAMP_PRESETS.slowmo)
    expect(rampSpeedAt(n, 0.5)).toBeLessThan(rampSpeedAt(n, 0))
    expect(rampSpeedAt(n, 0.5)).toBeLessThan(rampSpeedAt(n, 1))
    expect(rampSpeedAt(n, 0.5)).toBeLessThan(1)
  })

  it('empty / single-key ramps integrate linearly', () => {
    expect(rampIntegral([], 0.5)).toBeCloseTo(0.5)
    expect(rampIntegral([{ t: 0, speed: 2 }], 0.5)).toBeCloseTo(1)
  })
})
