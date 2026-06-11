import { FORMATS, type CaroselloProject, type PhotoLayer, type Slide, type TextLayer } from './types'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = (): void => resolve(img)
    img.onerror = (): void => reject(new Error('image load failed'))
    img.src = src
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Split text into display lines, honoring explicit \n and word-wrapping to maxW. */
export function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number
): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (para === '') {
      out.push('')
      continue
    }
    const words = para.split(/\s+/)
    let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line)
        line = w
      } else {
        line = test
      }
    }
    if (line) out.push(line)
  }
  return out
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number): void {
  const ar = img.width / img.height
  const car = W / H
  let dw: number, dh: number
  if (ar > car) {
    dh = H
    dw = H * ar
  } else {
    dw = W
    dh = W / ar
  }
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
}

function drawPhoto(
  ctx: CanvasRenderingContext2D,
  p: PhotoLayer,
  img: HTMLImageElement,
  W: number,
  H: number
): void {
  const dispH = p.heightFrac * H
  const ar = img.width / img.height
  const dispW = dispH * ar
  ctx.save()
  ctx.globalAlpha = p.opacity
  ctx.translate(p.xFrac * W, p.yFrac * H)
  if (p.rotation) ctx.rotate((p.rotation * Math.PI) / 180)
  if (p.flip) ctx.scale(-1, 1)
  if (p.grayscale) ctx.filter = 'grayscale(1)'
  ctx.drawImage(img, -dispW / 2, -dispH / 2, dispW, dispH)
  ctx.restore()
}

function drawText(ctx: CanvasRenderingContext2D, t: TextLayer, W: number, H: number): void {
  const fontPx = t.fontSizeFrac * H
  const weight = t.bold ? '700' : '400'
  const italic = t.italic ? 'italic ' : ''
  ctx.save()
  ctx.globalAlpha = t.opacity
  ctx.font = `${italic}${weight} ${fontPx}px ${t.fontFamily}`
  ctx.textBaseline = 'alphabetic'
  const text = t.uppercase ? t.text.toUpperCase() : t.text
  const maxW = t.widthFrac * W
  const lines = wrapLines(ctx, text, maxW)
  const lineH = fontPx * t.lineHeightMul
  const blockH = lineH * lines.length
  const cx = t.xFrac * W
  const cy = t.yFrac * H
  const boxLeft = cx - maxW / 2
  let y = cy - blockH / 2 + fontPx * 0.8
  for (const line of lines) {
    const wls = ctx.measureText(line).width
    let x: number
    if (t.align === 'center') x = cx - wls / 2
    else if (t.align === 'right') x = boxLeft + maxW - wls
    else x = boxLeft
    if (t.highlight && line) {
      const padX = fontPx * 0.22
      const padY = fontPx * 0.1
      ctx.save()
      ctx.globalAlpha = t.opacity
      ctx.fillStyle = t.highlightColor
      roundRect(ctx, x - padX, y - fontPx * 0.82 - padY, wls + padX * 2, fontPx + padY * 2, fontPx * 0.16)
      ctx.fill()
      ctx.restore()
    }
    if (t.shadow) {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.45)'
      ctx.shadowBlur = fontPx * 0.12
      ctx.shadowOffsetX = fontPx * 0.03
      ctx.shadowOffsetY = fontPx * 0.06
      ctx.fillStyle = t.color
      ctx.fillText(line, x, y)
      ctx.restore()
    } else {
      ctx.fillStyle = t.color
      ctx.fillText(line, x, y)
    }
    y += lineH
  }
  ctx.restore()
}

/** Render one slide to a full-resolution canvas. */
export async function renderSlide(slide: Slide, format: CaroselloProject['format']): Promise<HTMLCanvasElement> {
  const { w: W, h: H } = FORMATS[format]
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')

  ctx.fillStyle = slide.bgColor || '#ffffff'
  ctx.fillRect(0, 0, W, H)

  if (slide.bg) {
    try {
      drawCover(ctx, await loadImage(slide.bg), W, H)
    } catch {
      /* ignore broken bg */
    }
  }

  for (const lay of slide.layers) {
    if (lay.kind === 'photo') {
      try {
        drawPhoto(ctx, lay, await loadImage(lay.src), W, H)
      } catch {
        /* ignore */
      }
    } else {
      drawText(ctx, lay, W, H)
    }
  }
  return canvas
}

function downloadDataUrl(name: string, dataUrl: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Export every slide as a PNG (sequential downloads). */
export async function exportAllPng(project: CaroselloProject): Promise<number> {
  let i = 0
  for (const slide of project.slides) {
    i++
    const canvas = await renderSlide(slide, project.format)
    const url = canvas.toDataURL('image/png')
    downloadDataUrl(`carosello-slide-${String(i).padStart(2, '0')}.png`, url)
    await new Promise((r) => setTimeout(r, 350))
  }
  return i
}

/** Export a single slide PNG. */
export async function exportOnePng(slide: Slide, format: CaroselloProject['format'], index: number): Promise<void> {
  const canvas = await renderSlide(slide, format)
  downloadDataUrl(`carosello-slide-${String(index + 1).padStart(2, '0')}.png`, canvas.toDataURL('image/png'))
}
