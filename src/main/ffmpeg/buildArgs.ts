import { existsSync } from 'fs'
import {
  isMediaClip,
  timelineDuration,
  type MediaClip,
  type Project,
  type Source,
  type TextClip
} from '@shared/projectSchema'
import { resolveClipLayout } from '@shared/geometry'
import { activeKeyframes, pwlExpr } from '@shared/anim'
import { fontFileForCss } from '@shared/fonts'
import { lookFfmpeg } from '@shared/looks'

export interface ExportOptions {
  outPath: string
  /** Use Apple hardware H.264 encoding when available. */
  useVideoToolbox: boolean
  videoBitrate?: string
  audioBitrate?: string
  /** Absolute path to a .ttf/.ttc font for burning text (resolved by main). */
  fontFile?: string
  /** Output scale multiplier over the canvas resolution (1 = 1080p, 2 = 4K-class). */
  outputScale?: number
  /** Output frame rate override (defaults to the canvas fps). */
  fps?: number
  /** Container/codec: mp4 (h264), mov (h264 in QuickTime), gif (palette), mp3 (audio only). */
  format?: 'mp4' | 'mov' | 'gif' | 'mp3'
  /** Quality preset → libx264 CRF (videoBitrate still drives videotoolbox). */
  quality?: 'low' | 'medium' | 'high'
}

interface RenderClip {
  clip: MediaClip
  source: Source
  trackIndex: number
  inputIndex: number
}

const px = (n: number): number => Math.round(n)
const sec = (n: number): string => n.toFixed(3)

function toFfColor(hex: string): string {
  const h = hex.replace('#', '').slice(0, 6).padEnd(6, '0')
  return `0x${h}`
}

/** Escape user text for an UNQUOTED drawtext value. */
function escapeDrawtext(s: string): string {
  return s
    .replace(/\n/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/'/g, '’')
}

const clamp01n = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

/** atempo only accepts 0.5–2.0 per instance, so chain them to reach any factor. */
function atempoChain(v: number): string[] {
  const out: string[] = []
  let r = v
  while (r > 2) {
    out.push('atempo=2.0')
    r /= 2
  }
  while (r < 0.5) {
    out.push('atempo=0.5')
    r *= 2
  }
  out.push(`atempo=${r.toFixed(4)}`)
  return out
}
function toFfColorA(hex: string, alpha: number): string {
  return `${toFfColor(hex)}@${clamp01n(alpha).toFixed(3)}`
}

// Privacy voice mask: pitch the voice DOWN ~4 semitones while keeping the original
// tempo, so the speaker stays intelligible but unrecognisable (pairs with face-blur for
// anonymising people in consultations). aresample first NORMALISES to 48 kHz so the shift
// ratio is the same whatever the source rate; asetrate=0.8×48k lowers pitch AND formants
// (timbre changes too → harder to recognise); the final atempo restores the duration.
const VOICE_DISGUISE_CHAIN = ['aresample=48000', 'asetrate=38400', 'aresample=48000', 'atempo=1.2500']

/**
 * Build the drawtext filter chain for one text clip, approximating the preview's
 * Canva-style look in ffmpeg: per-line layers, chosen font, colour, highlight box,
 * shadow/lift/outline/hollow/glow effects, opacity and fade/slide/rise animation.
 * (drawtext can't blur, letter-space, fake-bold, pop or typewriter — those are
 * approximated or omitted; preview remains the source of truth for them.)
 */
function drawtextChain(
  tc: TextClip,
  W: number,
  H: number,
  defaultFont: string,
  startLabel: string,
  endLabel: string
): string[] {
  const st = tc.style
  const cssFont = fontFileForCss(st.fontFamily)
  const fontFile = cssFont && existsSync(cssFont) ? cssFont : defaultFont
  const fs = px(st.fontSizeFrac * H)
  const lineH = st.fontSizeFrac * H * (st.lineHeightMul || 1.2)
  const startT = sec(tc.timelineStart)
  const endT = sec(tc.timelineEnd)
  const dur = tc.timelineEnd - tc.timelineStart
  const ad = Math.min(Math.max(0.05, st.animDurSec || 0), dur / 2).toFixed(3)

  // alpha = opacity * optional fade in/out (commas escaped, no surrounding quotes)
  let alpha = clamp01n(st.opacity ?? 1).toFixed(3)
  if (st.animIn === 'fade') alpha += `*min(1\\,max(0\\,(t-${startT})/${ad}))`
  if (st.animOut === 'fade') alpha += `*min(1\\,max(0\\,(${endT}-t)/${ad}))`

  // slide (x) / rise (y) offsets as expressions in t
  let dx = ''
  let dy = ''
  const slideAmt = px(0.18 * W)
  const riseAmt = px(0.9 * fs)
  if (st.animIn === 'slide') dx += `+${slideAmt}*max(0\\,1-(t-${startT})/${ad})`
  if (st.animOut === 'slide') dx += `-${slideAmt}*max(0\\,1-(${endT}-t)/${ad})`
  if (st.animIn === 'rise') dy += `+${riseAmt}*max(0\\,1-(t-${startT})/${ad})`
  if (st.animOut === 'rise') dy += `-${riseAmt}*max(0\\,1-(${endT}-t)/${ad})`

  // effect → drawtext params
  let fontcolor = toFfColor(st.color)
  let borderw = px(st.strokeWidthFrac * H)
  let bordercolor = toFfColor(st.strokeColor)
  let shadow = ''
  const off = px(fs * 0.06 * (0.5 + clamp01n(st.effectIntensity ?? 0.4)))
  switch (st.effect) {
    case 'shadow':
    case 'echo':
    case 'splice':
      shadow = `:shadowx=${off}:shadowy=${off}:shadowcolor=${toFfColorA(st.effectColor, 0.55)}`
      break
    case 'lift':
      shadow = `:shadowx=0:shadowy=${px(fs * 0.05)}:shadowcolor=black@0.45`
      break
    case 'hollow':
      fontcolor = toFfColorA(st.color, 0)
      borderw = Math.max(1, px(fs * 0.04))
      bordercolor = toFfColor(st.color)
      break
    case 'outline':
      borderw = Math.max(1, px(fs * 0.06))
      bordercolor = toFfColor(st.effectColor)
      break
    case 'glow':
    case 'neon':
      borderw = Math.max(1, px(fs * 0.05))
      bordercolor = toFfColor(st.effectColor)
      shadow = `:shadowx=0:shadowy=0:shadowcolor=${toFfColor(st.effectColor)}`
      break
  }
  let box = ''
  if (st.highlight) {
    box = `:box=1:boxcolor=${toFfColorA(st.highlightColor, st.highlightOpacity ?? 1)}:boxborderw=${px(fs * 0.28)}`
  }

  const lines = (tc.text ?? '').split('\n')
  const filters: string[] = []
  let label = startLabel
  lines.forEach((rawLine, i) => {
    const line = rawLine.length ? rawLine : ' '
    const out = i === lines.length - 1 ? endLabel : `${endLabel}_l${i}`
    const xBase =
      st.align === 'left'
        ? `${px(st.posX * W)}`
        : st.align === 'right'
          ? `${px(st.posX * W)}-text_w`
          : `(w-text_w)/2`
    const yBase = `${px(st.posY * H)}-text_h/2+${px((i - (lines.length - 1) / 2) * lineH)}`
    filters.push(
      `[${label}]drawtext=fontfile=${fontFile}:text=${escapeDrawtext(line)}:` +
        `fontsize=${fs}:fontcolor=${fontcolor}:borderw=${borderw}:bordercolor=${bordercolor}` +
        `${shadow}${box}:alpha=${alpha}:x=${dx ? `${xBase}${dx}` : xBase}:y=${dy ? `${yBase}${dy}` : yBase}:` +
        `enable=between(t\\,${startT}\\,${endT})[${out}]`
    )
    label = out
  })
  return filters
}

/** geq-based shape mask (multiplies the clip's alpha) for rect/ellipse with
 *  feather + invert. Coords are in the clip stream's space (canvas px minus the
 *  overlay offset). Single-quoted expressions protect the commas. */
function maskFilter(mask: MediaClip['mask'], overlayX: number, overlayY: number, W: number, H: number): string | null {
  if (mask.shape === 'none') return null
  const cx = (mask.x + mask.w / 2) * W - overlayX
  const cy = (mask.y + mask.h / 2) * H - overlayY
  const rx = Math.max(1, (mask.w * W) / 2)
  const ry = Math.max(1, (mask.h * H) / 2)
  const f = Math.max(0.001, Math.min(0.95, mask.feather))
  let factor: string
  if (mask.shape === 'ellipse') {
    const d = `sqrt(pow((X-${cx.toFixed(1)})/${rx.toFixed(1)},2)+pow((Y-${cy.toFixed(1)})/${ry.toFixed(1)},2))`
    factor = `clip((1-${d})/${f.toFixed(3)},0,1)`
  } else {
    const left = (cx - rx).toFixed(1)
    const right = (cx + rx).toFixed(1)
    const top = (cy - ry).toFixed(1)
    const bottom = (cy + ry).toFixed(1)
    const fpx = Math.max(0.5, f * Math.min(rx, ry)).toFixed(1)
    const ax = `clip(min(X-${left},${right}-X)/${fpx},0,1)`
    const ay = `clip(min(Y-${top},${bottom}-Y)/${fpx},0,1)`
    factor = `min(${ax},${ay})`
  }
  if (mask.invert) factor = `(1-${factor})`
  return `format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${factor})'`
}

/** Time-animated ellipse mask (face-blur tracking): the same geq as maskFilter
 *  but with the centre/radii driven by piecewise-linear expressions of T. */
function animatedMaskFilter(
  kfs: { t: number; mask: MediaClip['mask'] }[],
  timelineStart: number,
  overlayX: number,
  overlayY: number,
  W: number,
  H: number
): string | null {
  if (!kfs.length || kfs[0].mask.shape === 'none') return null
  // Decimate to keep the per-pixel geq expression (and thus export speed) sane.
  const step = Math.max(1, Math.ceil(kfs.length / 24))
  const pts = kfs.filter((_, i) => i % step === 0 || i === kfs.length - 1)
  const times = pts.map((k) => timelineStart + k.t)
  const cx = `(${pwlExpr(times, pts.map((k) => (k.mask.x + k.mask.w / 2) * W - overlayX), 'T')})`
  const cy = `(${pwlExpr(times, pts.map((k) => (k.mask.y + k.mask.h / 2) * H - overlayY), 'T')})`
  const rx = `(${pwlExpr(times, pts.map((k) => Math.max(1, (k.mask.w * W) / 2)), 'T')})`
  const ry = `(${pwlExpr(times, pts.map((k) => Math.max(1, (k.mask.h * H) / 2)), 'T')})`
  const f = Math.max(0.001, Math.min(0.95, kfs[0].mask.feather))
  const d = `sqrt(pow((X-${cx})/${rx},2)+pow((Y-${cy})/${ry},2))`
  let factor = `clip((1-${d})/${f.toFixed(3)},0,1)`
  if (kfs[0].mask.invert) factor = `(1-${factor})`
  return `format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${factor})'`
}

function effectFilters(clip: MediaClip): string[] {
  const out: string[] = []
  const cl01 = (v: number): number => Math.max(0, Math.min(1, v))
  for (const fx of clip.effects) {
    if (!fx.enabled) continue
    const v = fx.params.value ?? 0
    if (fx.type === 'gblur') out.push(`gblur=sigma=${(fx.params.sigma ?? 8).toFixed(2)}`)
    else if (fx.type === 'brightness') out.push(`eq=brightness=${v.toFixed(3)}`)
    else if (fx.type === 'contrast') out.push(`eq=contrast=${(1 + v).toFixed(3)}`)
    else if (fx.type === 'saturation') out.push(`eq=saturation=${(1 + v).toFixed(3)}`)
    else if (fx.type === 'hue') out.push(`hue=h=${v.toFixed(2)}`)
    else if (fx.type === 'grayscale') out.push(`eq=saturation=${(1 - cl01(v)).toFixed(3)}`)
    else if (fx.type === 'sepia') {
      const a = cl01(fx.params.value ?? 0.6)
      const mix = (id1: number, sp: number): string => (id1 * (1 - a) + sp * a).toFixed(3)
      out.push(
        `colorchannelmixer=${mix(1, 0.393)}:${mix(0, 0.769)}:${mix(0, 0.189)}:0:` +
          `${mix(0, 0.349)}:${mix(1, 0.686)}:${mix(0, 0.168)}:0:` +
          `${mix(0, 0.272)}:${mix(0, 0.534)}:${mix(1, 0.131)}:0`
      )
    } else if (fx.type === 'sharpen') out.push(`unsharp=5:5:${(fx.params.value ?? 1).toFixed(2)}:5:5:0`)
    else if (fx.type === 'vignette') out.push(`vignette=PI/${(5 - cl01(fx.params.value ?? 0.5) * 3).toFixed(2)}`)
    else if (fx.type === 'grain') out.push(`noise=alls=${Math.round((fx.params.value ?? 0.3) * 60)}:allf=t`)
    else if (fx.type === 'invert' && (fx.params.value ?? 1) >= 0.5) out.push('negate')
  }
  return out
}

/**
 * Pure: project + options -> ffmpeg argv (excluding the binary). The export
 * twin of the PixiJS compositor; both use resolveClipLayout() so the file
 * matches the preview. Clips are trimmed, time-shifted, cropped/scaled,
 * effected, faded, overlaid (z-ordered) on a black canvas; text is burned;
 * audio is delayed and mixed.
 */
export function buildFfmpegArgs(project: Project, opts: ExportOptions): string[] {
  // Output resolution = canvas × outputScale (1 = 1080p Full HD, 2 = 4K-class). The
  // whole graph renders natively at this size — positions, font sizes and clip
  // scaling all follow — so text stays crisp at 4K. Kept even for H.264.
  const scale = opts.outputScale && opts.outputScale > 0 ? opts.outputScale : 1
  const W = Math.round((project.canvas.width * scale) / 2) * 2
  const H = Math.round((project.canvas.height * scale) / 2) * 2
  const fps = opts.fps && opts.fps > 0 ? opts.fps : project.canvas.fps
  const duration = timelineDuration(project.timeline)
  const srcById = new Map(project.sources.map((s) => [s.id, s]))

  const videoClips: RenderClip[] = []
  project.timeline.tracks.forEach((track, ti) => {
    if (track.type !== 'video' || track.hidden) return
    for (const clip of track.clips) {
      if (!isMediaClip(clip)) continue
      const source = srcById.get(clip.sourceId)
      if (source && source.hasVideo) videoClips.push({ clip, source, trackIndex: ti, inputIndex: -1 })
    }
  })
  // Higher in the track list (lower index) overlays LAST = in front (matches the
  // preview): paint the bottom track first, the top track on top.
  videoClips.sort((a, b) => b.trackIndex - a.trackIndex || a.clip.timelineStart - b.clip.timelineStart)

  const audioClips: RenderClip[] = []
  project.timeline.tracks.forEach((track, ti) => {
    if (track.muted) return
    for (const clip of track.clips) {
      if (!isMediaClip(clip) || clip.mutedAudio) continue
      const source = srcById.get(clip.sourceId)
      if (source && source.hasAudio) audioClips.push({ clip, source, trackIndex: ti, inputIndex: -1 })
    }
  })

  const textClips: TextClip[] = []
  project.timeline.tracks.forEach((track) => {
    if (track.type !== 'text' || track.hidden) return
    for (const clip of track.clips) if (clip.kind === 'text') textClips.push(clip)
  })

  // Transitions (fast export): the cut stays put. The outgoing clip fades out over
  // its last D/2, the incoming one fades in over its first D/2 (a dip transition).
  // The exact slide/wipe/zoom look is reproduced by the hi-fi frame renderer.
  const transFadeIn = new Map<string, number>()
  const transFadeOut = new Map<string, number>()
  for (const track of project.timeline.tracks) {
    if (track.type !== 'video') continue
    const media = track.clips.filter(isMediaClip).sort((a, b) => a.timelineStart - b.timelineStart)
    for (let i = 0; i < media.length; i++) {
      const t = media[i].transitionOut
      if (t && i + 1 < media.length) {
        transFadeOut.set(media[i].id, t.durationSec / 2)
        transFadeIn.set(media[i + 1].id, t.durationSec / 2)
      }
    }
  }

  const inputs: { path: string; pre: string[] }[] = []
  const inputIndexByClip = new Map<string, number>()
  const addInput = (clipId: string, path: string, pre: string[] = []): number => {
    const existing = inputIndexByClip.get(clipId)
    if (existing !== undefined) return existing
    const idx = inputs.length
    inputs.push({ path, pre })
    inputIndexByClip.set(clipId, idx)
    return idx
  }
  // Fast INPUT seek (-ss before -i) jumps straight to each clip's in-point instead
  // of decoding the whole source from 0 — essential when clips start deep into a
  // long recording (e.g. a 40-min Zoom): without it ffmpeg decodes tens of minutes
  // per input before emitting a frame, so a reel export appears to hang / yields an
  // empty file. -copyts keeps the original timestamps so the trim/atrim ranges
  // (still expressed in absolute source seconds) match unchanged. A tiny back-off
  // before the in-point guards against keyframe-rounding dropping the first frame.
  const seekPre = (sourceIn: number): string[] => ['-ss', sec(Math.max(0, sourceIn - 0.5)), '-copyts']
  for (const rc of videoClips) {
    const pre =
      rc.source.kind === 'image'
        ? ['-loop', '1', '-framerate', String(fps), '-t', sec(Math.max(0.1, rc.clip.sourceOut))]
        : seekPre(rc.clip.sourceIn)
    rc.inputIndex = addInput(rc.clip.id, rc.source.path, pre)
  }
  // Audio gets its OWN input (`a:` key), never the video clip's `-i`. When one input
  // feeds both a `[i:v]trim` branch and a `[i:a]atrim` branch, the video branch's
  // keyframe seek + decode starves the shared demuxer and TRUNCATES the audio tail of
  // the clip (worst on short clips: the first cut lost its last ~0.9 s → silence at the
  // start of the export). A dedicated audio `-i` decodes independently and stays gapless.
  for (const rc of audioClips) rc.inputIndex = addInput(`a:${rc.clip.id}`, rc.source.path, seekPre(rc.clip.sourceIn))

  const filters: string[] = []
  filters.push(
    `color=c=${toFfColor(project.canvas.backgroundColor)}:s=${W}x${H}:r=${fps}:d=${sec(duration)}[base]`
  )

  // ---- Video compositing -> [vmix] ----
  let vmix = 'base'
  if (videoClips.length === 0) {
    filters.push(`[base]null[vmix]`)
  } else {
    videoClips.forEach((rc, i) => {
      const { clip, source, inputIndex } = rc
      // Animated clips bake KEYFRAMED POSITION into the overlay x/y expressions
      // (a stream's pixel size is fixed, so scale stays at the first keyframe for
      // now; full scale/opacity animation will come with the frame renderer). The
      // size/crop come from the first keyframe; static clips use clip.transform.
      const kfs = activeKeyframes(clip)
      const baseTransform = kfs ? kfs[0].transform : clip.transform
      const layout = resolveClipLayout(clip.crop, baseTransform, source.width, source.height, W, H)
      const sr = layout.sourceRect
      const cr = layout.contentRect
      const cb = layout.canvasBox

      const speed = clip.speed && clip.speed > 0 ? clip.speed : 1
      const chain: string[] = [
        `[${inputIndex}:v]trim=start=${sec(clip.sourceIn)}:end=${sec(clip.sourceOut)}`,
        ...(clip.reverse ? ['reverse'] : []),
        // Normalizza a frame rate COSTANTE = canvas fps PRIMA di riposizionare: sorgenti a
        // fps diverso (es. 25 in un progetto a 30) o a frame rate VARIABILE (tipico delle
        // dirette/registrazioni) altrimenti scivolano rispetto all'audio (video "rallentato").
        // No-op se la sorgente è già a `fps`.
        `fps=${fps}`,
        // /speed compresses (>1 = faster), then shift to the clip's timeline start.
        `setpts=(PTS-STARTPTS)/${speed.toFixed(4)}+${sec(clip.timelineStart)}/TB`,
        `crop=${px(sr.w)}:${px(sr.h)}:${px(sr.x)}:${px(sr.y)}`,
        `scale=${px(cr.w)}:${px(cr.h)}`
      ]
      if (baseTransform.flipH) chain.push('hflip')
      if (baseTransform.flipV) chain.push('vflip')
      if (clip.chroma) {
        chain.push(
          `chromakey=${toFfColor(clip.chroma.keyColor)}:${clamp01n(clip.chroma.similarity).toFixed(3)}:${clamp01n(clip.chroma.blend).toFixed(3)}`
        )
      }

      let overlayXExpr: string
      let overlayYExpr: string
      let maskOverlayX: number
      let maskOverlayY: number
      if (kfs) {
        // Position animation: overlay x/y as piecewise-linear expressions of t.
        const times = kfs.map((k) => clip.timelineStart + k.t)
        const pos = kfs.map((k) => resolveClipLayout(clip.crop, k.transform, source.width, source.height, W, H).contentRect)
        overlayXExpr = `'${pwlExpr(times, pos.map((p) => Math.round(p.x)))}'`
        overlayYExpr = `'${pwlExpr(times, pos.map((p) => Math.round(p.y)))}'`
        maskOverlayX = px(cr.x)
        maskOverlayY = px(cr.y)
      } else if (layout.clipToBox) {
        chain.push(`crop=${px(cb.w)}:${px(cb.h)}:${px((cr.w - cb.w) / 2)}:${px((cr.h - cb.h) / 2)}`)
        overlayXExpr = String(px(cb.x))
        overlayYExpr = String(px(cb.y))
        maskOverlayX = px(cb.x)
        maskOverlayY = px(cb.y)
      } else {
        overlayXExpr = String(px(cr.x))
        overlayYExpr = String(px(cr.y))
        maskOverlayX = px(cr.x)
        maskOverlayY = px(cr.y)
      }

      // Rotation (static clips only; animated clips rotate via the hi-fi renderer).
      // Rotate the fully-processed clip last, then overlay it re-centred. The mask is
      // baked before the rotation so it rotates together with the content.
      const rotDeg = ((((baseTransform.rotation || 0) % 360) + 360) % 360)
      const doRotate = !kfs && rotDeg !== 0
      let rotW = 0
      let rotH = 0
      let rotRad = 0
      let rotCx = 0
      let rotCy = 0
      if (doRotate) {
        rotRad = (rotDeg * Math.PI) / 180
        const bw = layout.clipToBox ? cb.w : cr.w
        const bh = layout.clipToBox ? cb.h : cr.h
        const bx = layout.clipToBox ? cb.x : cr.x
        const by = layout.clipToBox ? cb.y : cr.y
        const ca = Math.abs(Math.cos(rotRad))
        const sa = Math.abs(Math.sin(rotRad))
        rotW = px(bw * ca + bh * sa)
        rotH = px(bw * sa + bh * ca)
        rotCx = bx + bw / 2
        rotCy = by + bh / 2
      }

      chain.push('setsar=1')
      chain.push(...lookFfmpeg(clip.look?.id, clip.look?.intensity ?? 1))
      chain.push(...effectFilters(clip))
      if (clip.lut) chain.push(`lut3d=file=${clip.lut.replace(/([:\\'])/g, '\\$1')}`)

      const fadeIn = Math.max(clip.fadeInSec, transFadeIn.get(clip.id) ?? 0)
      const fadeOut = Math.max(clip.fadeOutSec, transFadeOut.get(clip.id) ?? 0)
      const needAlpha = fadeIn > 0 || fadeOut > 0 || baseTransform.opacity < 1
      if (needAlpha) chain.push('format=rgba')
      if (fadeIn > 0) chain.push(`fade=t=in:st=${sec(clip.timelineStart)}:d=${sec(fadeIn)}:alpha=1`)
      if (fadeOut > 0)
        chain.push(`fade=t=out:st=${sec(clip.timelineEnd - fadeOut)}:d=${sec(fadeOut)}:alpha=1`)
      if (baseTransform.opacity < 1) chain.push(`colorchannelmixer=aa=${baseTransform.opacity.toFixed(3)}`)

      const mf =
        clip.maskKeyframes && clip.maskKeyframes.length
          ? animatedMaskFilter(clip.maskKeyframes, clip.timelineStart, maskOverlayX, maskOverlayY, W, H)
          : maskFilter(clip.mask, maskOverlayX, maskOverlayY, W, H)
      if (mf) chain.push(mf)

      if (doRotate) {
        if (!needAlpha) chain.push('format=rgba')
        chain.push(`rotate=${rotRad.toFixed(5)}:c=none:ow=${rotW}:oh=${rotH}`)
        overlayXExpr = String(px(rotCx - rotW / 2))
        overlayYExpr = String(px(rotCy - rotH / 2))
      }

      const label = `v${i}`
      filters.push(`${chain.join(',')}[${label}]`)

      const out = i === videoClips.length - 1 ? 'vmix' : `acc${i}`
      filters.push(
        `[${vmix}][${label}]overlay=x=${overlayXExpr}:y=${overlayYExpr}:enable='between(t,${sec(clip.timelineStart)},${sec(clip.timelineEnd)})':eof_action=pass[${out}]`
      )
      vmix = out
    })
  }

  // ---- Text burn-in -> [vout] ----
  let vlabel = vmix
  if (textClips.length > 0 && opts.fontFile) {
    textClips.forEach((tc, i) => {
      const out = i === textClips.length - 1 ? 'vout' : `txt${i}`
      filters.push(...drawtextChain(tc, W, H, opts.fontFile as string, vlabel, out))
      vlabel = out
    })
  } else {
    filters.push(`[${vlabel}]null[vout]`)
    vlabel = 'vout'
  }

  // ---- Audio mix (skipped for GIF, which has no audio) ----
  let audioLabel: string | null = null
  if (opts.format !== 'gif' && audioClips.length > 0) {
    audioClips.forEach((rc, i) => {
      const { clip, inputIndex } = rc
      const delayMs = Math.max(0, Math.round(clip.timelineStart * 1000))
      const aSpeed = clip.speed && clip.speed > 0 ? clip.speed : 1
      const aChain = [
        `[${inputIndex}:a]atrim=start=${sec(clip.sourceIn)}:end=${sec(clip.sourceOut)}`,
        ...(clip.reverse ? ['areverse'] : []),
        `asetpts=PTS-STARTPTS`,
        ...(aSpeed !== 1 ? atempoChain(aSpeed) : []),
        ...(clip.denoise ? ['afftdn=nr=12:nf=-25'] : []),
        ...(clip.voiceDisguise ? VOICE_DISGUISE_CHAIN : []),
        `volume=${clip.volume.toFixed(3)}`
      ]
      if (clip.fadeInSec > 0) aChain.push(`afade=t=in:st=0:d=${sec(clip.fadeInSec)}`)
      if (clip.fadeOutSec > 0) {
        const clipDur = clip.timelineEnd - clip.timelineStart
        aChain.push(`afade=t=out:st=${sec(Math.max(0, clipDur - clip.fadeOutSec))}:d=${sec(clip.fadeOutSec)}`)
      }
      aChain.push(`adelay=${delayMs}|${delayMs}`)
      filters.push(`${aChain.join(',')}[a${i}]`)
    })

    // Ducking: clips marked duck=true are compressed under the rest (the "voice").
    const duckIdx = audioClips.map((rc, i) => ({ rc, i })).filter((x) => x.rc.clip.duck)
    const voiceIdx = audioClips.map((rc, i) => ({ rc, i })).filter((x) => !x.rc.clip.duck)
    if (duckIdx.length > 0 && voiceIdx.length > 0) {
      const mixInto = (labels: string[], out: string): void => {
        if (labels.length === 1) filters.push(`[${labels[0]}]anull[${out}]`)
        else filters.push(`${labels.map((l) => `[${l}]`).join('')}amix=inputs=${labels.length}:normalize=0[${out}]`)
      }
      mixInto(voiceIdx.map((x) => `a${x.i}`), 'vmixraw')
      filters.push('[vmixraw]asplit=2[vkey][vfinal]')
      mixInto(duckIdx.map((x) => `a${x.i}`), 'dmix')
      filters.push('[dmix][vkey]sidechaincompress=threshold=0.04:ratio=10:attack=20:release=350[ducked]')
      filters.push('[ducked][vfinal]amix=inputs=2:normalize=0[aout]')
      audioLabel = 'aout'
    } else if (audioClips.length === 1) {
      audioLabel = 'a0'
    } else {
      const ins = audioClips.map((_, i) => `[a${i}]`).join('')
      filters.push(`${ins}amix=inputs=${audioClips.length}:normalize=0[aout]`)
      audioLabel = 'aout'
    }
  }

  // ---- MP3: audio-only export — build a clean audio pipeline, no video filters ----
  if (opts.format === 'mp3') {
    const mp3Inputs: { path: string; pre: string[] }[] = []
    const mp3IdxMap = new Map<string, number>()
    const addMp3Input = (clipId: string, path: string, pre: string[]): number => {
      const existing = mp3IdxMap.get(clipId)
      if (existing !== undefined) return existing
      const idx = mp3Inputs.length
      mp3Inputs.push({ path, pre })
      mp3IdxMap.set(clipId, idx)
      return idx
    }
    const mp3Filters: string[] = []
    let mp3Label: string | null = null
    if (audioClips.length > 0) {
      audioClips.forEach((rc, i) => {
        const { clip, source } = rc
        // -vn: skip embedded video streams (e.g. cover-art in MP3 files)
        const idx = addMp3Input(clip.id, source.path, ['-vn', ...seekPre(clip.sourceIn)])
        const delayMs = Math.max(0, Math.round(clip.timelineStart * 1000))
        const aSpeed = clip.speed && clip.speed > 0 ? clip.speed : 1
        const aChain = [
          `[${idx}:a]atrim=start=${sec(clip.sourceIn)}:end=${sec(clip.sourceOut)}`,
          ...(clip.reverse ? ['areverse'] : []),
          `asetpts=PTS-STARTPTS`,
          ...(aSpeed !== 1 ? atempoChain(aSpeed) : []),
          ...(clip.denoise ? ['afftdn=nr=12:nf=-25'] : []),
          ...(clip.voiceDisguise ? VOICE_DISGUISE_CHAIN : []),
          `volume=${clip.volume.toFixed(3)}`
        ]
        if (clip.fadeInSec > 0) aChain.push(`afade=t=in:st=0:d=${sec(clip.fadeInSec)}`)
        if (clip.fadeOutSec > 0) {
          const clipDur = clip.timelineEnd - clip.timelineStart
          aChain.push(`afade=t=out:st=${sec(Math.max(0, clipDur - clip.fadeOutSec))}:d=${sec(clip.fadeOutSec)}`)
        }
        aChain.push(`adelay=${delayMs}|${delayMs}`)
        mp3Filters.push(`${aChain.join(',')}[a${i}]`)
      })
      if (audioClips.length === 1) {
        mp3Label = 'a0'
      } else {
        const ins = audioClips.map((_, i) => `[a${i}]`).join('')
        mp3Filters.push(`${ins}amix=inputs=${audioClips.length}:normalize=0[aout]`)
        mp3Label = 'aout'
      }
    }
    const mp3args: string[] = ['-y', '-hide_banner']
    for (const inp of mp3Inputs) mp3args.push(...inp.pre, '-i', inp.path)
    if (mp3Label) {
      mp3args.push('-filter_complex', mp3Filters.join(';'))
      mp3args.push('-map', `[${mp3Label}]`)
      const qVal = opts.quality === 'high' ? '2' : opts.quality === 'low' ? '7' : '4'
      mp3args.push('-c:a', 'libmp3lame', '-q:a', qVal, '-ar', '44100', '-t', sec(duration), opts.outPath)
    } else {
      // No audio in timeline — write a silent mp3
      mp3args.push('-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo`)
      mp3args.push('-c:a', 'libmp3lame', '-q:a', '4', '-t', sec(duration), opts.outPath)
    }
    return mp3args
  }

  // ---- Animated GIF: palette pipeline, no audio, no h264 codec ----
  if (opts.format === 'gif') {
    filters.push(
      `[${vlabel}]fps=${fps},split[gp1][gp2];[gp1]palettegen=stats_mode=diff[gpal];[gp2][gpal]paletteuse=dither=bayer:bayer_scale=3[gifout]`
    )
    const gargs: string[] = ['-y', '-hide_banner']
    for (const inp of inputs) gargs.push(...inp.pre, '-i', inp.path)
    gargs.push('-filter_complex', filters.join(';'))
    gargs.push('-map', '[gifout]', '-t', sec(duration), opts.outPath)
    return gargs
  }

  const args: string[] = ['-y', '-hide_banner']
  for (const inp of inputs) args.push(...inp.pre, '-i', inp.path)
  args.push('-filter_complex', filters.join(';'))
  args.push('-map', `[${vlabel}]`)
  if (audioLabel) args.push('-map', `[${audioLabel}]`)

  const crf = opts.quality === 'high' ? '18' : opts.quality === 'low' ? '25' : '21'
  if (opts.useVideoToolbox) {
    args.push('-c:v', 'h264_videotoolbox', '-b:v', opts.videoBitrate ?? '10M')
  } else {
    args.push('-c:v', 'libx264', '-crf', crf, '-preset', 'veryfast')
  }
  args.push('-pix_fmt', 'yuv420p', '-r', String(fps))
  if (opts.format !== 'mov') args.push('-tag:v', 'avc1')
  if (audioLabel) args.push('-c:a', 'aac', '-b:a', opts.audioBitrate ?? '192k', '-ar', '48000')
  args.push('-movflags', '+faststart', '-t', sec(duration), opts.outPath)
  return args
}
