/**
 * Stable, collision-resistant id generator usable in both the Electron main
 * process (Node) and the renderer (browser). Uses crypto.randomUUID when
 * available, with a non-cryptographic fallback.
 */
export function genId(prefix: string): string {
  const uuid =
    globalThis.crypto && 'randomUUID' in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}_${uuid.replace(/-/g, '').slice(0, 12)}`
}
