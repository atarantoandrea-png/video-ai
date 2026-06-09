/**
 * Lazy face detection via @vladmandic/face-api (TinyFaceDetector, ~190 KB model
 * served from /models). Loaded on first use so it doesn't bloat startup. Used to
 * auto-place and track a blur over a speaking face.
 */
export interface FaceBox {
  /** Pixel rectangle in the input's own coordinate space. */
  x: number
  y: number
  w: number
  h: number
  score: number
}

type FaceApi = typeof import('@vladmandic/face-api')
let apiPromise: Promise<FaceApi> | null = null

async function getApi(): Promise<FaceApi> {
  if (!apiPromise) {
    apiPromise = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      // Resolve relative to the current document so it works BOTH in dev
      // (http://localhost/models) and in the packaged app (file://…/out/renderer/models).
      // An absolute '/models' would point at the filesystem root under file://.
      const modelUri = new URL('models', window.location.href).href
      await faceapi.nets.tinyFaceDetector.loadFromUri(modelUri)
      return faceapi
    })()
  }
  return apiPromise
}

/** Pre-load the model (e.g. on first interaction) so detection is instant. */
export async function preloadFaceModel(): Promise<void> {
  await getApi()
}

/** Detect faces in a frame (video/canvas/image). Boxes are in input pixels,
 *  largest first. */
export async function detectFaces(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<FaceBox[]> {
  const faceapi = await getApi()
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 })
  const found = await faceapi.detectAllFaces(input, opts)
  return found
    .map((d) => ({ x: d.box.x, y: d.box.y, w: d.box.width, h: d.box.height, score: d.score }))
    .sort((a, b) => b.w * b.h - a.w * a.h)
}

/** One tracked face sample, normalized 0..1 to the SOURCE frame. */
export interface FaceTrackPoint {
  t: number
  cx: number
  cy: number
  w: number
  h: number
}

/** A detected face, normalized 0..1 to the source frame (largest first). */
export interface NormFace {
  cx: number
  cy: number
  w: number
  h: number
}

/** Detect all faces at `timeSec` of a video, source-normalized (for manual pick). */
export async function detectFacesAt(url: string, timeSec: number): Promise<NormFace[]> {
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.crossOrigin = 'anonymous'
  video.preload = 'auto'
  await new Promise<void>((res, rej) => {
    video.addEventListener('loadeddata', () => res(), { once: true })
    video.addEventListener('error', () => rej(new Error('caricamento fallito')), { once: true })
  })
  const vw = video.videoWidth || 1
  const vh = video.videoHeight || 1
  await seekTo(video, timeSec)
  let faces: FaceBox[] = []
  try {
    faces = await detectFaces(video)
  } catch {
    /* none */
  }
  video.pause()
  video.removeAttribute('src')
  video.load()
  return faces.map((f) => ({ cx: (f.x + f.w / 2) / vw, cy: (f.y + f.h / 2) / vh, w: f.w / vw, h: f.h / vh }))
}

/** Letterbox/pillarbox content bounds at a time, source-normalized 0..1. Lets the
 *  reframe crop away black bars (e.g. a Zoom gallery) without depending on faces. */
export async function detectContentBounds(
  url: string,
  timeSec: number
): Promise<{ top: number; bottom: number; left: number; right: number }> {
  const full = { top: 0, bottom: 1, left: 0, right: 1 }
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.crossOrigin = 'anonymous'
  video.preload = 'auto'
  try {
    await new Promise<void>((res, rej) => {
      video.addEventListener('loadeddata', () => res(), { once: true })
      video.addEventListener('error', () => rej(new Error('caricamento fallito')), { once: true })
    })
    const vw = video.videoWidth || 1
    const vh = video.videoHeight || 1
    await seekTo(video, timeSec)
    const W = 80
    const H = Math.max(2, Math.round((80 * vh) / vw))
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    if (!ctx) return full
    ctx.drawImage(video, 0, 0, W, H)
    const data = ctx.getImageData(0, 0, W, H).data
    const THRESH = 20 // average luma below this = a black bar
    const rowLit = (y: number): boolean => {
      let s = 0
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        s += (data[i] + data[i + 1] + data[i + 2]) / 3
      }
      return s / W > THRESH
    }
    const colLit = (x: number): boolean => {
      let s = 0
      for (let y = 0; y < H; y++) {
        const i = (y * W + x) * 4
        s += (data[i] + data[i + 1] + data[i + 2]) / 3
      }
      return s / H > THRESH
    }
    let top = 0
    while (top < H && !rowLit(top)) top++
    let bot = H - 1
    while (bot > top && !rowLit(bot)) bot--
    let left = 0
    while (left < W && !colLit(left)) left++
    let right = W - 1
    while (right > left && !colLit(right)) right--
    const out = { top: top / H, bottom: (bot + 1) / H, left: left / W, right: (right + 1) / W }
    if (out.bottom - out.top < 0.2) {
      out.top = 0
      out.bottom = 1
    }
    if (out.right - out.left < 0.2) {
      out.left = 0
      out.right = 1
    }
    return out
  } catch {
    return full
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
}

function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((res) => {
    const onSeeked = (): void => {
      v.removeEventListener('seeked', onSeeked)
      res()
    }
    v.addEventListener('seeked', onSeeked)
    v.currentTime = t
  })
}

/**
 * Detect a face across `sampleTimes` of a video, following the same face frame to
 * frame (nearest to the previous detection). Returns source-normalized points.
 */
export async function buildFaceTrack(
  url: string,
  sampleTimes: number[],
  onProgress?: (done: number, total: number) => void,
  seed?: { cx: number; cy: number }
): Promise<FaceTrackPoint[]> {
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.crossOrigin = 'anonymous'
  video.preload = 'auto'
  await new Promise<void>((res, rej) => {
    video.addEventListener('loadeddata', () => res(), { once: true })
    video.addEventListener('error', () => rej(new Error('caricamento fallito')), { once: true })
  })
  const vw = video.videoWidth || 1
  const vh = video.videoHeight || 1
  const out: FaceTrackPoint[] = []
  // Seed with the user-selected face so the track follows THAT face, not the largest.
  let prev: { cx: number; cy: number } | null = seed ?? null
  for (let i = 0; i < sampleTimes.length; i++) {
    await seekTo(video, sampleTimes[i])
    let faces: FaceBox[] = []
    try {
      faces = await detectFaces(video)
    } catch {
      /* skip this frame */
    }
    if (faces.length) {
      let pick: FaceBox = faces[0]
      if (prev) {
        let bestD = Infinity
        for (const f of faces) {
          const d = Math.hypot((f.x + f.w / 2) / vw - prev.cx, (f.y + f.h / 2) / vh - prev.cy)
          if (d < bestD) {
            bestD = d
            pick = f
          }
        }
      }
      const cx = (pick.x + pick.w / 2) / vw
      const cy = (pick.y + pick.h / 2) / vh
      out.push({ t: sampleTimes[i], cx, cy, w: pick.w / vw, h: pick.h / vh })
      prev = { cx, cy }
    }
    onProgress?.(i + 1, sampleTimes.length)
  }
  video.pause()
  video.removeAttribute('src')
  video.load()
  return out
}
