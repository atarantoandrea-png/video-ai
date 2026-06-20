/** Summary of a project stored in the cloud (videoai-cloud on the VPS). */
export interface CloudProject {
  id: string
  name: string
  modifiedAt: string | null
  hasSocial: boolean
  segments: number
  sizeKB: number
  /** Whether a finished, downloadable video has been uploaded for this project. */
  hasVideo?: boolean
  /** Size of that video in MB (0 if none). */
  videoMB?: number
}
