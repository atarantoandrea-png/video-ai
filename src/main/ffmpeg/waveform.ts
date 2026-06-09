import { execFile } from 'child_process'
import { getFfmpegPath } from './paths'

const SAMPLE_RATE = 2000
// ~50 peaks/second so even a short clip taken from a LONG source still has a
// detailed, readable waveform (the old 4000-total gave ~1 peak/sec on a 45-min
// source → a few blobs per clip). Capped so a multi-hour file stays bounded.
const PEAKS_PER_SEC = 50
const MAX_PEAKS = 240000

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
      { encoding: 'buffer', maxBuffer: 1 << 30 },
      (err, stdout) => (err ? reject(err) : resolve(stdout as Buffer))
    )
  })

  const samples = Math.floor(pcm.length / 2)
  if (samples <= 0) return []
  const durationSec = samples / SAMPLE_RATE
  const buckets = Math.min(MAX_PEAKS, samples, Math.max(64, Math.round(durationSec * PEAKS_PER_SEC)))
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
