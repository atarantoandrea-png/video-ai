export interface ExportProgress {
  percent: number
  timeSec: number
  /** ffmpeg speed string, e.g. "2.1x". */
  speed: string
}

export interface ExportResult {
  ok?: boolean
  outPath?: string
  canceled?: boolean
  error?: string
}

export interface ExportRequestOptions {
  useVideoToolbox?: boolean
  videoBitrate?: string
  audioBitrate?: string
  /** Output scale over the canvas resolution: 1 = 1080p, 2 = 4K-class. */
  outputScale?: number
  /** Output frame rate (defaults to project fps). */
  fps?: number
  /** Container/format. */
  format?: 'mp4' | 'mov' | 'gif'
  /** Quality preset. */
  quality?: 'low' | 'medium' | 'high'
}

/** User-chosen export settings from the export menu. */
export interface ExportSettings {
  outputScale?: number
  fps?: number
  quality?: 'low' | 'medium' | 'high'
  format?: 'mp4' | 'mov' | 'gif'
}
