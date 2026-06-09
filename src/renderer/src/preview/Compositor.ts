import { resolveClipLayout } from '@shared/geometry'
import {
  isMediaClip,
  timelineDuration,
  type MediaClip,
  type Project,
  type Source,
  type TextClip,
  type TransitionPreset
} from '@shared/projectSchema'
import { resolveTransformAt, resolveMaskAt } from '@shared/anim'
import { resolveTextMotion } from '@shared/textAnim'
import { mediaUrl } from '@shared/media'
import { clamp01, hexWithAlpha, hexToNum } from '../util/color'

interface MediaEl {
  el: HTMLVideoElement | HTMLImageElement
  isVideo: boolean
  ready: boolean
  /** The resolved media:// URL this element loaded (proxy or original). */
  url: string
  /** Web Audio gain node, so volume can exceed 100% (up to 400%). */
  gain?: GainNode
}

interface PreviewState {
  project: Project
  playhead: number
  isPlaying: boolean
}

const DRIFT_TOLERANCE = 0.75
const SEEK_EPS = 0.05

/** Apply a transition reveal (slide/wipe/zoom/circle) to ctx for the incoming clip.
 *  p = 0..1 progress; W/H are the device-pixel canvas size. */
function applyTransitionClip(
  ctx: CanvasRenderingContext2D,
  preset: TransitionPreset,
  p: number,
  W: number,
  H: number
): void {
  const e = 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 3) // easeOut
  switch (preset) {
    case 'slideleft':
      ctx.translate((1 - e) * W, 0)
      break
    case 'slideright':
      ctx.translate(-(1 - e) * W, 0)
      break
    case 'slideup':
      ctx.translate(0, (1 - e) * H)
      break
    case 'slidedown':
      ctx.translate(0, -(1 - e) * H)
      break
    case 'wiperight':
      ctx.beginPath()
      ctx.rect(0, 0, e * W, H)
      ctx.clip()
      break
    case 'wipeleft':
      ctx.beginPath()
      ctx.rect((1 - e) * W, 0, e * W, H)
      ctx.clip()
      break
    case 'wipedown':
      ctx.beginPath()
      ctx.rect(0, 0, W, e * H)
      ctx.clip()
      break
    case 'wipeup':
      ctx.beginPath()
      ctx.rect(0, (1 - e) * H, W, e * H)
      ctx.clip()
      break
    case 'zoomin': {
      const sc = 0.4 + 0.6 * e
      ctx.translate(W / 2, H / 2)
      ctx.scale(sc, sc)
      ctx.translate(-W / 2, -H / 2)
      break
    }
    case 'circleopen': {
      ctx.beginPath()
      ctx.arc(W / 2, H / 2, (e * Math.hypot(W, H)) / 2, 0, Math.PI * 2)
      ctx.clip()
      break
    }
    default:
      break
  }
}

function fadeAlpha(clip: MediaClip, playhead: number): number {
  let a = 1
  const into = playhead - clip.timelineStart
  const toEnd = clip.timelineEnd - playhead
  if (clip.fadeInSec > 0 && into < clip.fadeInSec) a *= clamp01(into / clip.fadeInSec)
  if (clip.fadeOutSec > 0 && toEnd < clip.fadeOutSec) a *= clamp01(toEnd / clip.fadeOutSec)
  return a
}

function buildFilter(clip: MediaClip): string {
  const parts: string[] = []
  for (const fx of clip.effects) {
    if (!fx.enabled) continue
    if (fx.type === 'gblur') parts.push(`blur(${fx.params.sigma ?? 8}px)`)
    else if (fx.type === 'brightness') parts.push(`brightness(${1 + (fx.params.value ?? 0)})`)
    else if (fx.type === 'contrast') parts.push(`contrast(${1 + (fx.params.value ?? 0)})`)
    else if (fx.type === 'saturation') parts.push(`saturate(${1 + (fx.params.value ?? 0)})`)
  }
  return parts.length ? parts.join(' ') : 'none'
}

/**
 * Live preview compositor on a 2D canvas. Uses ctx.drawImage with an explicit
 * source rectangle + a clip-to-box path, which is the reliable, parity-exact
 * mirror of the export's crop->scale->crop chain. One <video> decode per source
 * feeds any number of clips (e.g. one Zoom file cropped into two stacked people).
 * A rAF loop redraws so playing video updates continuously.
 */
export class Compositor {
  private host: HTMLElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private media = new Map<string, MediaEl>()
  private previewW = 1
  private previewH = 1
  private raf = 0
  private getState: (() => PreviewState) | null = null
  /** True while the hi-fi frame exporter runs, so the live draw loop pauses. */
  private exporting = false
  private maskCanvas: HTMLCanvasElement | null = null
  private audioCtx: AudioContext | null = null

  setStateGetter(fn: () => PreviewState): void {
    this.getState = fn
  }

  private started = false

  /**
   * Attach the (single, app-lifetime) compositor canvas to a host element and
   * start the render loop once. Re-attaching just moves the canvas to the new
   * host — this is a SINGLETON so React StrictMode / HMR can mount the preview
   * twice without ever creating a second render loop (which would advance the
   * playhead multiple times and fast-forward playback).
   */
  attach(host: HTMLElement, previewW: number, previewH: number): void {
    this.host = host
    this.previewW = Math.max(1, previewW)
    this.previewH = Math.max(1, previewH)
    if (!this.canvas) {
      const canvas = document.createElement('canvas')
      canvas.width = this.previewW
      canvas.height = this.previewH
      // CSS stretches the canvas to fill the host; the backing-store resolution is
      // chosen in draw() from the OUTPUT canvas size (not the tiny on-screen size),
      // which keeps the preview crisp — Chromium's drawImage(video) readback scales
      // with the destination size, so a too-small backing yields a blurry frame.
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.display = 'block'
      this.canvas = canvas
      this.ctx = canvas.getContext('2d')
      if (this.ctx) this.ctx.imageSmoothingQuality = 'high'
    }
    host.appendChild(this.canvas)
    if (!this.started) {
      this.started = true
      let loggedError = false
      const loop = (): void => {
        try {
          this.draw()
        } catch (e) {
          if (!loggedError) {
            loggedError = true
            console.error('compositor draw error', e)
          }
        }
        this.raf = requestAnimationFrame(loop)
      }
      this.raf = requestAnimationFrame(loop)
    }
  }

  /** Detach the canvas from its host but keep the singleton (loop + decoded
   *  videos) alive for the next attach. */
  detach(): void {
    if (this.canvas?.parentElement) this.canvas.parentElement.removeChild(this.canvas)
    this.host = null
  }

  resize(_previewW: number, _previewH: number): void {
    // No-op: the canvas fills its host via CSS, and the backing-store resolution
    // is derived from the output canvas in draw(). Kept for API compatibility.
  }

  private ensureMedia(src: Source): MediaEl {
    const url = mediaUrl(src.proxyPath ?? src.path)
    const existing = this.media.get(src.id)
    if (existing && existing.url === url) return existing
    if (existing && existing.isVideo) {
      const v = existing.el as HTMLVideoElement
      v.pause()
      v.removeAttribute('src')
      v.load()
      v.remove()
    }
    if (src.kind === 'image') {
      const img = new Image()
      img.src = url
      const media: MediaEl = { el: img, isVideo: false, ready: false, url }
      img.addEventListener('load', () => (media.ready = true), { once: true })
      this.media.set(src.id, media)
      return media
    }
    // No crossOrigin: Canvas2D only displays (no pixel readback), so a tainted
    // canvas is fine, and it avoids CORS checks on the media:// range responses.
    const video = document.createElement('video')
    // CORS-clean so Web Audio (the volume>100% GainNode below) receives real
    // samples instead of silence. The media:// handler returns ACAO on every
    // response, so the ranged requests pass the CORS check.
    video.crossOrigin = 'anonymous'
    video.src = url
    video.preload = 'auto'
    video.playsInline = true
    video.muted = false
    // Chromium decodes a <video> at the size it is COMPOSITED. An unattached or
    // occluded element gets decoded at ~0px, so drawing it to the canvas yields a
    // blurry upscaled frame. Keep it in the layout at its intrinsic size, on top
    // (so it isn't occluded) but at imperceptible opacity, to force full-res decode.
    video.style.cssText =
      'position:fixed; left:0; top:0; opacity:0.01; pointer-events:none; z-index:2147483646'
    document.body.appendChild(video)
    const media: MediaEl = { el: video, isVideo: true, ready: false, url }
    // Route audio through a GainNode so the volume can exceed 100% (the element's
    // own .volume property is capped at 1.0). The element's audio still flows,
    // just amplified by the gain.
    try {
      const ctx = (this.audioCtx ??= new AudioContext())
      const srcNode = ctx.createMediaElementSource(video)
      const gain = ctx.createGain()
      srcNode.connect(gain)
      gain.connect(ctx.destination)
      media.gain = gain
    } catch {
      /* Web Audio unavailable — fall back to element volume (capped at 100%). */
    }
    video.addEventListener('loadeddata', () => (media.ready = true), { once: true })
    this.media.set(src.id, media)
    return media
  }

  private draw(): void {
    const ctx = this.ctx
    if (!ctx || !this.getState || this.exporting) return
    const { project, playhead, isPlaying } = this.getState()
    const W = project.canvas.width
    const H = project.canvas.height

    // Size the backing store from the OUTPUT resolution (capped), independent of
    // the small on-screen size. drawImage(video)'s GPU readback scales with the
    // destination rect, so rendering into a large backing keeps frames crisp.
    // 720 matches the preview proxy's resolution (≈1:1, full detail) while staying
    // light on the M1 — going higher gives no more detail than the proxy holds.
    const MAX_SIDE = 720
    const q = Math.min(1, MAX_SIDE / Math.max(W, H))
    const bw = Math.max(1, Math.round(W * q))
    const bh = Math.max(1, Math.round(H * q))
    if (this.canvas && (this.canvas.width !== bw || this.canvas.height !== bh)) {
      this.canvas.width = bw
      this.canvas.height = bh
      ctx.imageSmoothingQuality = 'high' // resetting canvas size clears ctx state
    }
    this.previewW = bw
    this.previewH = bh
    const s = this.previewW / W
    this.paintComposite(ctx, project, playhead, isPlaying, W, H, s)
  }

  /** Render the full composite (clips, transitions, text) into `ctx`. Shared by the
   *  live preview and the hi-fi frame exporter, which passes an offscreen ctx and
   *  sets previewW/previewH to the output resolution. */
  paintComposite(
    ctx: CanvasRenderingContext2D,
    project: Project,
    playhead: number,
    isPlaying: boolean,
    W: number,
    H: number,
    s: number
  ): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.previewW, this.previewH)
    ctx.fillStyle = project.canvas.backgroundColor
    ctx.fillRect(0, 0, this.previewW, this.previewH)

    const active = new Set<string>()
    const videoClips: { clip: MediaClip; src: Source; ti: number }[] = []
    project.timeline.tracks.forEach((track, ti) => {
      if (track.type !== 'video' || track.hidden) return
      for (const clip of track.clips) {
        if (!isMediaClip(clip)) continue
        if (playhead < clip.timelineStart || playhead >= clip.timelineEnd) continue
        const src = project.sources.find((x) => x.id === clip.sourceId)
        if (!src || !src.hasVideo) continue
        videoClips.push({ clip, src, ti })
      }
    })
    // Higher in the track list (lower index) = drawn LAST = in FRONT. So sort
    // descending by track index: the bottom track paints first (background) and
    // the top track paints on top.
    videoClips.sort((a, b) => b.ti - a.ti || a.clip.timelineStart - b.clip.timelineStart)
    // Transitions: the cut stays put; the transition straddles it (D/2 each side).
    // The OUTGOING clip exits over its last D/2, the INCOMING one enters over its
    // first D/2. `reveal` is 0 (hidden) → 1 (fully shown). No clip overlap.
    const reveal = new Map<string, { preset: TransitionPreset; r: number }>()
    for (const track of project.timeline.tracks) {
      if (track.type !== 'video') continue
      const media = track.clips.filter(isMediaClip).sort((a, b) => a.timelineStart - b.timelineStart)
      for (let i = 0; i < media.length; i++) {
        const c = media[i]
        const prevT = i > 0 ? media[i - 1].transitionOut : null
        if (prevT) {
          const h = prevT.durationSec / 2
          if (playhead >= c.timelineStart && playhead < c.timelineStart + h) {
            reveal.set(c.id, { preset: prevT.preset, r: clamp01((playhead - c.timelineStart) / h) })
          }
        }
        if (!reveal.has(c.id) && c.transitionOut) {
          const h = c.transitionOut.durationSec / 2
          if (playhead >= c.timelineEnd - h && playhead < c.timelineEnd) {
            reveal.set(c.id, { preset: c.transitionOut.preset, r: clamp01((c.timelineEnd - playhead) / h) })
          }
        }
      }
    }
    for (const { clip, src } of videoClips) {
      active.add(src.id)
      const rv = reveal.get(clip.id)
      if (rv && rv.r < 1) {
        if (rv.preset === 'fade' || rv.preset === 'dissolve') {
          this.drawClip(ctx, clip, src, playhead, isPlaying, W, H, s, rv.r)
        } else {
          ctx.save()
          applyTransitionClip(ctx, rv.preset, rv.r, this.previewW, this.previewH)
          this.drawClip(ctx, clip, src, playhead, isPlaying, W, H, s, 1)
          ctx.restore()
        }
      } else {
        this.drawClip(ctx, clip, src, playhead, isPlaying, W, H, s, 1)
      }
    }

    project.timeline.tracks.forEach((track) => {
      if (track.type !== 'text' || track.hidden) return
      for (const clip of track.clips) {
        if (clip.kind !== 'text') continue
        if (playhead < clip.timelineStart || playhead >= clip.timelineEnd) continue
        this.drawText(ctx, clip, W, H, s, playhead)
      }
    })

    for (const [sid, m] of this.media) {
      if (!active.has(sid) && m.isVideo) {
        const v = m.el as HTMLVideoElement
        if (!v.paused) v.pause()
      }
    }
  }

  /** Hi-fi export: render the timeline frame-by-frame at full output resolution to
   *  JPEG data URLs, using the exact preview renderer so the result matches what you
   *  see. Pauses the live preview. (Source frames are proxy resolution.) */
  async exportFrames(
    outputScale: number,
    fps: number,
    onFrame: (jpegDataUrl: string, index: number, total: number) => Promise<void>,
    shouldAbort?: () => boolean
  ): Promise<{ ow: number; oh: number; total: number }> {
    const state = this.getState?.()
    if (!state) return { ow: 0, oh: 0, total: 0 }
    const { project } = state
    const W = project.canvas.width
    const H = project.canvas.height
    const OW = Math.max(2, Math.round((W * outputScale) / 2) * 2)
    const OH = Math.max(2, Math.round((H * outputScale) / 2) * 2)
    const off = document.createElement('canvas')
    off.width = OW
    off.height = OH
    const offCtx = off.getContext('2d')
    if (!offCtx) return { ow: 0, oh: 0, total: 0 }
    offCtx.imageSmoothingQuality = 'high'
    const duration = timelineDuration(project.timeline)
    const total = Math.max(1, Math.ceil(duration * fps))
    const s = OW / W
    const savedPW = this.previewW
    const savedPH = this.previewH
    this.exporting = true
    this.previewW = OW
    this.previewH = OH
    try {
      for (let i = 0; i < total; i++) {
        if (shouldAbort?.()) break
        const t = Math.min(Math.max(0, duration - 0.0001), i / fps)
        await this.seekAllForFrame(project, t)
        this.paintComposite(offCtx, project, t, false, W, H, s)
        await onFrame(off.toDataURL('image/jpeg', 0.92), i, total)
      }
    } finally {
      this.previewW = savedPW
      this.previewH = savedPH
      this.exporting = false
    }
    return { ow: OW, oh: OH, total }
  }

  /** Seek every active video element to its exact source frame for time `t`, and
   *  wait for the seeks to land, so the next paint draws the correct frames. */
  private async seekAllForFrame(project: Project, t: number): Promise<void> {
    const seeks: Promise<void>[] = []
    for (const track of project.timeline.tracks) {
      if (track.type !== 'video' || track.hidden) continue
      for (const clip of track.clips) {
        if (!isMediaClip(clip) || t < clip.timelineStart || t >= clip.timelineEnd) continue
        const src = project.sources.find((x) => x.id === clip.sourceId)
        if (!src || !src.hasVideo) continue
        const m = this.ensureMedia(src)
        if (!m.isVideo) continue
        const vid = m.el as HTMLVideoElement
        const speed = clip.speed && clip.speed > 0 ? clip.speed : 1
        const into = (t - clip.timelineStart) * speed
        const desired = Math.max(0, clip.reverse ? clip.sourceOut - into : clip.sourceIn + into)
        if (vid.readyState < 2 || Math.abs(vid.currentTime - desired) > 0.005) {
          seeks.push(
            new Promise<void>((res) => {
              let done = false
              const finish = (): void => {
                if (done) return
                done = true
                vid.removeEventListener('seeked', finish)
                res()
              }
              vid.addEventListener('seeked', finish)
              try {
                vid.currentTime = desired
              } catch {
                finish()
              }
              setTimeout(finish, 1500) // safety: never hang on a bad seek
            })
          )
        }
      }
    }
    await Promise.all(seeks)
  }

  private getMaskCtx(): CanvasRenderingContext2D | null {
    if (!this.maskCanvas) this.maskCanvas = document.createElement('canvas')
    if (this.maskCanvas.width !== this.previewW || this.maskCanvas.height !== this.previewH) {
      this.maskCanvas.width = this.previewW
      this.maskCanvas.height = this.previewH
    }
    return this.maskCanvas.getContext('2d')
  }

  private drawClip(
    ctx: CanvasRenderingContext2D,
    clip: MediaClip,
    src: Source,
    playhead: number,
    isPlaying: boolean,
    W: number,
    H: number,
    s: number,
    revealAlpha = 1
  ): void {
    const m = this.ensureMedia(src)
    const vid = m.isVideo ? (m.el as HTMLVideoElement) : null
    // Use the loaded element's intrinsic size, NOT src.width/height: when a proxy
    // is loaded its pixel dims (e.g. 304x540) differ from the original (1080x1920),
    // and drawImage's source rect must be in the actual element's pixel space.
    // crop is normalized (0..1), so a uniformly-scaled proxy maps identically.
    const sw = (vid ? vid.videoWidth : (m.el as HTMLImageElement).naturalWidth) || src.width
    const sh = (vid ? vid.videoHeight : (m.el as HTMLImageElement).naturalHeight) || src.height

    if (vid) {
      const speed = clip.speed && clip.speed > 0 ? clip.speed : 1
      const into = (playhead - clip.timelineStart) * speed
      const desired = Math.max(0, clip.reverse ? clip.sourceOut - into : clip.sourceIn + into)
      if (isFinite(desired)) {
        // Reverse can't play() backwards, so scrub it frame-by-frame like a paused clip.
        if (isPlaying && !clip.reverse) {
          if (vid.paused) void vid.play().catch(() => undefined)
          vid.playbackRate = Math.max(0.0625, Math.min(16, speed))
          const vol = clip.mutedAudio ? 0 : clip.volume
          if (m.gain) {
            m.gain.gain.value = Math.max(0, Math.min(4, vol))
            if (this.audioCtx?.state === 'suspended') void this.audioCtx.resume()
          } else {
            vid.volume = clamp01(vol)
          }
          // During playback the clock advances by wall time and the video is sped via
          // playbackRate, so only correct large drift (and never mid-seek).
          if (!vid.seeking && Math.abs(vid.currentTime - desired) > DRIFT_TOLERANCE) {
            vid.currentTime = desired
          }
        } else {
          if (!vid.paused) vid.pause()
          if (!vid.seeking && Math.abs(vid.currentTime - desired) > SEEK_EPS) vid.currentTime = desired
        }
      }
    }

    if (!m.ready || sw <= 0 || sh <= 0) return

    // Animate transform + mask via keyframes (fall back to the static values).
    const tInClip = playhead - clip.timelineStart
    const tr = resolveTransformAt(clip, tInClip)
    const mk = resolveMaskAt(clip, tInClip)
    const layout = resolveClipLayout(clip.crop, tr, sw, sh, W, H)
    const sr = layout.sourceRect
    const cr = layout.contentRect
    const cb = layout.canvasBox
    const alpha = clamp01(tr.opacity) * fadeAlpha(clip, playhead) * clamp01(revealAlpha)

    if (mk.shape === 'none') {
      ctx.save()
      ctx.globalAlpha = alpha
      this.drawContent(ctx, m.el, clip, sr, cr, cb, s, tr.rotation)
      ctx.restore()
      return
    }

    // Masked: render content to an offscreen, cut to the mask shape, composite.
    const mctx = this.getMaskCtx()
    if (!mctx) return
    mctx.setTransform(1, 0, 0, 1, 0, 0)
    mctx.globalAlpha = 1
    mctx.filter = 'none'
    mctx.clearRect(0, 0, this.previewW, this.previewH)
    this.drawContent(mctx, m.el, clip, sr, cr, cb, s, tr.rotation)
    this.applyMask(mctx, mk, W, H, s)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.drawImage(this.maskCanvas as HTMLCanvasElement, 0, 0)
    ctx.restore()
  }

  private drawContent(
    target: CanvasRenderingContext2D,
    el: HTMLVideoElement | HTMLImageElement,
    clip: MediaClip,
    sr: { x: number; y: number; w: number; h: number },
    cr: { x: number; y: number; w: number; h: number },
    cb: { x: number; y: number; w: number; h: number },
    s: number,
    rotation: number
  ): void {
    target.save()
    target.filter = buildFilter(clip)
    const fh = clip.transform.flipH
    const fv = clip.transform.flipV
    if (rotation || fh || fv) {
      const cx = (cb.x + cb.w / 2) * s
      const cy = (cb.y + cb.h / 2) * s
      target.translate(cx, cy)
      if (rotation) target.rotate((rotation * Math.PI) / 180)
      if (fh || fv) target.scale(fh ? -1 : 1, fv ? -1 : 1)
      target.translate(-cx, -cy)
    }
    target.beginPath()
    target.rect(cb.x * s, cb.y * s, cb.w * s, cb.h * s)
    target.clip()
    try {
      if (clip.chroma) {
        const keyed = this.chromaKey(el, sr, clip.chroma)
        if (keyed) target.drawImage(keyed, 0, 0, keyed.width, keyed.height, cr.x * s, cr.y * s, cr.w * s, cr.h * s)
      } else {
        target.drawImage(el, sr.x, sr.y, sr.w, sr.h, cr.x * s, cr.y * s, cr.w * s, cr.h * s)
      }
    } catch {
      /* frame not ready */
    }
    target.restore()
  }

  /** Per-pixel chroma key into an offscreen canvas (only used when a clip keys). */
  private chromaCanvas: HTMLCanvasElement | null = null
  private chromaKey(
    el: HTMLVideoElement | HTMLImageElement,
    sr: { x: number; y: number; w: number; h: number },
    chroma: { keyColor: string; similarity: number; blend: number }
  ): HTMLCanvasElement | null {
    const W = Math.max(1, Math.min(960, Math.round(sr.w)))
    const H = Math.max(1, Math.min(960, Math.round(sr.h)))
    if (!this.chromaCanvas) this.chromaCanvas = document.createElement('canvas')
    const c = this.chromaCanvas
    if (c.width !== W || c.height !== H) {
      c.width = W
      c.height = H
    }
    const cx = c.getContext('2d', { willReadFrequently: true })
    if (!cx) return null
    cx.clearRect(0, 0, W, H)
    cx.drawImage(el, sr.x, sr.y, sr.w, sr.h, 0, 0, W, H)
    let img: ImageData
    try {
      img = cx.getImageData(0, 0, W, H)
    } catch {
      return null
    }
    const data = img.data
    const kc = hexToNum(chroma.keyColor)
    const kr = (kc >> 16) & 255
    const kg = (kc >> 8) & 255
    const kb = kc & 255
    const sim = clamp01(chroma.similarity) * 441
    const blend = Math.max(1, clamp01(chroma.blend) * 441)
    for (let i = 0; i < data.length; i += 4) {
      const dr = data[i] - kr
      const dg = data[i + 1] - kg
      const db = data[i + 2] - kb
      const dist = Math.sqrt(dr * dr + dg * dg + db * db)
      if (dist < sim) data[i + 3] = 0
      else if (dist < sim + blend) data[i + 3] = Math.round(data[i + 3] * ((dist - sim) / blend))
    }
    cx.putImageData(img, 0, 0)
    return c
  }

  /** Keep only the masked region (or its inverse), with feathered edges. */
  private applyMask(
    mctx: CanvasRenderingContext2D,
    mask: { shape: string; x: number; y: number; w: number; h: number; feather: number; invert: boolean },
    W: number,
    H: number,
    s: number
  ): void {
    const mx = mask.x * W * s
    const my = mask.y * H * s
    const mw = mask.w * W * s
    const mh = mask.h * H * s
    mctx.save()
    mctx.globalCompositeOperation = mask.invert ? 'destination-out' : 'destination-in'
    const feather = Math.max(0, Math.min(0.95, mask.feather))
    if (mask.shape === 'ellipse') {
      const cx = mx + mw / 2
      const cy = my + mh / 2
      mctx.translate(cx, cy)
      mctx.scale(mw / 2, mh / 2)
      const g = mctx.createRadialGradient(0, 0, 0, 0, 0, 1)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(Math.max(0, 1 - feather), 'rgba(255,255,255,1)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      mctx.fillStyle = g
      mctx.beginPath()
      mctx.arc(0, 0, 1, 0, Math.PI * 2)
      mctx.fill()
    } else {
      const fpx = (feather * Math.min(mw, mh)) / 2
      if (fpx > 0.5) mctx.filter = `blur(${fpx}px)`
      mctx.fillStyle = '#ffffff'
      mctx.fillRect(mx, my, mw, mh)
    }
    mctx.restore()
  }

  private drawText(
    ctx: CanvasRenderingContext2D,
    clip: TextClip,
    W: number,
    H: number,
    s: number,
    playhead: number
  ): void {
    const st = clip.style
    const fontPx = Math.max(6, st.fontSizeFrac * H * s)
    const lineH = fontPx * (st.lineHeightMul || 1.2)
    const letterSp = (st.letterSpacingFrac || 0) * H * s

    // Entrance / exit motion (shared resolver, so export can mirror the timing).
    const dur = clip.timelineEnd - clip.timelineStart
    const m = resolveTextMotion(st, playhead - clip.timelineStart, dur)
    if (m.alpha <= 0.001) return

    const raw = clip.text ?? ''
    const shown = m.charFrac < 1 ? raw.slice(0, Math.max(0, Math.floor(raw.length * m.charFrac))) : raw
    const lines = shown.split('\n')

    ctx.save()
    ctx.globalAlpha = clamp01(m.alpha)
    ctx.textAlign = st.align
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.miterLimit = 2
    ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${letterSp}px`
    const weight = st.bold ? '700' : '400'
    const italic = st.italic ? 'italic ' : ''
    ctx.font = `${italic}${weight} ${fontPx}px ${st.fontFamily}`

    ctx.translate(st.posX * W * s + m.dxFracW * W * s, st.posY * H * s + m.dyFracFont * fontPx)
    if (m.scale !== 1) ctx.scale(m.scale, m.scale)

    const totalH = lineH * lines.length
    const firstY = -totalH / 2 + lineH / 2
    const measure = (str: string): number => ctx.measureText(str).width
    const lineX = (w: number): number => (st.align === 'left' ? 0 : st.align === 'right' ? -w : -w / 2)
    const paint = (mode: 'fill' | 'stroke' | 'both', ox = 0, oy = 0): void => {
      lines.forEach((ln, i) => {
        const y = firstY + i * lineH + oy
        if (mode === 'stroke' || mode === 'both') ctx.strokeText(ln, ox, y)
        if (mode === 'fill' || mode === 'both') ctx.fillText(ln, ox, y)
      })
    }
    const resetShadow = (): void => {
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
    }

    // --- highlight / background box behind each line (Canva "Background") ---
    if (st.highlight) {
      ctx.save()
      ctx.globalAlpha = clamp01(m.alpha) * clamp01(st.highlightOpacity ?? 1)
      ctx.fillStyle = st.highlightColor
      const padX = fontPx * 0.32
      const r = Math.min(fontPx * (st.highlightRadiusFrac ?? 0.18), lineH / 2)
      lines.forEach((ln, i) => {
        if (!ln.trim()) return
        const w = measure(ln)
        const yMid = firstY + i * lineH
        ctx.beginPath()
        ctx.roundRect(lineX(w) - padX, yMid - lineH / 2, w + padX * 2, lineH, r)
        ctx.fill()
      })
      ctx.restore()
    }

    const ec = st.effectColor || '#000000'
    const inten = clamp01(st.effectIntensity ?? 0.4)
    const off = fontPx * 0.06 * (0.5 + inten)
    const manualStroke = (st.strokeWidthFrac ?? 0) > 0
    ctx.fillStyle = st.color
    ctx.strokeStyle = st.strokeColor
    ctx.lineWidth = Math.max(0, (st.strokeWidthFrac ?? 0) * H * s) * 2

    switch (st.effect) {
      case 'shadow':
        ctx.shadowColor = hexWithAlpha(ec, 0.55)
        ctx.shadowBlur = fontPx * 0.04
        ctx.shadowOffsetX = off
        ctx.shadowOffsetY = off
        if (manualStroke) paint('stroke')
        paint('fill')
        break
      case 'lift':
        ctx.shadowColor = 'rgba(0,0,0,0.45)'
        ctx.shadowBlur = fontPx * (0.22 + inten * 0.5)
        ctx.shadowOffsetY = fontPx * 0.05
        paint('fill')
        break
      case 'glow':
        ctx.shadowColor = ec
        ctx.shadowBlur = fontPx * (0.3 + inten * 0.7)
        paint('fill')
        paint('fill')
        break
      case 'neon':
        ctx.shadowColor = ec
        ctx.shadowBlur = fontPx * (0.4 + inten * 0.9)
        paint('fill')
        paint('fill')
        ctx.shadowBlur = fontPx * 0.16
        paint('fill')
        resetShadow()
        ctx.lineWidth = Math.max(1, fontPx * 0.02)
        ctx.strokeStyle = '#ffffff'
        paint('stroke')
        break
      case 'hollow':
        resetShadow()
        ctx.lineWidth = Math.max(1, fontPx * (0.03 + inten * 0.03))
        ctx.strokeStyle = st.color
        paint('stroke')
        break
      case 'outline':
        ctx.lineWidth = Math.max(1, fontPx * (0.05 + inten * 0.06))
        ctx.strokeStyle = ec
        paint('stroke')
        paint('fill')
        break
      case 'splice':
        resetShadow()
        ctx.fillStyle = ec
        paint('fill', off * 1.5, off * 1.5)
        ctx.lineWidth = Math.max(1, fontPx * 0.03)
        ctx.strokeStyle = st.color
        paint('stroke')
        break
      case 'echo':
        resetShadow()
        ctx.globalAlpha = clamp01(m.alpha) * 0.3
        ctx.fillStyle = ec
        paint('fill', off * 2.6, off * 2.6)
        ctx.globalAlpha = clamp01(m.alpha) * 0.5
        paint('fill', off * 1.3, off * 1.3)
        ctx.globalAlpha = clamp01(m.alpha)
        ctx.fillStyle = st.color
        paint('fill')
        break
      default:
        if (manualStroke) paint('stroke')
        paint('fill')
    }

    // --- underline, drawn under each line ---
    if (st.underline) {
      resetShadow()
      ctx.strokeStyle = st.color
      ctx.lineWidth = Math.max(1, fontPx * 0.06)
      lines.forEach((ln, i) => {
        if (!ln.trim()) return
        const w = measure(ln)
        const y = firstY + i * lineH + fontPx * 0.42
        const xL = lineX(w)
        ctx.beginPath()
        ctx.moveTo(xL, y)
        ctx.lineTo(xL + w, y)
        ctx.stroke()
      })
    }

    ctx.restore()
  }

  destroy(): void {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    for (const [, m] of this.media) {
      if (m.isVideo) {
        const v = m.el as HTMLVideoElement
        v.pause()
        v.removeAttribute('src')
        v.load()
        v.remove()
      }
    }
    this.media.clear()
    this.maskCanvas = null
    if (this.canvas && this.host && this.canvas.parentElement === this.host) {
      this.host.removeChild(this.canvas)
    }
    this.canvas = null
    this.ctx = null
    this.getState = null
    this.started = false
  }
}

/** App-lifetime singleton: exactly one render loop and one set of decoded videos. */
export const compositor = new Compositor()
