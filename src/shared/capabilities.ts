/** Runtime feature probe of the bundled ffmpeg binary (filled in by main). */
export interface FfmpegCapabilities {
  ffmpegPath: string
  ffprobePath: string
  version: string
  /** Apple Silicon hardware H.264 encoder. */
  hasVideoToolboxH264: boolean
  /** Apple Silicon hardware HEVC encoder. */
  hasVideoToolboxHevc: boolean
  /** xfade transition filter. */
  hasXfade: boolean
  /** Gaussian blur filter. */
  hasGblur: boolean
}
