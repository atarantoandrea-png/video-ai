function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** mm:ss.cs (centiseconds) — used for the playhead/timecode readout. */
export function formatTimecode(seconds: number): string {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const cs = Math.floor((s % 1) * 100)
  return `${pad(m)}:${pad(sec)}.${pad(cs)}`
}

/** mm:ss — used for durations. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  return `${pad(m)}:${pad(s % 60)}`
}

/**
 * Ruler tick label: mm:ss, plus one decimal when the tick step is sub-second
 * (so 0.5s ticks read 0:04.0 / 0:04.5 instead of two identical 00:04 labels).
 */
export function formatTick(seconds: number, step: number): string {
  const s = Math.max(0, seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (step < 1) {
    const d = Math.round((s % 1) * 10) % 10
    return `${m}:${pad(sec)}.${d}`
  }
  // Show hours once ticks span minutes/hours, so a 10-hour timeline reads clearly.
  if (s >= 3600 || step >= 3600) return `${h}:${pad(m)}:${pad(sec)}`
  return `${pad(m)}:${pad(sec)}`
}
