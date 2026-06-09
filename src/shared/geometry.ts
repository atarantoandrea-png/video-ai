import type { CropRect, FitMode, Transform } from './projectSchema'

/**
 * Geometry shared IDENTICALLY by the PixiJS preview compositor and the ffmpeg
 * export builder. This is the parity guarantee: if both engines derive their
 * pixel rectangles from these functions, "what you see is what you export".
 *
 * Coordinate conventions:
 *  - crop      : normalized 0..1 against the SOURCE dimensions (the sub-rect to take).
 *  - transform : normalized 0..1 against the CANVAS dimensions (where it lands).
 *  - returned rects are in pixels (source pixels or canvas pixels respectively).
 */
export interface PixelRect {
  x: number
  y: number
  w: number
  h: number
}

/** The pixel sub-rectangle of the source selected by `crop`. */
export function cropToSourceRect(crop: CropRect, sourceW: number, sourceH: number): PixelRect {
  return {
    x: clampInt(crop.x * sourceW, 0, sourceW),
    y: clampInt(crop.y * sourceH, 0, sourceH),
    w: clampInt(crop.w * sourceW, 1, sourceW),
    h: clampInt(crop.h * sourceH, 1, sourceH)
  }
}

/** The pixel box on the canvas selected by `transform` (before fit is applied). */
export function transformToCanvasBox(t: Transform, canvasW: number, canvasH: number): PixelRect {
  return {
    x: t.x * canvasW,
    y: t.y * canvasH,
    w: t.w * canvasW,
    h: t.h * canvasH
  }
}

/**
 * Given the pixel size of the cropped content and a destination box, return the
 * rectangle where the content is actually drawn under the given fit mode.
 *  - stretch : exactly the box (aspect distorted).
 *  - contain : scaled to fit inside the box, centered (letterboxed).
 *  - cover   : scaled to cover the box, centered (overflow must be clipped to box).
 */
export function fitContentRect(
  contentW: number,
  contentH: number,
  box: PixelRect,
  fit: FitMode
): PixelRect {
  if (fit === 'stretch' || contentW <= 0 || contentH <= 0) {
    return { ...box }
  }
  const scaleContain = Math.min(box.w / contentW, box.h / contentH)
  const scaleCover = Math.max(box.w / contentW, box.h / contentH)
  const scale = fit === 'cover' ? scaleCover : scaleContain
  const w = contentW * scale
  const h = contentH * scale
  return {
    x: box.x + (box.w - w) / 2,
    y: box.y + (box.h - h) / 2,
    w,
    h
  }
}

export interface ResolvedClipLayout {
  /** Pixel sub-rect of the source to sample. */
  sourceRect: PixelRect
  /** Pixel box on the canvas the clip occupies. */
  canvasBox: PixelRect
  /** Where the (scaled) content is drawn; equals canvasBox for stretch. */
  contentRect: PixelRect
  /** True when content overflows the box and must be clipped to canvasBox (cover). */
  clipToBox: boolean
}

/**
 * Resolve the full pixel layout of a media clip. Both the preview and the export
 * call this so their geometry can never drift.
 */
export function resolveClipLayout(
  crop: CropRect,
  transform: Transform,
  sourceW: number,
  sourceH: number,
  canvasW: number,
  canvasH: number
): ResolvedClipLayout {
  const sourceRect = cropToSourceRect(crop, sourceW, sourceH)
  const canvasBox = transformToCanvasBox(transform, canvasW, canvasH)
  const contentRect = fitContentRect(sourceRect.w, sourceRect.h, canvasBox, transform.fit)
  const clipToBox = transform.fit === 'cover'
  return { sourceRect, canvasBox, contentRect, clipToBox }
}

function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)))
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
