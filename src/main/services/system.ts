import os from 'os'
import { recommendTier, type PerformanceTier, type SystemInfo } from '@shared/performance'

export function getSystemInfo(): SystemInfo {
  return {
    totalMemBytes: os.totalmem(),
    cpuCount: os.cpus().length,
    platform: process.platform,
    arch: process.arch
  }
}

export function getRecommendedTier(): PerformanceTier {
  const info = getSystemInfo()
  return recommendTier(info.totalMemBytes, info.cpuCount)
}
