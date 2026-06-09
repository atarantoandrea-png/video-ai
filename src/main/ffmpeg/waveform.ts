import { execFile } from 'child_process'
import { getFfmpegPath } from './paths'

const SAMPLE_RATE = 1000
const MAX_PEAKS = 4000

/**
 * Extract normalized audio peaks (0..1) for waveform display by decoding the
 * file to low-rate mono PCM and taking the max amplitude per bucket.
 */
export async function extractPeaks(filePath: string): Promise<number[]> {
  const ffmpeg = getFfmpegPath()
  const pcm = await new Promise<Buffer>((resolve, reject) => {
    execFile(
      ffmpeg,
      ['-v', 'error', '-i', filePath, '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', '-'],
      { encoding: 'buffer', maxBuffer: 1 << 28 },
      (err, stdout) => (err ? reject(err) : resolve(stdout as Buffer))
    )
  })

  const samples = Math.floor(pcm.length / 2)
  if (samples <= 0) return []
  const buckets = Math.min(MAX_PEAKS, samples)
  const per = samples / buckets
  const peaks: number[] = new Array(buckets)
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * per)
    const end = Math.min(samples, Math.floor((i + 1) * per))
    let max = 0
    for (let j = start; j < end; j++) {
      const v = Math.abs(pcm.readInt16LE(j * 2)) / 32768
      if (v > max) max = v
    }
    peaks[i] = Math.round(max * 1000) / 1000
  }
  return peaks
}
