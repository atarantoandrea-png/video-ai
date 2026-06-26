import { genId } from './ids'

/**
 * The project document is the SINGLE SOURCE OF TRUTH for both the live preview
 * (PixiJS compositor) and the export (ffmpeg command builder). Every spatial
 * value is normalized 0..1 against the OUTPUT CANVAS (or the SOURCE, for crop),
 * so it is resolution-independent and aspect changes are cheap.
 *
 * Bump SCHEMA_VERSION and add a migration in migrateProject() on any breaking
 * change to this shape.
 */
export const SCHEMA_VERSION = 6

export type AspectPreset = '16:9' | '9:16' | '1:1' | '4:5'

export interface CanvasSpec {
  /** Output pixel width. */
  width: number
  /** Output pixel height. */
  height: number
  /** Output frames per second. */
  fps: number
  /** Hex background fill shown where no clip covers the canvas. */
  backgroundColor: string
}

export type SourceKind = 'video' | 'audio' | 'image'

/** A physical media file imported into the project (immutable facts from ffprobe). */
export interface Source {
  id: string
  /** Absolute path to the original file (export always reads this). */
  path: string
  fileName: string
  kind: SourceKind
  durationSec: number
  width: number
  height: number
  fps: number
  hasVideo: boolean
  hasAudio: boolean
  /** Video codec name from ffprobe (e.g. 'h264', 'hevc'); null if no video. */
  videoCodec: string | null
  /** Rotation metadata in degrees (0/90/180/270). */
  rotation: number
  /** Low-res proxy for responsive preview (null until generated). */
  proxyPath: string | null
  /** Single poster frame for the media bin card (null until generated). */
  thumbnailPath: string | null
  /** Filmstrip sprite (frames tiled in a grid) for timeline clips (null until generated). */
  timelineThumbsPath: string | null
  /** Columns in the filmstrip grid (frames per row); null = legacy single-row strip. */
  timelineThumbCols: number | null
  waveformPath: string | null
  /** Normalized audio peaks (0..1) for waveform display; null until computed. */
  peaks: number[] | null
}

/** Rectangle taken FROM the source, normalized 0..1 to the source dimensions. */
export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

export type FitMode = 'cover' | 'contain' | 'stretch'

/** Where the cropped piece lands ON the canvas, normalized 0..1 to the canvas. */
export interface Transform {
  x: number
  y: number
  w: number
  h: number
  /** Rotation in degrees, clockwise, around the box center. */
  rotation: number
  /** 0..1 */
  opacity: number
  fit: FitMode
  /** Mirror horizontally / vertically. */
  flipH: boolean
  flipV: boolean
}

export type EffectType =
  | 'gblur'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'hue'
  | 'sepia'
  | 'grayscale'
  | 'sharpen'
  | 'vignette'
  | 'grain'
  | 'invert'

export interface Effect {
  id: string
  type: EffectType
  enabled: boolean
  /** Effect-specific scalar params, e.g. { sigma: 12 } for gblur. */
  params: Record<string, number>
}

export type TransitionPreset =
  | 'fade'
  | 'wipeleft'
  | 'wiperight'
  | 'wipeup'
  | 'wipedown'
  | 'slideleft'
  | 'slideright'
  | 'slideup'
  | 'slidedown'
  | 'zoomin'
  | 'circleopen'
  | 'dissolve'
  // extended library (preview via canvas transforms; hi-fi export reproduces exactly)
  | 'zoomout'
  | 'spin'
  | 'irisbox'
  | 'splith'
  | 'splitv'
  | 'wipetl'
  | 'wipetr'
  | 'wipebl'
  | 'wipebr'

export interface Transition {
  type: 'xfade'
  preset: TransitionPreset
  durationSec: number
}

/** A labelled point on the timeline (chapter/note marker). */
export interface Marker {
  id: string
  /** Time in seconds on the timeline. */
  t: number
  label: string
  color: string
}

/** One animation keyframe: the clip's transform at a given time. */
export interface Keyframe {
  /** Time in seconds from the clip's start on the timeline. */
  t: number
  transform: Transform
}

export type MaskShape = 'none' | 'rectangle' | 'ellipse'

/** A shape mask limiting where the clip is visible (canvas-normalized 0..1). */
export interface Mask {
  shape: MaskShape
  x: number
  y: number
  w: number
  h: number
  /** Edge softness as a fraction of the mask size (0 = hard). */
  feather: number
  /** Show outside the shape instead of inside. */
  invert: boolean
}

export type TrackType = 'video' | 'audio' | 'text'

interface ClipBase {
  id: string
  trackId: string
  /** Position on the timeline, in seconds. */
  timelineStart: number
  timelineEnd: number
}

export interface MediaClip extends ClipBase {
  kind: 'media'
  sourceId: string
  /** In/out point within the source, in seconds. */
  sourceIn: number
  sourceOut: number
  /** Playback speed multiplier (1 = normal). */
  speed: number
  /** Smooth speed ramp: normalised relative-speed curve over the clip (avg≈1). Null/absent
   *  = constant speed. Rendered frame-accurately in preview + hi-fi export. */
  speedRamp?: import('./speedRamp').SpeedKey[] | null
  /** Play the clip backwards. */
  reverse?: boolean
  crop: CropRect
  transform: Transform
  effects: Effect[]
  /** Linear gain 0..N (1 = unchanged). */
  volume: number
  /** Exclude this clip's audio from the mix (e.g. after extracting it to a track). */
  mutedAudio?: boolean
  /** FFT noise reduction (afftdn) on this clip's audio. */
  denoise?: boolean
  /** Privacy voice mask: pitch the audio DOWN so the speaker is unrecognisable but
   *  still intelligible (pairs with face-blur for anonymising people in consultations). */
  voiceDisguise?: boolean
  /** Duck this clip's audio under the other (voice) tracks. */
  duck?: boolean
  /** Opacity ramp at the clip's head/tail, in seconds (0 = none). */
  fadeInSec: number
  fadeOutSec: number
  mask: Mask
  transitionOut: Transition | null
  /** Transform animation keyframes (sorted by t). Empty/absent = static. */
  keyframes?: Keyframe[]
  /** Animated mask keyframes (used by face-blur tracking); empty/absent = static mask. */
  maskKeyframes?: { t: number; mask: Mask }[]
  /** Freeze-frame: hold the source frame at sourceIn for the clip's whole duration. */
  freeze?: boolean
  /** Chroma key (green screen): make `keyColor` transparent. */
  chroma?: { keyColor: string; similarity: number; blend: number }
  /** Absolute path to a 3D LUT (.cube) colour-grade applied on export. */
  lut?: string
  /** One-click colour "look" preset (see shared/looks.ts). Applied in preview AND export. */
  look?: { id: string; intensity: number }
  /** Reserved for the future AI cutting layer; inert until then. */
  aiMeta?: { reason?: string; isHook?: boolean }
}

/** Canva-style preset that drives the text's stroke/shadow/fill look. */
export type TextEffect =
  | 'none'
  | 'shadow'
  | 'lift'
  | 'hollow'
  | 'outline'
  | 'splice'
  | 'echo'
  | 'glow'
  | 'neon'
/** Canva-style entrance/exit motion. */
export type TextAnim = 'none' | 'fade' | 'pop' | 'rise' | 'slide' | 'typewriter'

export interface TextStyle {
  fontFamily: string
  /** Font size as a fraction of canvas height. */
  fontSizeFrac: number
  color: string
  // Weight & decoration
  bold: boolean
  italic: boolean
  underline: boolean
  align: 'left' | 'center' | 'right'
  /** Letter spacing as a fraction of canvas height (0 = normal). */
  letterSpacingFrac: number
  /** Line height multiplier for multi-line text (1.2 = comfortable). */
  lineHeightMul: number
  /** Overall text opacity, 0..1. */
  opacity: number
  /** Anchor position, normalized 0..1 on the canvas. */
  posX: number
  posY: number
  /** Outline (used by the 'outline'/'hollow' effects and as a manual border). */
  strokeColor: string
  strokeWidthFrac: number
  // Highlight / background box behind the text (Canva "Background" effect)
  highlight: boolean
  highlightColor: string
  highlightOpacity: number
  /** Corner radius of the highlight box, as a fraction of font size. */
  highlightRadiusFrac: number
  // Effect preset + its accent colour (shadow/glow/neon/echo/splice colour)
  effect: TextEffect
  effectColor: string
  /** Effect intensity 0..1 (shadow distance / glow strength / echo offset). */
  effectIntensity: number
  // Entrance / exit animation
  animIn: TextAnim
  animOut: TextAnim
  /** Duration of each of the in/out animations, in seconds. */
  animDurSec: number
}

export interface TextClip extends ClipBase {
  kind: 'text'
  text: string
  style: TextStyle
}

export type Clip = MediaClip | TextClip

export interface Track {
  id: string
  type: TrackType
  name: string
  muted: boolean
  hidden: boolean
  locked: boolean
  /** Clips are kept sorted by timelineStart. */
  clips: Clip[]
}

export interface Timeline {
  /** Index 0 is the bottom-most (background) video track; higher = on top. */
  tracks: Track[]
}

/** Social copy that TRAVELS WITH the project: the post description + hashtags, the
 *  pinned "first comment", and the hook options — all produced by the /reel-ai skill
 *  and carried into the app by /reel-ai2's plan (the `set_post_meta` tool). It is NOT
 *  rendered on the video: it's saved with the project so the user can re-open a reel
 *  later and re-read / copy what to write on the post. */
export interface PostMeta {
  /** Post caption / description (keyword-rich reflection in Elisa's voice). */
  description?: string
  /** Hashtags line, e.g. "#ElisaSoulMedium #medium #aldilà". */
  hashtags?: string
  /** The pinned "first comment" — long-form reflection (the message is the focus). */
  firstComment?: string
  /** The 5 hook options from the brief (the user picks one for the post). */
  hooks?: string[]
  /** Fixed "extra description" (Elisa's book promo) appended under every video. */
  extraDescription?: string
  /** Free-form notes the user wants to keep with the reel. */
  notes?: string
}

export interface Project {
  schemaVersion: number
  id: string
  name: string
  canvas: CanvasSpec
  sources: Source[]
  timeline: Timeline
  /** Timeline markers (chapters/notes). */
  markers: Marker[]
  /** Social copy (description / first comment / hooks) re-readable later. Optional. */
  postMeta?: PostMeta
  createdAt: string
  modifiedAt: string
}

// ---------------------------------------------------------------------------
// Factories & helpers
// ---------------------------------------------------------------------------

export const ASPECT_PRESETS: Record<AspectPreset, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 }
}

export function defaultCrop(): CropRect {
  return { x: 0, y: 0, w: 1, h: 1 }
}

export function defaultTransform(): Transform {
  return { x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1, fit: 'cover', flipH: false, flipV: false }
}

export function defaultMask(): Mask {
  return { shape: 'none', x: 0.25, y: 0.25, w: 0.5, h: 0.5, feather: 0.1, invert: false }
}

export function defaultTextStyle(): TextStyle {
  return {
    fontFamily: 'Inter, -apple-system, sans-serif',
    fontSizeFrac: 0.07,
    color: '#ffffff',
    bold: true,
    italic: false,
    underline: false,
    align: 'center',
    letterSpacingFrac: 0,
    lineHeightMul: 1.2,
    opacity: 1,
    posX: 0.5,
    posY: 0.82,
    strokeColor: '#000000',
    strokeWidthFrac: 0,
    highlight: false,
    highlightColor: '#1fe6c2',
    highlightOpacity: 1,
    highlightRadiusFrac: 0.18,
    effect: 'shadow',
    effectColor: '#000000',
    effectIntensity: 0.4,
    animIn: 'none',
    animOut: 'none',
    animDurSec: 0.5
  }
}

export function createCanvas(aspect: AspectPreset = '9:16', fps = 30): CanvasSpec {
  const { width, height } = ASPECT_PRESETS[aspect]
  return { width, height, fps, backgroundColor: '#202028' }
}

function defaultTrackName(type: TrackType): string {
  return type === 'video' ? 'Video' : type === 'audio' ? 'Audio' : 'Testo'
}

export function createTrack(type: TrackType, name?: string): Track {
  return {
    id: genId('trk'),
    type,
    name: name ?? defaultTrackName(type),
    muted: false,
    hidden: false,
    locked: false,
    clips: []
  }
}

export function createProject(name = 'Senza titolo', aspect: AspectPreset = '9:16'): Project {
  const now = new Date().toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    id: genId('proj'),
    name,
    canvas: createCanvas(aspect),
    sources: [],
    timeline: {
      tracks: [createTrack('video', 'Video 1'), createTrack('audio', 'Audio 1')]
    },
    markers: [],
    createdAt: now,
    modifiedAt: now
  }
}

export function createMediaClip(opts: {
  trackId: string
  sourceId: string
  sourceIn: number
  sourceOut: number
  timelineStart: number
}): MediaClip {
  const dur = Math.max(0, opts.sourceOut - opts.sourceIn)
  return {
    id: genId('clp'),
    trackId: opts.trackId,
    kind: 'media',
    sourceId: opts.sourceId,
    sourceIn: opts.sourceIn,
    sourceOut: opts.sourceOut,
    timelineStart: opts.timelineStart,
    timelineEnd: opts.timelineStart + dur,
    speed: 1,
    crop: defaultCrop(),
    transform: defaultTransform(),
    effects: [],
    volume: 1,
    fadeInSec: 0,
    fadeOutSec: 0,
    mask: defaultMask(),
    transitionOut: null
  }
}

export function createTextClip(opts: {
  trackId: string
  text: string
  timelineStart: number
  durationSec?: number
}): TextClip {
  const dur = opts.durationSec ?? 3
  return {
    id: genId('clp'),
    trackId: opts.trackId,
    kind: 'text',
    text: opts.text,
    timelineStart: opts.timelineStart,
    timelineEnd: opts.timelineStart + dur,
    style: defaultTextStyle()
  }
}

export function clipDuration(clip: Clip): number {
  return clip.timelineEnd - clip.timelineStart
}

export function timelineDuration(timeline: Timeline): number {
  let max = 0
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.timelineEnd > max) max = clip.timelineEnd
    }
  }
  return max
}

export function isMediaClip(clip: Clip): clip is MediaClip {
  return clip.kind === 'media'
}

/** Bring an arbitrary parsed object up to the current schema version,
 *  backfilling any fields added over time so older/partial saves load safely. */
export function migrateProject(raw: unknown): Project {
  const p = raw as Project
  // Pure black (or the earlier near-black) → dark grey (the editor avoids black).
  if (p.canvas && (p.canvas.backgroundColor === '#000000' || p.canvas.backgroundColor === '#15151a'))
    p.canvas.backgroundColor = '#202028'
  for (const src of p.sources ?? []) {
    if (src.proxyPath === undefined) src.proxyPath = null
    if (src.thumbnailPath === undefined) src.thumbnailPath = null
    if (src.timelineThumbsPath === undefined) src.timelineThumbsPath = null
    if (src.timelineThumbCols === undefined) src.timelineThumbCols = null
    if (src.waveformPath === undefined) src.waveformPath = null
    if (src.videoCodec === undefined) src.videoCodec = null
    if (src.peaks === undefined) src.peaks = null
  }
  for (const track of p.timeline?.tracks ?? []) {
    for (const clip of track.clips ?? []) {
      if (clip.kind === 'text') {
        // Backfill the Canva-style style fields onto older (basic) text clips.
        const st = (clip as TextClip).style as Partial<TextStyle>
        const d = defaultTextStyle()
        for (const k of Object.keys(d) as (keyof TextStyle)[]) {
          if (st[k] === undefined) (st[k] as unknown) = d[k]
        }
        continue
      }
      if (clip.kind !== 'media') continue
      const c = clip as MediaClip
      if (c.effects == null) c.effects = []
      if (c.volume == null) c.volume = 1
      if (c.speed == null) c.speed = 1
      if (c.fadeInSec == null) c.fadeInSec = 0
      if (c.fadeOutSec == null) c.fadeOutSec = 0
      if (c.crop == null) c.crop = defaultCrop()
      if (c.transform == null) c.transform = defaultTransform()
      if (c.transform.flipH === undefined) c.transform.flipH = false
      if (c.transform.flipV === undefined) c.transform.flipV = false
      if (c.mask == null) c.mask = defaultMask()
      if (c.transitionOut === undefined) c.transitionOut = null
    }
  }
  if (!Array.isArray(p.markers)) p.markers = []
  p.schemaVersion = SCHEMA_VERSION
  return p
}
