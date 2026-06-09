import { describe, it, expect } from 'vitest'
import { parseSubtitles } from './subtitles'

describe('parseSubtitles', () => {
  it('parses SRT', () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
Ciao mondo

2
00:00:05,500 --> 00:00:08,000
Seconda riga
multi`
    const segs = parseSubtitles(srt)
    expect(segs).toHaveLength(2)
    expect(segs[0]).toEqual({ start: 1, end: 4, text: 'Ciao mondo' })
    expect(segs[1].start).toBeCloseTo(5.5)
    expect(segs[1].text).toBe('Seconda riga\nmulti')
  })

  it('parses WebVTT', () => {
    const vtt = `WEBVTT

00:00:02.000 --> 00:00:03.500
Hello`
    const segs = parseSubtitles(vtt)
    expect(segs).toHaveLength(1)
    expect(segs[0]).toEqual({ start: 2, end: 3.5, text: 'Hello' })
  })
})
