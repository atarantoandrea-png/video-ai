/**
 * Performance tiers let the same app run in a light mode on an Apple M1 / 8 GB
 * today and scale up on a future 32 GB+ machine. On 8 GB the binding constraint
 * is RAM (decoder/texture buffers), so the highest-leverage knobs are the
 * preview proxy resolution and the cap on simultaneously decoded layers.
 *
 * Tier definitions are pure (safe to import in the renderer). Auto-detection
 * (which needs os.totalmem) runs in the main process and calls recommendTier().
 */
export type PerformanceTier = 'light' | 'balanced' | 'high'

export interface PerformanceProfile {
  tier: PerformanceTier
  label: string
  /** Vertical resolution used for preview/proxy rendering. */
  previewMaxHeight: number
  /** Max number of <video> elements decoding at once. */
  maxDecodedLayers: number
  /** Parallel ffmpeg segment jobs during export. */
  exportConcurrency: number
  /** Quality of effect rendering during live playback. */
  effectPreviewQuality: 'low' | 'medium' | 'high'
  /** Whether to transcode low-res proxies on import. */
  generateProxies: boolean
}

export const PROFILES: Record<PerformanceTier, PerformanceProfile> = {
  light: {
    tier: 'light',
    label: 'Leggera (M1 / 8 GB)',
    previewMaxHeight: 540,
    maxDecodedLayers: 2,
    exportConcurrency: 1,
    effectPreviewQuality: 'low',
    generateProxies: true
  },
  balanced: {
    tier: 'balanced',
    label: 'Bilanciata',
    previewMaxHeight: 720,
    maxDecodedLayers: 3,
    exportConcurrency: 2,
    effectPreviewQuality: 'medium',
    generateProxies: true
  },
  high: {
    tier: 'high',
    label: 'Alta (32 GB+)',
    previewMaxHeight: 1080,
    maxDecodedLayers: 6,
    exportConcurrency: 4,
    effectPreviewQuality: 'high',
    generateProxies: false
  }
}

/** Recommend a tier from total RAM and CPU core count. */
export function recommendTier(totalMemBytes: number, cpuCount: number): PerformanceTier {
  const gb = totalMemBytes / 1024 ** 3
  if (gb <= 10 || cpuCount <= 4) return 'light'
  if (gb <= 24) return 'balanced'
  return 'high'
}

export interface SystemInfo {
  totalMemBytes: number
  cpuCount: number
  platform: string
  arch: string
}
