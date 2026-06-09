export interface SubSegment {
  start: number
  end: number
  text: string
}

/** Parse an `HH:MM:SS,mmm` / `HH:MM:SS.mmm` timestamp to seconds. */
function toSec(t: string): number {
  const m = t.trim().match(/(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})/)
  if (!m) return 0
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + Number(m[4].padEnd(3, '0')) / 1000
}

/** Parse SRT or WebVTT subtitle text into timed segments. */
export function parseSubtitles(content: string): SubSegment[] {
  const text = content.replace(/\r/g, '').replace(/^WEBVTT.*$/m, '')
  const blocks = text.split(/\n\s*\n/)
  const out: SubSegment[] = []
  for (const b of blocks) {
    const lines = b.split('\n').filter((l) => l.trim())
    const timeLine = lines.find((l) => l.includes('-->'))
    if (!timeLine) continue
    const [a, bt] = timeLine.split('-->')
    const start = toSec(a)
    const end = toSec(bt)
    const txt = lines
      .filter((l) => l !== timeLine && !/^\d+$/.test(l.trim()))
      .join('\n')
      .trim()
    if (txt && end > start) out.push({ start, end, text: txt })
  }
  return out
}
