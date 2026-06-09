import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  ASPECT_PRESETS,
  createMediaClip,
  createProject,
  createTrack,
  createTextClip,
  isMediaClip,
  migrateProject,
  timelineDuration,
  type AspectPreset,
  type Clip,
  type Effect,
  type EffectType,
  type Marker,
  type MediaClip,
  type Project,
  type Source,
  type TextClip,
  type TextStyle,
  type Track,
  type TransitionPreset,
  type TrackType
} from '@shared/projectSchema'
import type { ExportResult, ExportSettings } from '@shared/export'
import { resolveTransformAt } from '@shared/anim'
import { resolveClipLayout } from '@shared/geometry'
import { mediaUrl } from '@shared/media'
import { buildFaceTrack, detectFacesAt, type NormFace } from '../preview/faceDetect'
import { compositor } from '../preview/Compositor'
import { genId } from '@shared/ids'
import { parseSubtitles } from '@shared/subtitles'
import {
  recommendTier,
  type PerformanceTier,
  type SystemInfo
} from '@shared/performance'
import type { FfmpegCapabilities } from '@shared/capabilities'

export interface FoundClip {
  track: Track
  clip: Clip
  trackIndex: number
  clipIndex: number
}

/** Locate a clip and its position inside a project (works on plain or draft state). */
export function locateClip(project: Project, clipId: string): FoundClip | null {
  const tracks = project.timeline.tracks
  for (let ti = 0; ti < tracks.length; ti++) {
    const track = tracks[ti]
    const ci = track.clips.findIndex((c) => c.id === clipId)
    if (ci >= 0) return { track, clip: track.clips[ci], trackIndex: ti, clipIndex: ci }
  }
  return null
}

/**
 * The clips a selection-aware bulk edit should touch. When the target clip is part
 * of a real multi-selection (2+ clips, target included) the edit fans out to the
 * WHOLE selection; otherwise it stays on just that clip. This is what makes an
 * effect/filter applied (or later tweaked) from the panels hit every selected clip,
 * while single-selection and programmatic (AI) edits behave exactly as before.
 */
function bulkTargetIds(selectedClipIds: string[], clipId: string): string[] {
  return selectedClipIds.length > 1 && selectedClipIds.includes(clipId) ? selectedClipIds : [clipId]
}

/** Insert or replace a transform keyframe at time t (seconds from clip start). */
function upsertKeyframe(clip: MediaClip, t: number, tr: MediaClip['transform']): void {
  if (!clip.keyframes) clip.keyframes = []
  const snap = { x: tr.x, y: tr.y, w: tr.w, h: tr.h, rotation: tr.rotation, opacity: tr.opacity, fit: tr.fit, flipH: tr.flipH, flipV: tr.flipV }
  const idx = clip.keyframes.findIndex((k) => Math.abs(k.t - t) < 0.02)
  if (idx >= 0) clip.keyframes[idx] = { t: clip.keyframes[idx].t, transform: snap }
  else {
    clip.keyframes.push({ t, transform: snap })
    clip.keyframes.sort((a, b) => a.t - b.t)
  }
}

/** Apply a transform patch: when the clip is animated, write a keyframe at the
 *  playhead; otherwise edit the static base transform. */
function writeTransform(clip: MediaClip, patch: Partial<MediaClip['transform']>, playhead: number): void {
  if (clip.keyframes && clip.keyframes.length >= 1) {
    const dur = clip.timelineEnd - clip.timelineStart
    const t = Math.max(0, Math.min(dur, playhead - clip.timelineStart))
    upsertKeyframe(clip, t, { ...resolveTransformAt(clip, t), ...patch })
  } else {
    Object.assign(clip.transform, patch)
  }
}

interface State {
  project: Project
  systemInfo: SystemInfo | null
  capabilities: FfmpegCapabilities | null
  tier: PerformanceTier
  selectedClipId: string | null
  /** All selected clips (multi-select via marquee / shift-⌘-click). `selectedClipId`
   *  is the "primary" of this set and still drives the Inspector / preview overlays. */
  selectedClipIds: string[]
  selectedSourceId: string | null
  /** Track currently under the mouse in the timeline (so paste lands on it). */
  hoverTrackId: string | null
  /** Playhead position in seconds. */
  playhead: number
  isPlaying: boolean
  /** Timeline horizontal zoom. */
  pxPerSec: number
  /** Vertical track-height multiplier (shrink/grow the rows). */
  trackScale: number
  /** Whether the preview's move/resize handles are active. */
  transformEdit: boolean
  /** Whether the blur-region (mask) handles are active on the preview. */
  maskEdit: boolean
  past: Project[]
  future: Project[]
  /** Source ids currently generating a preview proxy. */
  proxying: string[]
  /** Face-tracking progress, or null when idle. */
  faceTracking: { done: number; total: number } | null
  /** Pending manual face pick (detected faces to choose from), or null. */
  faceSelect: { clipId: string; faces: NormFace[] } | null
  /** Live export progress, or null when not exporting. */
  exporting: { percent: number; speed: string } | null
  /** Result of the last export (for the done/error toast). */
  lastExport: ExportResult | null
  /** A copied clip, for paste. */
  clipboard: Clip | null
  /** True while the AI assistant builds a reel: commits skip per-action history so
   *  the whole build collapses to ONE undo (beginAiBuild snapshots once up front). */
  aiBuilding: boolean
}

interface Actions {
  init: () => Promise<void>
  importViaDialog: () => Promise<void>
  importPaths: (paths: string[]) => Promise<void>
  addSourceToTimeline: (sourceId: string) => void
  addSourceToTrackAt: (sourceId: string, trackId: string, startSec: number) => void
  removeSource: (sourceId: string) => void
  selectClip: (id: string | null) => void
  /** Toggle a clip in the multi-selection (shift / ⌘-click). */
  toggleClipInSelection: (id: string) => void
  /** Replace the whole multi-selection (marquee drag). */
  setSelectedClips: (ids: string[]) => void
  /** Delete every selected clip in one undoable step. */
  removeSelectedClips: () => void
  /** Remember which track the mouse is over (paste targets it). */
  setHoverTrack: (id: string | null) => void
  /** Shift every selected clip by deltaSec on the timeline (one undo). */
  moveSelectedBy: (deltaSec: number) => void
  selectSource: (id: string | null) => void
  updateClip: (clipId: string, recipe: (clip: MediaClip) => void) => void
  /** Snapshot history once (call at the start of a drag gesture). */
  beginHistory: () => void
  /** Start an AI build: snapshot once, then commits skip history until endAiBuild. */
  beginAiBuild: () => void
  /** End an AI build: subsequent commits are undoable again. */
  endAiBuild: () => void
  /** Mutate a clip WITHOUT a history entry (use during a drag, after beginHistory). */
  liveUpdateClip: (clipId: string, recipe: (clip: MediaClip) => void) => void
  /** Keyframe-aware transform write (undoable). */
  setClipTransform: (clipId: string, patch: Partial<MediaClip['transform']>) => void
  /** Keyframe-aware transform write WITHOUT history (drag; after beginHistory). */
  liveSetClipTransform: (clipId: string, patch: Partial<MediaClip['transform']>) => void
  /** Capture a transform keyframe at the playhead. */
  addKeyframe: (clipId: string) => void
  removeKeyframe: (clipId: string, t: number) => void
  clearKeyframes: (clipId: string) => void
  updateTextClip: (clipId: string, recipe: (clip: TextClip) => void) => void
  /** Text-clip update WITHOUT history (drag move/resize on the preview; after beginHistory). */
  liveUpdateTextClip: (clipId: string, recipe: (clip: TextClip) => void) => void
  removeClip: (clipId: string) => void
  /** Place a copy of the clip right after it on the same track. */
  duplicateClip: (clipId: string) => void
  copyClip: (clipId: string) => void
  /** Paste the copied clip at the playhead on a compatible track. */
  pasteClip: () => void
  /** Remove the clip and slide later clips on the same track left to close the gap. */
  rippleDelete: (clipId: string) => void
  flipClip: (clipId: string, axis: 'h' | 'v') => void
  /** Insert a ~2s freeze of the clip's current frame at the playhead (rippling right). */
  freezeFrame: (clipId: string) => Promise<void>
  addMarker: () => void
  removeMarker: (id: string) => void
  splitAtPlayhead: () => void
  moveClip: (clipId: string, newStart: number, newTrackId?: string) => void
  trimClip: (clipId: string, edge: 'start' | 'end', deltaSec: number) => void
  addTrack: (type: TrackType) => void
  /** Start a fresh empty timeline, keeping the imported media library. Undoable. */
  newProject: () => void
  /** Save the project to a .videoai file (native dialog). */
  saveProject: () => Promise<void>
  /** Open a .videoai file, replacing the current project. */
  openProject: () => Promise<void>
  removeTrack: (trackId: string) => void
  moveTrack: (trackId: string, dir: 'up' | 'down') => void
  toggleTrackMuted: (trackId: string) => void
  setTrackScale: (scale: number) => void
  toggleTransformEdit: () => void
  toggleMaskEdit: () => void
  makeTwoPersonStack: (clipId: string) => void
  makeBlurRegion: (clipId: string) => void
  /** Auto-detect the speaking face and add a blur overlay that follows it. */
  trackFaceBlur: (clipId: string, seed?: { cx: number; cy: number }) => Promise<void>
  /** Detect faces at the playhead and, if several, ask which one to track. */
  beginFaceSelect: (clipId: string) => Promise<void>
  /** Track the face the user picked from the selection overlay. */
  pickFace: (index: number) => void
  cancelFaceSelect: () => void
  setMask: (clipId: string, patch: Partial<MediaClip['mask']>) => void
  /** Chroma key: pass a patch to enable/update, or null to remove it. */
  setChroma: (clipId: string, patch: Partial<{ keyColor: string; similarity: number; blend: number }> | null) => void
  setLut: (clipId: string, path: string | null) => void
  /** Pick a .cube LUT file and apply it to the clip. */
  importLut: (clipId: string) => Promise<void>
  /** Apply a one-click colour "look" (id from shared/looks.ts), or 'none'/null to clear. */
  setLook: (clipId: string, id: string | null, intensity?: number) => void
  addTextClip: (text: string, stylePatch?: Partial<TextStyle>) => void
  /** Add many timed subtitle clips at once (from manual entry or an imported file). */
  addSubtitles: (segments: { start: number; end: number; text: string }[]) => void
  /** Open and import an SRT/VTT subtitle file as timed text clips. */
  importSubtitles: () => Promise<void>
  addEffect: (clipId: string, type: EffectType, params?: Record<string, number>) => void
  removeEffect: (clipId: string, effectId: string) => void
  updateEffect: (clipId: string, effectId: string, params: Record<string, number>) => void
  setFade: (clipId: string, edge: 'in' | 'out', sec: number) => void
  /** Apply a transition out of this clip into the next (overlaps them). */
  applyTransition: (clipId: string, durationSec: number, preset?: TransitionPreset) => void
  removeTransition: (clipId: string) => void
  /** Set playback speed (0.1–10); rescales the clip's timeline duration. */
  setSpeed: (clipId: string, speed: number) => void
  toggleReverse: (clipId: string) => void
  /** Detach a video clip's audio onto its own audio track (and mute the video's). */
  extractAudio: (clipId: string) => void
  toggleClipAudioFlag: (clipId: string, flag: 'mutedAudio' | 'denoise' | 'duck') => void
  /** Place timeline markers on detected beats within the clip's span. */
  detectBeats: (clipId: string) => void
  setPlayhead: (t: number) => void
  togglePlay: () => void
  setPlaying: (p: boolean) => void
  setZoom: (px: number) => void
  setAspect: (a: AspectPreset) => void
  setTier: (t: PerformanceTier) => void
  canUndo: () => boolean
  canRedo: () => boolean
  undo: () => void
  redo: () => void
  startExport: (settings?: ExportSettings) => Promise<void>
  /** Slow, exact export: render every frame via the preview engine, then encode. */
  startHifiExport: (settings?: ExportSettings) => Promise<void>
  cancelExport: () => void
  dismissExport: () => void
}

export type EditorStore = State & Actions

const HISTORY_LIMIT = 80
const PERSIST_KEY = 'videoai:project'

function defaultEffectParams(type: EffectType): Record<string, number> {
  switch (type) {
    case 'gblur':
      return { sigma: 8 }
    case 'sepia':
      return { value: 0.6 }
    case 'grayscale':
      return { value: 1 }
    case 'sharpen':
      return { value: 1 }
    case 'vignette':
      return { value: 0.5 }
    case 'grain':
      return { value: 0.3 }
    default:
      return { value: 0 }
  }
}

/** Insert a new track. Text tracks go to the TOP of the timeline (row 0) so titles
 *  are easy to find/cut Canva-style — text always composites on top regardless of
 *  track order anyway. Video tracks go just above existing video; audio to the end. */
function insertTrack(project: Project, type: TrackType): Track {
  const track = createTrack(type)
  if (type === 'audio') {
    project.timeline.tracks.push(track)
  } else if (type === 'text') {
    project.timeline.tracks.unshift(track)
  } else {
    const lastVideo = project.timeline.tracks.reduce((acc, t, i) => (t.type === 'video' ? i : acc), -1)
    project.timeline.tracks.splice(lastVideo + 1, 0, track)
  }
  return track
}

/**
 * Canva-style placement: clips of the same type NEVER overlap on a track. Returns the
 * first same-type track where [start,end) is free — the preferred one if possible,
 * else any other same-type track, else a brand-new track (so overlaps stack vertically).
 */
function freeTrackFor(
  project: Project,
  type: TrackType,
  start: number,
  end: number,
  preferredId?: string,
  excludeClipId?: string
): Track {
  const eps = 0.0015
  const free = (t: Track): boolean =>
    t.type === type &&
    !t.clips.some((c) => c.id !== excludeClipId && c.timelineStart < end - eps && c.timelineEnd > start + eps)
  const pref = preferredId ? project.timeline.tracks.find((t) => t.id === preferredId) : undefined
  if (pref && free(pref)) return pref
  for (const t of project.timeline.tracks) if (t !== pref && free(t)) return t
  return insertTrack(project, type)
}

/** Load the last session's project so reloads/restarts don't lose work. */
function loadPersistedProject(): Project {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (raw) return migrateProject(JSON.parse(raw))
  } catch (e) {
    console.warn('Could not load persisted project', e)
  }
  return createProject('Senza titolo', '9:16')
}

export const useEditor = create<EditorStore>()(
  immer((set, get) => {
    /** Apply a mutation as an undoable transaction. */
    const commit = (mutator: (s: State) => void): void => {
      // During an AI build, skip per-action history so the entire build is a single
      // undo (beginAiBuild already pushed one snapshot). Behaviour is unchanged otherwise.
      if (get().aiBuilding) {
        set((s) => {
          mutator(s as unknown as State)
          s.project.modifiedAt = new Date().toISOString()
        })
        return
      }
      const prev = structuredClone(get().project)
      set((s) => {
        s.past.push(prev)
        if (s.past.length > HISTORY_LIMIT) s.past.shift()
        s.future = []
        mutator(s as unknown as State)
        s.project.modifiedAt = new Date().toISOString()
      })
    }

    /** Generate poster + timeline filmstrip for one source (background). */
    const genThumbs = (srcId: string, readPath: string, dur: number, keyPath: string): void => {
      window.api
        .generateThumbnails(readPath, dur, keyPath)
        .then((r) =>
          set((s) => {
            const so = s.project.sources.find((x) => x.id === srcId)
            if (so) {
              so.thumbnailPath = r.posterPath
              so.timelineThumbsPath = r.stripPath
              so.timelineThumbCols = r.stripCols
            }
          })
        )
        .catch(() => undefined)
    }

    /** Generate derived assets (preview proxy + thumbnails) for sources, in the
     *  background. Videos get a 540p proxy first, then thumbnails read from it
     *  (fast decode, codec-safe); images are their own thumbnail. */
    const kickMedia = (srcs: Source[]): void => {
      for (const src of srcs) {
        if (src.kind === 'image') {
          set((s) => {
            const so = s.project.sources.find((x) => x.id === src.id)
            if (so) {
              so.thumbnailPath = so.path
              so.timelineThumbsPath = so.path
              so.timelineThumbCols = 1
            }
          })
          continue
        }
        if (src.kind !== 'video') continue
        // Thumbnails read the original directly (hardware-decoded) so cached
        // strips appear instantly on restart, independent of the slower proxy.
        genThumbs(src.id, src.path, src.durationSec, src.path)
        set((s) => {
          if (!s.proxying.includes(src.id)) s.proxying.push(src.id)
        })
        window.api
          .generateProxy(src.path)
          .then((proxyPath) =>
            set((s) => {
              const so = s.project.sources.find((x) => x.id === src.id)
              if (so) so.proxyPath = proxyPath
              s.proxying = s.proxying.filter((id) => id !== src.id)
            })
          )
          .catch(() =>
            set((s) => {
              s.proxying = s.proxying.filter((id) => id !== src.id)
            })
          )
      }
    }

    return {
      project: loadPersistedProject(),
      systemInfo: null,
      capabilities: null,
      tier: 'balanced',
      selectedClipId: null,
      selectedClipIds: [],
      selectedSourceId: null,
      hoverTrackId: null,
      playhead: 0,
      isPlaying: false,
      pxPerSec: 60,
      trackScale: 1,
      transformEdit: false,
      maskEdit: false,
      past: [],
      future: [],
      proxying: [],
      faceTracking: null,
      faceSelect: null,
      exporting: null,
      lastExport: null,
      clipboard: null,
      aiBuilding: false,

      init: async () => {
        try {
          const [systemInfo, capabilities] = await Promise.all([
            window.api.getSystemInfo(),
            window.api.getCapabilities()
          ])
          set((s) => {
            s.systemInfo = systemInfo
            s.capabilities = capabilities
            s.tier = recommendTier(systemInfo.totalMemBytes, systemInfo.cpuCount)
          })
        } catch (e) {
          console.error('init() failed', e)
        }
        for (const src of get().project.sources) {
          if (!src.hasAudio || src.peaks) continue
          window.api
            .getPeaks(src.path)
            .then((peaks) => {
              set((s) => {
                const so = s.project.sources.find((x) => x.id === src.id)
                if (so) so.peaks = peaks
              })
            })
            .catch(() => undefined)
        }
        // Clear persisted proxy/thumb paths (the temp files may be gone) and
        // rebuild; the generators are cached, so existing assets return instantly.
        set((s) => {
          for (const so of s.project.sources) {
            so.proxyPath = null
            so.thumbnailPath = null
            so.timelineThumbsPath = null
            so.timelineThumbCols = null
          }
        })
        kickMedia(get().project.sources)
      },

      importViaDialog: async () => {
        const paths = await window.api.openMediaDialog()
        if (paths.length) await get().importPaths(paths)
      },

      importPaths: async (paths) => {
        const probed = await Promise.allSettled(paths.map((p) => window.api.probeMedia(p)))
        const sources = probed
          .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof window.api.probeMedia>>> =>
            r.status === 'fulfilled'
          )
          .map((r) => r.value)
        set((s) => {
          for (const src of sources) {
            if (!s.project.sources.some((x) => x.path === src.path)) {
              s.project.sources.push(src)
            }
          }
        })
        for (const src of sources) {
          if (!src.hasAudio) continue
          window.api
            .getPeaks(src.path)
            .then((peaks) => {
              set((s) => {
                const so = s.project.sources.find((x) => x.id === src.id)
                if (so) so.peaks = peaks
              })
            })
            .catch(() => undefined)
        }
        kickMedia(sources)
      },

      addSourceToTimeline: (sourceId) => {
        const src = get().project.sources.find((s) => s.id === sourceId)
        if (!src) return
        commit((s) => {
          const wantType = src.kind === 'audio' ? 'audio' : 'video'
          let track = s.project.timeline.tracks.find((t) => t.type === wantType)
          if (!track) {
            track = createTrack(wantType)
            s.project.timeline.tracks.push(track)
          }
          const start = track.clips.reduce((m, c) => Math.max(m, c.timelineEnd), 0)
          const dur = src.kind === 'image' || src.durationSec <= 0 ? 5 : src.durationSec
          const clip = createMediaClip({
            trackId: track.id,
            sourceId: src.id,
            sourceIn: 0,
            sourceOut: dur,
            timelineStart: start
          })
          track.clips.push(clip)
          s.selectedClipId = clip.id
        })
      },

      addSourceToTrackAt: (sourceId, trackId, startSec) => {
        commit((s) => {
          const src = s.project.sources.find((x) => x.id === sourceId)
          const track = s.project.timeline.tracks.find((t) => t.id === trackId)
          if (!src || !track) return
          // Video/image go on video tracks, audio on audio tracks.
          if ((track.type === 'audio') !== (src.kind === 'audio')) return
          const dur = src.kind === 'image' || src.durationSec <= 0 ? 5 : src.durationSec
          const clip = createMediaClip({
            trackId: track.id,
            sourceId: src.id,
            sourceIn: 0,
            sourceOut: dur,
            timelineStart: Math.max(0, startSec)
          })
          track.clips.push(clip)
          track.clips.sort((a, b) => a.timelineStart - b.timelineStart)
          s.selectedClipId = clip.id
        })
      },

      removeSource: (sourceId) => {
        commit((s) => {
          s.project.sources = s.project.sources.filter((x) => x.id !== sourceId)
          for (const track of s.project.timeline.tracks) {
            track.clips = track.clips.filter((c) => !(isMediaClip(c) && c.sourceId === sourceId))
          }
          if (s.selectedSourceId === sourceId) s.selectedSourceId = null
          if (s.selectedClipId && !locateClip(s.project, s.selectedClipId)) s.selectedClipId = null
        })
      },

      selectClip: (id) =>
        set((s) => {
          s.selectedClipId = id
          s.selectedClipIds = id ? [id] : []
        }),
      toggleClipInSelection: (id) =>
        set((s) => {
          const i = s.selectedClipIds.indexOf(id)
          if (i >= 0) {
            s.selectedClipIds.splice(i, 1)
            s.selectedClipId = s.selectedClipIds[s.selectedClipIds.length - 1] ?? null
          } else {
            s.selectedClipIds.push(id)
            s.selectedClipId = id
          }
        }),
      setSelectedClips: (ids) =>
        set((s) => {
          s.selectedClipIds = [...ids]
          s.selectedClipId = ids.length ? ids[ids.length - 1] : null
        }),
      removeSelectedClips: () => {
        const ids = get().selectedClipIds
        if (!ids.length) return
        commit((s) => {
          const sel = new Set(ids)
          for (const track of s.project.timeline.tracks) {
            track.clips = track.clips.filter((c) => !sel.has(c.id))
          }
          s.selectedClipId = null
          s.selectedClipIds = []
        })
      },
      moveSelectedBy: (deltaSec) => {
        const ids = get().selectedClipIds
        if (!ids.length || !deltaSec) return
        commit((s) => {
          const sel = new Set(ids)
          // Clamp the shift so no selected clip is pushed before 0.
          let d = deltaSec
          for (const t of s.project.timeline.tracks)
            for (const c of t.clips) if (sel.has(c.id)) d = Math.max(d, -c.timelineStart)
          for (const t of s.project.timeline.tracks) {
            for (const c of t.clips)
              if (sel.has(c.id)) {
                c.timelineStart += d
                c.timelineEnd += d
              }
            t.clips.sort((a, b) => a.timelineStart - b.timelineStart)
          }
        })
      },
      selectSource: (id) => set((s) => void (s.selectedSourceId = id)),

      setHoverTrack: (id) => set((s) => void (s.hoverTrackId = id)),

      updateClip: (clipId, recipe) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (loc && isMediaClip(loc.clip)) recipe(loc.clip)
        })
      },

      beginHistory: () => {
        const prev = structuredClone(get().project)
        set((s) => {
          s.past.push(prev)
          if (s.past.length > HISTORY_LIMIT) s.past.shift()
          s.future = []
        })
      },

      beginAiBuild: () => {
        const prev = structuredClone(get().project)
        set((s) => {
          s.past.push(prev)
          if (s.past.length > HISTORY_LIMIT) s.past.shift()
          s.future = []
          s.aiBuilding = true
        })
      },
      endAiBuild: () => set((s) => void (s.aiBuilding = false)),

      liveUpdateClip: (clipId, recipe) => {
        set((s) => {
          const loc = locateClip(s.project, clipId)
          if (loc && isMediaClip(loc.clip)) recipe(loc.clip)
          s.project.modifiedAt = new Date().toISOString()
        })
      },

      liveUpdateTextClip: (clipId, recipe) => {
        set((s) => {
          const loc = locateClip(s.project, clipId)
          if (loc && loc.clip.kind === 'text') recipe(loc.clip as TextClip)
          s.project.modifiedAt = new Date().toISOString()
        })
      },

      setClipTransform: (clipId, patch) => {
        const playhead = get().playhead
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (loc && isMediaClip(loc.clip)) writeTransform(loc.clip, patch, playhead)
        })
      },

      liveSetClipTransform: (clipId, patch) => {
        const playhead = get().playhead
        set((s) => {
          const loc = locateClip(s.project, clipId)
          if (loc && isMediaClip(loc.clip)) writeTransform(loc.clip, patch, playhead)
          s.project.modifiedAt = new Date().toISOString()
        })
      },

      addKeyframe: (clipId) => {
        const playhead = get().playhead
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (!loc || !isMediaClip(loc.clip)) return
          const clip = loc.clip
          const dur = clip.timelineEnd - clip.timelineStart
          const t = Math.max(0, Math.min(dur, playhead - clip.timelineStart))
          upsertKeyframe(clip, t, resolveTransformAt(clip, t))
        })
      },

      removeKeyframe: (clipId, t) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (loc && isMediaClip(loc.clip) && loc.clip.keyframes) {
            loc.clip.keyframes = loc.clip.keyframes.filter((k) => Math.abs(k.t - t) > 0.001)
          }
        })
      },

      clearKeyframes: (clipId) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (loc && isMediaClip(loc.clip)) loc.clip.keyframes = []
        })
      },

      removeClip: (clipId) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (!loc) return
          s.project.timeline.tracks[loc.trackIndex].clips.splice(loc.clipIndex, 1)
          if (s.selectedClipId === clipId) s.selectedClipId = null
          s.selectedClipIds = s.selectedClipIds.filter((id) => id !== clipId)
        })
      },

      duplicateClip: (clipId) => {
        const src = locateClip(get().project, clipId)
        if (!src) return
        const orig = structuredClone(src.clip)
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (!loc) return
          const dur = orig.timelineEnd - orig.timelineStart
          const at = orig.timelineEnd
          // RIPPLE: push every later clip on this track right by `dur` to make room.
          for (const c of loc.track.clips)
            if (c.id !== clipId && c.timelineStart >= at - 0.0015) {
              c.timelineStart += dur
              c.timelineEnd += dur
            }
          const copy: Clip = { ...orig, id: genId('clp'), timelineStart: at, timelineEnd: at + dur }
          loc.track.clips.splice(loc.clipIndex + 1, 0, copy)
          loc.track.clips.sort((a, b) => a.timelineStart - b.timelineStart)
          s.selectedClipId = copy.id
          s.selectedClipIds = [copy.id]
        })
      },

      copyClip: (clipId) => {
        const loc = locateClip(get().project, clipId)
        if (loc) set((s) => void (s.clipboard = structuredClone(loc.clip)))
      },

      pasteClip: () => {
        const clip = get().clipboard
        if (!clip) return
        const start = Math.max(0, get().playhead) // exactly at the red playhead line
        const hoverId = get().hoverTrackId // the track the mouse is over
        commit((s) => {
          const type: TrackType =
            clip.kind === 'text'
              ? 'text'
              : s.project.sources.find((x) => x.id === (clip as MediaClip).sourceId)?.hasVideo === false
                ? 'audio'
                : 'video'
          const dur = clip.timelineEnd - clip.timelineStart
          const copy: Clip = {
            ...structuredClone(clip),
            id: genId('clp'),
            timelineStart: start,
            timelineEnd: start + dur
          }
          const hover = hoverId ? s.project.timeline.tracks.find((t) => t.id === hoverId) : undefined
          const dest = freeTrackFor(s.project, type, start, start + dur, hover?.type === type ? hover.id : undefined)
          copy.trackId = dest.id
          dest.clips.push(copy)
          dest.clips.sort((a, b) => a.timelineStart - b.timelineStart)
          s.selectedClipId = copy.id
          s.selectedClipIds = [copy.id]
        })
      },

      rippleDelete: (clipId) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (!loc) return
          const dur = loc.clip.timelineEnd - loc.clip.timelineStart
          const from = loc.clip.timelineStart
          loc.track.clips.splice(loc.clipIndex, 1)
          for (const c of loc.track.clips) {
            if (c.timelineStart >= from) {
              c.timelineStart = Math.max(0, c.timelineStart - dur)
              c.timelineEnd = Math.max(0, c.timelineEnd - dur)
            }
          }
          if (s.selectedClipId === clipId) s.selectedClipId = null
          s.selectedClipIds = s.selectedClipIds.filter((id) => id !== clipId)
        })
      },

      flipClip: (clipId, axis) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (loc && isMediaClip(loc.clip)) {
            if (axis === 'h') loc.clip.transform.flipH = !loc.clip.transform.flipH
            else loc.clip.transform.flipV = !loc.clip.transform.flipV
          }
        })
      },

      freezeFrame: async (clipId) => {
        const loc = locateClip(get().project, clipId)
        if (!loc || !isMediaClip(loc.clip)) return
        const clip = loc.clip
        const src = get().project.sources.find((x) => x.id === clip.sourceId)
        if (!src || src.kind !== 'video') return
        const playhead = get().playhead
        if (playhead <= clip.timelineStart || playhead >= clip.timelineEnd) return
        const srcT = clip.sourceIn + (playhead - clip.timelineStart) * clip.speed
        const HOLD = 2
        let pngPath: string
        try {
          pngPath = await window.api.extractFrame(src.path, srcT)
        } catch {
          return
        }
        const imgSrc = await window.api.probeMedia(pngPath)
        set((s) => {
          if (!s.project.sources.some((x) => x.path === imgSrc.path)) s.project.sources.push(imgSrc)
        })
        commit((s) => {
          const l = locateClip(s.project, clipId)
          if (!l || !isMediaClip(l.clip)) return
          const c = l.clip
          // Split at the playhead, ripple the right side + everything after by HOLD,
          // and drop a frozen still in the gap.
          const rightStart = playhead + HOLD
          const tailDur = c.timelineEnd - playhead
          const srcSplit = c.sourceIn + (playhead - c.timelineStart) * c.speed
          const right: MediaClip = {
            ...structuredClone(c),
            id: genId('clp'),
            timelineStart: rightStart,
            timelineEnd: rightStart + tailDur,
            sourceIn: srcSplit
          }
          c.timelineEnd = playhead
          c.sourceOut = srcSplit
          for (const other of l.track.clips) {
            if (other.id !== c.id && other.timelineStart >= playhead) {
              other.timelineStart += HOLD
              other.timelineEnd += HOLD
            }
          }
          const still: MediaClip = {
            ...createMediaClip({ trackId: l.track.id, sourceId: imgSrc.id, sourceIn: 0, sourceOut: HOLD, timelineStart: playhead }),
            timelineEnd: playhead + HOLD,
            freeze: true,
            transform: structuredClone(c.transform)
          }
          l.track.clips.push(right, still)
          l.track.clips.sort((a, b) => a.timelineStart - b.timelineStart)
          s.selectedClipId = still.id
        })
      },

      addMarker: () => {
        commit((s) => {
          s.project.markers.push({ id: genId('mk'), t: get().playhead, label: '', color: '#1fe6c2' })
        })
      },

      removeMarker: (id) => {
        commit((s) => void (s.project.markers = s.project.markers.filter((m) => m.id !== id)))
      },

      splitAtPlayhead: () => {
        const { playhead, selectedClipId } = get()
        const proj = get().project
        // Cut every media clip the playhead crosses (scissors tool), so it
        // works wherever the line is — no clip needs to be selected first.
        const ids: string[] = []
        for (const t of proj.timeline.tracks) {
          for (const c of t.clips) {
            // Cut media AND text clips the playhead crosses, so you can split a title
            // and delete part of it (scissors tool).
            if (playhead > c.timelineStart && playhead < c.timelineEnd) ids.push(c.id)
          }
        }
        if (!ids.length) return
        // Snapshot originals (plain clones; structuredClone can't clone a draft).
        const origs = new Map<string, Clip>()
        for (const id of ids) {
          const loc = locateClip(proj, id)
          if (loc) origs.set(id, structuredClone(loc.clip))
        }
        commit((s) => {
          let nextSelected = selectedClipId
          for (const id of ids) {
            const loc = locateClip(s.project, id)
            const orig = origs.get(id)
            if (!loc || !orig) continue
            const clip = loc.clip
            let right: Clip
            if (isMediaClip(clip) && orig.kind === 'media') {
              const srcSplit = clip.sourceIn + (playhead - clip.timelineStart) * clip.speed
              right = {
                ...orig,
                id: genId('clp'),
                timelineStart: playhead,
                sourceIn: srcSplit,
                transitionOut: null
              }
              clip.timelineEnd = playhead
              clip.sourceOut = srcSplit
              clip.transitionOut = null
            } else {
              // Text clip: split the time span; both halves keep the same text/style.
              right = { ...orig, id: genId('clp'), timelineStart: playhead }
              clip.timelineEnd = playhead
            }
            loc.track.clips.splice(loc.clipIndex + 1, 0, right)
            if (selectedClipId === id) nextSelected = right.id
          }
          s.selectedClipId = nextSelected
        })
      },

      moveClip: (clipId, newStart, newTrackId) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (!loc) return
          const c = loc.clip
          const type = loc.track.type
          const dur = c.timelineEnd - c.timelineStart
          const start = Math.max(0, newStart)
          // Pull the clip out, then re-place it WITHOUT overlap: the requested track if
          // free, otherwise another same-type track, otherwise a new one (Canva-style —
          // two clips can never sit on top of each other on the same track).
          loc.track.clips.splice(loc.clipIndex, 1)
          c.timelineStart = start
          c.timelineEnd = start + dur
          const wantId =
            newTrackId && s.project.timeline.tracks.find((t) => t.id === newTrackId)?.type === type
              ? newTrackId
              : loc.track.id
          const dest = freeTrackFor(s.project, type, start, start + dur, wantId, c.id)
          c.trackId = dest.id
          dest.clips.push(c)
          dest.clips.sort((a, b) => a.timelineStart - b.timelineStart)
        })
      },

      trimClip: (clipId, edge, deltaSec) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (!loc || !isMediaClip(loc.clip)) return
          const c = loc.clip
          const siblings = loc.track.clips
          if (edge === 'start') {
            // Lengthening leftwards stops at the previous clip on the track (a trim
            // never creates an overlap — only dragging a clip does); shortening can't
            // cross this clip's own end.
            const prevEnd = siblings
              .filter((x) => x.id !== c.id && x.timelineStart < c.timelineStart)
              .reduce((m, x) => Math.max(m, x.timelineEnd), 0)
            const newStart = Math.min(c.timelineEnd - 0.05, Math.max(prevEnd, c.timelineStart + deltaSec))
            c.sourceIn = Math.max(0, c.sourceIn + (newStart - c.timelineStart) * c.speed)
            c.timelineStart = newStart
          } else {
            const oldEnd = c.timelineEnd
            const newEnd = Math.max(c.timelineStart + 0.05, oldEnd + deltaSec)
            const delta = newEnd - oldEnd
            c.sourceOut = c.sourceOut + delta * c.speed
            c.timelineEnd = newEnd
            // RIPPLE: every clip that started at/after this clip's old end shifts by the
            // same delta, so the following sections move WITH the lengthening/shortening
            // instead of being overlapped. To overlap on purpose, drag a clip normally.
            for (const other of siblings) {
              if (other.id !== c.id && other.timelineStart >= oldEnd - 1e-4) {
                other.timelineStart += delta
                other.timelineEnd += delta
              }
            }
          }
          siblings.sort((a, b) => a.timelineStart - b.timelineStart)
        })
      },

      updateTextClip: (clipId, recipe) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (loc && loc.clip.kind === 'text') recipe(loc.clip)
        })
      },

      addTrack: (type) => {
        commit((s) => {
          insertTrack(s.project, type)
        })
      },

      newProject: () => {
        commit((s) => {
          // Wipe the timeline back to one empty video + audio track, but keep the
          // imported sources so the media library is preserved. Undoable.
          s.project.timeline = { tracks: [createTrack('video', 'Video 1'), createTrack('audio', 'Audio 1')] }
          s.selectedClipId = null
          s.transformEdit = false
          s.maskEdit = false
        })
        set((s) => void (s.playhead = 0))
      },

      saveProject: async () => {
        const project = get().project
        try {
          await window.api.saveProjectFile(JSON.stringify(project), project.name)
        } catch (e) {
          console.warn('Salvataggio progetto fallito', e)
        }
      },

      openProject: async () => {
        try {
          const res = await window.api.openProjectFile()
          if (!res) return
          const parsed = migrateProject(JSON.parse(res.json))
          // Temp-file paths from the saving machine are stale; clear & rebuild them.
          for (const so of parsed.sources) {
            so.proxyPath = null
            so.thumbnailPath = null
            so.timelineThumbsPath = null
            so.timelineThumbCols = null
          }
          set((s) => {
            s.project = parsed
            s.past = []
            s.future = []
            s.selectedClipId = null
            s.playhead = 0
            s.isPlaying = false
          })
          kickMedia(get().project.sources)
        } catch (e) {
          console.warn('Apertura progetto fallita', e)
        }
      },

      removeTrack: (trackId) => {
        commit((s) => {
          s.project.timeline.tracks = s.project.timeline.tracks.filter((t) => t.id !== trackId)
          if (s.project.timeline.tracks.length === 0) s.project.timeline.tracks.push(createTrack('video', 'Video 1'))
          const stillThere = s.selectedClipId ? locateClip(s.project, s.selectedClipId) : null
          if (!stillThere) s.selectedClipId = null
        })
      },

      toggleTrackMuted: (trackId) => {
        commit((s) => {
          const t = s.project.timeline.tracks.find((x) => x.id === trackId)
          if (t) t.muted = !t.muted
        })
      },

      moveTrack: (trackId, dir) => {
        commit((s) => {
          const ts = s.project.timeline.tracks
          const i = ts.findIndex((t) => t.id === trackId)
          if (i < 0) return
          const j = dir === 'up' ? i - 1 : i + 1
          if (j < 0 || j >= ts.length) return
          const [moved] = ts.splice(i, 1)
          ts.splice(j, 0, moved)
        })
      },

      setTrackScale: (scale) => set((s) => void (s.trackScale = Math.max(0.55, Math.min(1.8, scale)))),

      toggleTransformEdit: () => set((s) => void (s.transformEdit = !s.transformEdit)),

      toggleMaskEdit: () => set((s) => void (s.maskEdit = !s.maskEdit)),

      makeTwoPersonStack: (clipId) => {
        const cur = locateClip(get().project, clipId)
        if (!cur || !isMediaClip(cur.clip)) return
        const orig = structuredClone(cur.clip)
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (!loc || !isMediaClip(loc.clip)) return
          loc.clip.crop = { x: 0, y: 0, w: 0.5, h: 1 }
          loc.clip.transform = { ...loc.clip.transform, x: 0, y: 0, w: 1, h: 0.5, fit: 'cover' }

          let overlay = s.project.timeline.tracks.find((t) => t.type === 'video' && t.id !== loc.track.id)
          if (!overlay) overlay = insertTrack(s.project, 'video')

          const bottom: MediaClip = {
            ...orig,
            id: genId('clp'),
            trackId: overlay.id,
            crop: { x: 0.5, y: 0, w: 0.5, h: 1 },
            transform: { ...orig.transform, x: 0, y: 0.5, w: 1, h: 0.5, fit: 'cover' }
          }
          overlay.clips.push(bottom)
          s.selectedClipId = bottom.id
        })
      },

      makeBlurRegion: (clipId) => {
        const cur = locateClip(get().project, clipId)
        if (!cur || !isMediaClip(cur.clip)) return
        const orig = structuredClone(cur.clip)
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (!loc || !isMediaClip(loc.clip)) return
          // Put the blur on a NEW track ABOVE the source (lower index = in front).
          const overlay = createTrack('video')
          s.project.timeline.tracks.splice(loc.trackIndex, 0, overlay)
          const dup: MediaClip = {
            ...orig,
            id: genId('clp'),
            trackId: overlay.id,
            effects: [...orig.effects, { id: genId('fx'), type: 'gblur', enabled: true, params: { sigma: 18 } }],
            mask: { shape: 'ellipse', x: 0.35, y: 0.35, w: 0.3, h: 0.3, feather: 0.3, invert: false }
          }
          overlay.clips.push(dup)
          s.selectedClipId = dup.id
        })
      },

      beginFaceSelect: async (clipId) => {
        const proj = get().project
        const loc = locateClip(proj, clipId)
        if (!loc || !isMediaClip(loc.clip)) return
        const clip = loc.clip
        const src = proj.sources.find((x) => x.id === clip.sourceId)
        if (!src || !src.hasVideo) return
        const srcT = clip.sourceIn + (get().playhead - clip.timelineStart) * (clip.speed || 1)
        const url = mediaUrl(src.proxyPath ?? src.path)
        let faces: NormFace[] = []
        try {
          faces = await detectFacesAt(url, Math.max(clip.sourceIn, Math.min(clip.sourceOut, srcT)))
        } catch {
          /* none */
        }
        if (faces.length <= 1) {
          // Nothing to choose — just track the (only/largest) face directly.
          void get().trackFaceBlur(clipId, faces[0] ? { cx: faces[0].cx, cy: faces[0].cy } : undefined)
          return
        }
        set((s) => void (s.faceSelect = { clipId, faces }))
      },

      pickFace: (index) => {
        const fs = get().faceSelect
        if (!fs) return
        const f = fs.faces[index]
        set((s) => void (s.faceSelect = null))
        if (f) void get().trackFaceBlur(fs.clipId, { cx: f.cx, cy: f.cy })
      },

      cancelFaceSelect: () => set((s) => void (s.faceSelect = null)),

      trackFaceBlur: async (clipId, seed) => {
        const proj = get().project
        const loc = locateClip(proj, clipId)
        if (!loc || !isMediaClip(loc.clip)) return
        const clip = loc.clip
        const src = proj.sources.find((x) => x.id === clip.sourceId)
        if (!src || !src.hasVideo) return
        const W = proj.canvas.width
        const H = proj.canvas.height
        const url = mediaUrl(src.proxyPath ?? src.path)
        const dur = Math.max(0.5, clip.sourceOut - clip.sourceIn)
        const n = Math.max(6, Math.min(40, Math.round(dur)))
        const times = Array.from({ length: n }, (_, i) => clip.sourceIn + ((i + 0.5) * dur) / n)
        set((s) => void (s.faceTracking = { done: 0, total: n }))
        let track: Awaited<ReturnType<typeof buildFaceTrack>>
        try {
          track = await buildFaceTrack(
            url,
            times,
            (done, total) => set((s) => void (s.faceTracking = { done, total })),
            seed
          )
        } catch {
          set((s) => void (s.faceTracking = null))
          return
        }
        set((s) => void (s.faceTracking = null))
        if (!track.length) return // no face found

        // Map source-normalized face boxes through the clip's crop+transform to a
        // canvas-normalized ellipse (enlarged to cover the whole face).
        const layout = resolveClipLayout(clip.crop, clip.transform, src.width, src.height, W, H)
        const sr = layout.sourceRect
        const cr = layout.contentRect
        const ENLARGE = 1.7
        const maskKeyframes = track.map((p) => {
          const cxPx = cr.x + ((p.cx * src.width - sr.x) / sr.w) * cr.w
          const cyPx = cr.y + ((p.cy * src.height - sr.y) / sr.h) * cr.h
          const wn = Math.min(1.2, ((p.w * src.width) / sr.w) * (cr.w / W) * ENLARGE)
          const hn = Math.min(1.2, ((p.h * src.height) / sr.h) * (cr.h / H) * ENLARGE)
          return {
            t: (p.t - clip.sourceIn) / clip.speed,
            mask: {
              shape: 'ellipse' as const,
              x: cxPx / W - wn / 2,
              y: cyPx / H - hn / 2,
              w: wn,
              h: hn,
              feather: 0.4,
              invert: false
            }
          }
        })

        const orig = structuredClone(clip)
        commit((s) => {
          const l = locateClip(s.project, clipId)
          if (!l || !isMediaClip(l.clip)) return
          // Blur overlay on a NEW track ABOVE the source (lower index = in front).
          const overlay = createTrack('video')
          s.project.timeline.tracks.splice(l.trackIndex, 0, overlay)
          const dup: MediaClip = {
            ...orig,
            id: genId('clp'),
            trackId: overlay.id,
            effects: [
              ...orig.effects.filter((e) => e.type !== 'gblur'),
              { id: genId('fx'), type: 'gblur', enabled: true, params: { sigma: 22 } }
            ],
            mask: { ...maskKeyframes[0].mask },
            maskKeyframes,
            keyframes: undefined
          }
          overlay.clips.push(dup)
          s.selectedClipId = dup.id
        })
      },

      setMask: (clipId, patch) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (loc && isMediaClip(loc.clip)) Object.assign(loc.clip.mask, patch)
        })
      },

      addTextClip: (text, stylePatch) => {
        commit((s) => {
          let track = s.project.timeline.tracks.find((t) => t.type === 'text')
          if (!track) track = insertTrack(s.project, 'text')
          // Canva-style: text spans the whole track by default (playhead → end), so
          // you trim/split+delete to make it stop, rather than stretch a tiny clip.
          const start = get().playhead
          const end = Math.max(timelineDuration(s.project.timeline), start + 5)
          const clip = createTextClip({ trackId: track.id, text, timelineStart: start, durationSec: end - start })
          if (stylePatch) Object.assign(clip.style, stylePatch)
          track.clips.push(clip)
          s.selectedClipId = clip.id
        })
      },

      addSubtitles: (segments) => {
        if (!segments.length) return
        commit((s) => {
          let track = s.project.timeline.tracks.find((t) => t.type === 'text')
          if (!track) track = insertTrack(s.project, 'text')
          for (const seg of segments) {
            const clip = createTextClip({
              trackId: track.id,
              text: seg.text,
              timelineStart: Math.max(0, seg.start),
              durationSec: Math.max(0.2, seg.end - seg.start)
            })
            // Subtitle look: bottom-centred, medium, with a readable shadow.
            Object.assign(clip.style, { fontSizeFrac: 0.05, posY: 0.88, effect: 'shadow', bold: true })
            track.clips.push(clip)
          }
          track.clips.sort((a, b) => a.timelineStart - b.timelineStart)
        })
      },

      importSubtitles: async () => {
        try {
          const res = await window.api.openSubtitleFile()
          if (!res) return
          const segments = parseSubtitles(res.text)
          if (segments.length) get().addSubtitles(segments)
        } catch (e) {
          console.warn('Import sottotitoli fallito', e)
        }
      },

      addEffect: (clipId, type, params) => {
        commit((s) => {
          const ids = bulkTargetIds(s.selectedClipIds, clipId)
          const fanout = ids.length > 1
          for (const id of ids) {
            const loc = locateClip(s.project, id)
            if (!loc || !isMediaClip(loc.clip)) continue
            // When fanning out a bare toggle-add across a selection, don't duplicate an
            // effect a clip already has. Single-clip and preset (params) adds always add,
            // so single-selection behaviour is unchanged.
            if (fanout && !params && loc.clip.effects.some((e: Effect) => e.type === type)) continue
            loc.clip.effects.push({
              id: genId('fx'),
              type,
              enabled: true,
              params: { ...defaultEffectParams(type), ...params }
            })
          }
        })
      },

      removeEffect: (clipId, effectId) => {
        commit((s) => {
          const primary = locateClip(s.project, clipId)
          if (!primary || !isMediaClip(primary.clip)) return
          const target = primary.clip.effects.find((e: Effect) => e.id === effectId)
          if (!target) return
          // Position of this effect among the primary clip's same-type effects, so the
          // CORRESPONDING one is removed from every selected clip (not just any of that type).
          const idx = primary.clip.effects.filter((e: Effect) => e.type === target.type).indexOf(target)
          for (const id of bulkTargetIds(s.selectedClipIds, clipId)) {
            const loc = locateClip(s.project, id)
            if (!loc || !isMediaClip(loc.clip)) continue
            const sameType = loc.clip.effects.filter((e: Effect) => e.type === target.type)
            const victim = id === clipId ? target : (sameType[idx] ?? sameType[sameType.length - 1])
            if (victim) loc.clip.effects = loc.clip.effects.filter((e: Effect) => e.id !== victim.id)
          }
        })
      },

      updateEffect: (clipId, effectId, params) => {
        commit((s) => {
          const primary = locateClip(s.project, clipId)
          if (!primary || !isMediaClip(primary.clip)) return
          const target = primary.clip.effects.find((e: Effect) => e.id === effectId)
          if (!target) return
          Object.assign(target.params, params)
          const ids = bulkTargetIds(s.selectedClipIds, clipId)
          if (ids.length <= 1) return
          // Propagate the same tweak to the corresponding (same type + position) effect
          // on every other selected clip, so editing is shared across the selection.
          const idx = primary.clip.effects.filter((e: Effect) => e.type === target.type).indexOf(target)
          for (const id of ids) {
            if (id === clipId) continue
            const loc = locateClip(s.project, id)
            if (!loc || !isMediaClip(loc.clip)) continue
            const sameType = loc.clip.effects.filter((e: Effect) => e.type === target.type)
            const twin = sameType[idx] ?? sameType[sameType.length - 1]
            if (twin) Object.assign(twin.params, params)
          }
        })
      },

      setFade: (clipId, edge, sec) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (loc && isMediaClip(loc.clip)) {
            if (edge === 'in') loc.clip.fadeInSec = Math.max(0, sec)
            else loc.clip.fadeOutSec = Math.max(0, sec)
          }
        })
      },

      applyTransition: (clipId, durationSec, preset = 'fade') => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (!loc || !isMediaClip(loc.clip)) return
          const a = loc.clip
          // The next clip on this track. The cut between them stays exactly put — the
          // transition straddles the cut (half on each side), it does NOT overlap clips.
          const b = loc.track.clips
            .filter((c) => c.id !== a.id && c.timelineStart > a.timelineStart + 0.01)
            .sort((x, y) => x.timelineStart - y.timelineStart)[0]
          if (!b) return
          const aDur = a.timelineEnd - a.timelineStart
          const bDur = b.timelineEnd - b.timelineStart
          // D/2 is taken from each clip, so cap D at the shorter clip's length.
          const d = Math.max(0.1, Math.min(durationSec, aDur, bDur))
          a.transitionOut = { type: 'xfade', preset, durationSec: d }
        })
      },

      removeTransition: (clipId) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (loc && isMediaClip(loc.clip)) loc.clip.transitionOut = null
        })
      },

      setSpeed: (clipId, speed) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (loc && isMediaClip(loc.clip)) {
            const c = loc.clip
            const v = Math.max(0.1, Math.min(10, speed))
            const srcDur = Math.max(0.05, c.sourceOut - c.sourceIn)
            c.speed = v
            c.timelineEnd = c.timelineStart + srcDur / v
          }
        })
      },

      toggleReverse: (clipId) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (loc && isMediaClip(loc.clip)) loc.clip.reverse = !loc.clip.reverse
        })
      },

      extractAudio: (clipId) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (!loc || !isMediaClip(loc.clip)) return
          const c = loc.clip
          const src = s.project.sources.find((x) => x.id === c.sourceId)
          if (!src || !src.hasAudio || c.mutedAudio) return
          let atrack = s.project.timeline.tracks.find((t) => t.type === 'audio')
          if (!atrack) atrack = insertTrack(s.project, 'audio')
          const ac = createMediaClip({
            trackId: atrack.id,
            sourceId: c.sourceId,
            sourceIn: c.sourceIn,
            sourceOut: c.sourceOut,
            timelineStart: c.timelineStart
          })
          ac.timelineEnd = c.timelineEnd
          ac.volume = c.volume
          ac.speed = c.speed
          ac.reverse = c.reverse
          atrack.clips.push(ac)
          atrack.clips.sort((a, b) => a.timelineStart - b.timelineStart)
          c.mutedAudio = true
          s.selectedClipId = ac.id
        })
      },

      setChroma: (clipId, patch) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (!loc || !isMediaClip(loc.clip)) return
          if (patch === null) {
            delete loc.clip.chroma
            return
          }
          const cur = loc.clip.chroma ?? { keyColor: '#00ff00', similarity: 0.3, blend: 0.1 }
          loc.clip.chroma = { ...cur, ...patch }
        })
      },

      setLut: (clipId, path) => {
        commit((s) => {
          for (const id of bulkTargetIds(s.selectedClipIds, clipId)) {
            const loc = locateClip(s.project, id)
            if (!loc || !isMediaClip(loc.clip)) continue
            if (path) loc.clip.lut = path
            else delete loc.clip.lut
          }
        })
      },

      setLook: (clipId, id, intensity) => {
        commit((s) => {
          for (const cid of bulkTargetIds(s.selectedClipIds, clipId)) {
            const loc = locateClip(s.project, cid)
            if (!loc || !isMediaClip(loc.clip)) continue
            if (!id || id === 'none') delete loc.clip.look
            else loc.clip.look = { id, intensity: intensity ?? loc.clip.look?.intensity ?? 1 }
          }
        })
      },

      importLut: async (clipId) => {
        try {
          const path = await window.api.openLutFile()
          if (path) get().setLut(clipId, path)
        } catch (e) {
          console.warn('Import LUT fallito', e)
        }
      },

      toggleClipAudioFlag: (clipId, flag) => {
        commit((s) => {
          const loc = locateClip(s.project, clipId)
          if (loc && isMediaClip(loc.clip)) loc.clip[flag] = !loc.clip[flag]
        })
      },

      detectBeats: (clipId) => {
        const loc = locateClip(get().project, clipId)
        if (!loc || !isMediaClip(loc.clip)) return
        const c = loc.clip
        const src = get().project.sources.find((x) => x.id === c.sourceId)
        if (!src || !src.peaks || !src.peaks.length || src.durationSec <= 0) return
        const peaks = src.peaks
        const perSec = peaks.length / src.durationSec
        // Energy-onset heuristic: local maxima well above a moving average, spaced out.
        const win = Math.max(4, Math.round(perSec * 0.4))
        const minGap = Math.max(1, Math.round(perSec * 0.3))
        const beats: number[] = []
        let last = -minGap
        for (let i = 1; i < peaks.length - 1; i++) {
          let sum = 0
          let n = 0
          for (let j = Math.max(0, i - win); j < Math.min(peaks.length, i + win); j++) {
            sum += peaks[j]
            n++
          }
          const avg = sum / Math.max(1, n)
          if (peaks[i] > avg * 1.5 && peaks[i] >= peaks[i - 1] && peaks[i] > peaks[i + 1] && i - last >= minGap) {
            const srcT = i / perSec
            if (srcT >= c.sourceIn && srcT <= c.sourceOut) {
              beats.push(c.timelineStart + (srcT - c.sourceIn) / (c.speed || 1))
              last = i
            }
          }
        }
        if (!beats.length) return
        commit((s) => {
          for (const t of beats) s.project.markers.push({ id: genId('mk'), t, label: '', color: '#5cf3da' })
        })
      },

      setPlayhead: (t) => set((s) => void (s.playhead = Math.max(0, t))),
      togglePlay: () => set((s) => void (s.isPlaying = !s.isPlaying)),
      setPlaying: (p) => set((s) => void (s.isPlaying = p)),
      // Min 0.02 px/s lets a 10-hour timeline fit on screen (36000s × 0.02 ≈ 720px).
      setZoom: (px) => set((s) => void (s.pxPerSec = Math.max(0.02, Math.min(2000, px)))),

      setAspect: (a) => {
        commit((s) => {
          const { width, height } = ASPECT_PRESETS[a]
          s.project.canvas.width = width
          s.project.canvas.height = height
        })
      },

      setTier: (t) => set((s) => void (s.tier = t)),

      canUndo: () => get().past.length > 0,
      canRedo: () => get().future.length > 0,

      undo: () => {
        const cur = structuredClone(get().project)
        set((s) => {
          const prev = s.past.pop()
          if (!prev) return
          s.future.push(cur)
          s.project = prev
        })
      },

      redo: () => {
        const cur = structuredClone(get().project)
        set((s) => {
          const next = s.future.pop()
          if (!next) return
          s.past.push(cur)
          s.project = next
        })
      },

      startExport: async (settings = {}) => {
        const project = get().project
        if (timelineDuration(project.timeline) <= 0) {
          set((s) => void (s.lastExport = { error: 'La timeline è vuota.' }))
          return
        }
        const scale = settings.outputScale ?? 1
        // Bitrate scales with pixel count (resolution) and the quality preset.
        const baseMbit = scale >= 2 ? 40 : scale >= 1.3 ? 20 : scale <= 0.7 ? 6 : 12
        const qMul = settings.quality === 'high' ? 1.6 : settings.quality === 'low' ? 0.6 : 1
        const videoBitrate = `${Math.max(2, Math.round(baseMbit * qMul))}M`
        set((s) => void (s.lastExport = null))
        // The overlay appears only once the first progress event arrives, i.e.
        // after the save dialog is confirmed and ffmpeg actually starts.
        const off = window.api.onExportProgress((p) => {
          set((s) => void (s.exporting = { percent: p.percent, speed: p.speed }))
        })
        try {
          const result = await window.api.startExport(project, {
            useVideoToolbox: true,
            outputScale: scale,
            fps: settings.fps,
            quality: settings.quality,
            format: settings.format,
            videoBitrate
          })
          set((s) => {
            s.exporting = null
            s.lastExport = result.canceled ? null : result
          })
        } catch (e) {
          set((s) => {
            s.exporting = null
            s.lastExport = { error: String(e) }
          })
        } finally {
          off()
        }
      },

      cancelExport: () => {
        void window.api.cancelExport()
        set((s) => void (s.exporting = null))
      },

      startHifiExport: async (settings = {}) => {
        const project = get().project
        const dur = timelineDuration(project.timeline)
        if (dur <= 0) {
          set((s) => void (s.lastExport = { error: 'La timeline è vuota.' }))
          return
        }
        const scale = settings.outputScale ?? 1
        const fps = settings.fps && settings.fps > 0 ? settings.fps : project.canvas.fps
        // Hi-fi renders every frame: warn before a very long (slow) job.
        const frames = Math.ceil(dur * fps)
        if (frames > 1800) {
          const mins = Math.ceil(dur / 60)
          if (
            !confirm(
              `Alta fedeltà: renderizzerà ${frames} fotogrammi (~${mins} min di timeline) uno per uno, può richiedere molto tempo. Continuare?`
            )
          )
            return
        }
        const format = settings.format === 'mov' ? 'mov' : 'mp4'
        const baseMbit = scale >= 2 ? 40 : scale >= 1.3 ? 20 : scale <= 0.7 ? 6 : 12
        const qMul = settings.quality === 'high' ? 1.6 : settings.quality === 'low' ? 0.6 : 1
        const videoBitrate = `${Math.max(2, Math.round(baseMbit * qMul))}M`
        const begin = await window.api.hifiBegin(format, project.name)
        if (!begin) return // cancelled in the save dialog
        set((s) => {
          s.lastExport = null
          s.exporting = { percent: 0, speed: 'rendering' }
        })
        try {
          await compositor.exportFrames(scale, fps, async (dataUrl, index, total) => {
            await window.api.hifiFrame(begin.id, index, dataUrl)
            set((s) => void (s.exporting = { percent: ((index + 1) / total) * 99, speed: 'rendering' }))
          })
          set((s) => void (s.exporting = { percent: 99, speed: 'encoding' }))
          const result = await window.api.hifiFinish(
            begin.id,
            project,
            { useVideoToolbox: true, videoBitrate, fps },
            fps,
            begin.outPath
          )
          set((s) => {
            s.exporting = null
            s.lastExport = result
          })
        } catch (e) {
          await window.api.hifiCancel(begin.id)
          set((s) => {
            s.exporting = null
            s.lastExport = { error: String(e) }
          })
        }
      },

      dismissExport: () => set((s) => void (s.lastExport = null))
    }
  })
)

// Autosave the project (debounced) so reloads/restarts don't lose work.
// Only fires when the project reference actually changes (not on playhead/
// selection/zoom updates), thanks to immer's structural sharing.
let persistTimer: ReturnType<typeof setTimeout> | null = null
let lastPersisted: Project | null = null
useEditor.subscribe((state) => {
  if (state.project === lastPersisted) return
  lastPersisted = state.project
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(PERSIST_KEY, JSON.stringify(useEditor.getState().project))
    } catch (e) {
      console.warn('Could not persist project', e)
    }
  }, 400)
})
