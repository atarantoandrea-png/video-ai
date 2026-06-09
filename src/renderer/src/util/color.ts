/** Convert a #rgb or #rrggbb string to a 0xRRGGBB number. */
export function hexToNum(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h
  return parseInt(full.slice(0, 6), 16) || 0
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** A #rrggbb hex as a CSS rgba() string with the given alpha (0..1). */
export function hexWithAlpha(hex: string, alpha: number): string {
  const n = hexToNum(hex)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return `rgba(${r},${g},${b},${clamp01(alpha)})`
}
