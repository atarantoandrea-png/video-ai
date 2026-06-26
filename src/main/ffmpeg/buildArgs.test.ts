import { describe, it, expect } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import ffmpegPath from 'ffmpeg-static'
import ffprobe from 'ffprobe-static'
import { buildFfmpegArgs } from './buildArgs'
import {
  createMediaClip,
  createProject,
  createTextClip,
  createTrack,
  type Project,
  type Source
} from '@shared/projectSchema'

const FONTS = [
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/System/Library/Fonts/Supplemental/Helvetica.ttf',
  '/Library/Fonts/Arial.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
  '/System/Library/Fonts/Avenir.ttc'
]
const resolveFont = (): string | undefined => FONTS.find((p) => existsSync(p))

function sourceFixture(): Source {
  return {
    id: 'src1',
    path: SAMPLE,
    fileName: 'two-people.mp4',
    kind: 'video',
    durationSec: 6,
    width: 1920,
    height: 1080,
    fps: 30,
    hasVideo: true,
    hasAudio: true,
    videoCodec: 'h264',
    rotation: 0,
    proxyPath: null,
    thumbnailPath: null,
    timelineThumbsPath: null,
    timelineThumbCols: null,
    waveformPath: null,
    peaks: null
  }
}

const pexec = promisify(execFile)
const SAMPLE = resolve(process.cwd(), 'samples/two-people.mp4')

/** A 9:16 project that stacks the two halves of the source vertically. */
function stackProject(): Project {
  const project = createProject('test', '9:16')
  project.sources.push(sourceFixture())

  const mainTrack = project.timeline.tracks[0]
  const top = createMediaClip({ trackId: mainTrack.id, sourceId: 'src1', sourceIn: 0, sourceOut: 6, timelineStart: 0 })
  top.crop = { x: 0, y: 0, w: 0.5, h: 1 }
  top.transform = { ...top.transform, x: 0, y: 0, w: 1, h: 0.5, fit: 'cover' }
  mainTrack.clips.push(top)

  const overlay = createTrack('video', 'Overlay')
  project.timeline.tracks.push(overlay)
  const bottom = createMediaClip({ trackId: overlay.id, sourceId: 'src1', sourceIn: 0, sourceOut: 6, timelineStart: 0 })
  bottom.crop = { x: 0.5, y: 0, w: 0.5, h: 1 }
  bottom.transform = { ...bottom.transform, x: 0, y: 0.5, w: 1, h: 0.5, fit: 'cover' }
  overlay.clips.push(bottom)

  return project
}

describe('buildFfmpegArgs', () => {
  it('builds a coherent arg list for a 2-person vertical stack', () => {
    const args = buildFfmpegArgs(stackProject(), { outPath: '/tmp/out.mp4', useVideoToolbox: false })
    expect(args[0]).toBe('-y')
    // 2 video inputs (top/bottom crops) + 2 DEDICATED audio inputs: audio never shares
    // a clip's video `-i`, else the video branch's seek/decode truncates the audio tail.
    expect(args.filter((a) => a === '-i').length).toBe(4)
    const fc = args[args.indexOf('-filter_complex') + 1]
    expect(fc).toContain('crop=960:1080:0:0') // left half of source
    expect(fc).toContain('crop=960:1080:960:0') // right half of source
    expect(fc).toContain('overlay=')
    expect(args).toContain('[vout]')
    expect(args[args.length - 1]).toBe('/tmp/out.mp4')
  })

  it('selects hardware encoder when requested', () => {
    const args = buildFfmpegArgs(stackProject(), { outPath: '/tmp/o.mp4', useVideoToolbox: true })
    expect(args).toContain('h264_videotoolbox')
  })

  it('applies the privacy voice mask (pitch-down chain) only when voiceDisguise is set', () => {
    const plain = stackProject()
    const fcPlain = buildFfmpegArgs(plain, { outPath: '/tmp/o.mp4', useVideoToolbox: false })[
      buildFfmpegArgs(plain, { outPath: '/tmp/o.mp4', useVideoToolbox: false }).indexOf('-filter_complex') + 1
    ]
    expect(fcPlain).not.toContain('asetrate=38400')

    const masked = stackProject()
    ;(masked.timeline.tracks[0].clips[0] as { voiceDisguise?: boolean }).voiceDisguise = true
    const args = buildFfmpegArgs(masked, { outPath: '/tmp/o.mp4', useVideoToolbox: false })
    const fc = args[args.indexOf('-filter_complex') + 1]
    expect(fc).toContain('asetrate=38400') // pitch down
    expect(fc).toContain('atempo=1.2500') // restore tempo
  })
})

describe('export integration (spawns ffmpeg)', () => {
  it('renders a real 1080x1920 mp4 from the sample', async () => {
    if (!existsSync(SAMPLE)) {
      console.warn('sample video missing — skipping integration test')
      return
    }
    const out = '/tmp/videoai-export-test.mp4'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const args = buildFfmpegArgs(stackProject(), {
      outPath: out,
      useVideoToolbox: false,
      videoBitrate: '6M'
    })
    await pexec(ffmpegPath as unknown as string, args, { maxBuffer: 1 << 24 })
    expect(existsSync(out)).toBe(true)

    const { stdout } = await pexec(ffprobe.path, [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      out
    ])
    expect(stdout.trim()).toBe('1080,1920')
  }, 90000)

  it('renders a keyframed (position-animated) clip', async () => {
    if (!existsSync(SAMPLE)) {
      console.warn('sample video missing — skipping integration test')
      return
    }
    const project = createProject('anim', '9:16')
    project.sources.push(sourceFixture())
    const v = project.timeline.tracks[0]
    const clip = createMediaClip({ trackId: v.id, sourceId: 'src1', sourceIn: 0, sourceOut: 4, timelineStart: 0 })
    const tA = { x: 0, y: 0, w: 0.5, h: 0.5, rotation: 0, opacity: 1, fit: 'contain' as const, flipH: false, flipV: false }
    const tB = { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1, fit: 'contain' as const, flipH: false, flipV: false }
    clip.transform = { ...tA }
    clip.keyframes = [
      { t: 0, transform: tA },
      { t: 4, transform: tB }
    ]
    v.clips.push(clip)

    const out = '/tmp/videoai-anim-test.mp4'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const args = buildFfmpegArgs(project, { outPath: out, useVideoToolbox: false, videoBitrate: '6M' })
    await pexec(ffmpegPath as unknown as string, args, { maxBuffer: 1 << 24 })
    expect(existsSync(out)).toBe(true)
  }, 90000)

  it('renders a face-blur overlay with an ANIMATED mask (geq over time)', async () => {
    if (!existsSync(SAMPLE)) {
      console.warn('sample video missing — skipping integration test')
      return
    }
    const project = createProject('faceblur', '9:16')
    project.sources.push(sourceFixture())
    const v = project.timeline.tracks[0]
    const clip = createMediaClip({ trackId: v.id, sourceId: 'src1', sourceIn: 0, sourceOut: 2, timelineStart: 0 })
    clip.effects.push({ id: 'fx1', type: 'gblur', enabled: true, params: { sigma: 20 } })
    const mk = (x: number, y: number): { shape: 'ellipse'; x: number; y: number; w: number; h: number; feather: number; invert: boolean } => ({
      shape: 'ellipse',
      x,
      y,
      w: 0.3,
      h: 0.3,
      feather: 0.4,
      invert: false
    })
    clip.mask = mk(0.2, 0.2)
    clip.maskKeyframes = [
      { t: 0, mask: mk(0.2, 0.2) },
      { t: 1, mask: mk(0.4, 0.3) },
      { t: 2, mask: mk(0.55, 0.45) }
    ]
    v.clips.push(clip)

    const out = '/tmp/videoai-faceblur-test.mp4'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const args = buildFfmpegArgs(project, { outPath: out, useVideoToolbox: false, videoBitrate: '6M' })
    await pexec(ffmpegPath as unknown as string, args, { maxBuffer: 1 << 24 })
    expect(existsSync(out)).toBe(true)
  }, 120000)

  it('renders with blur, color, fades and burned-in text', async () => {
    if (!existsSync(SAMPLE)) {
      console.warn('sample video missing — skipping integration test')
      return
    }
    const project = createProject('rich', '9:16')
    project.sources.push(sourceFixture())
    const v = project.timeline.tracks[0]
    const clip = createMediaClip({ trackId: v.id, sourceId: 'src1', sourceIn: 0, sourceOut: 6, timelineStart: 0 })
    clip.effects.push({ id: 'fx1', type: 'gblur', enabled: true, params: { sigma: 6 } })
    clip.effects.push({ id: 'fx2', type: 'saturation', enabled: true, params: { value: -1 } })
    clip.fadeInSec = 0.5
    clip.fadeOutSec = 0.5
    v.clips.push(clip)
    const textTrack = createTrack('text', 'Testo')
    project.timeline.tracks.push(textTrack)
    textTrack.clips.push(
      createTextClip({ trackId: textTrack.id, text: "Ciao, mondo: l'AI taglia!", timelineStart: 1, durationSec: 3 })
    )

    const out = '/tmp/videoai-rich-test.mp4'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const args = buildFfmpegArgs(project, {
      outPath: out,
      useVideoToolbox: false,
      videoBitrate: '6M',
      fontFile: resolveFont()
    })
    await pexec(ffmpegPath as unknown as string, args, { maxBuffer: 1 << 24 })
    expect(existsSync(out)).toBe(true)
    const { stdout } = await pexec(ffprobe.path, [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      out
    ])
    expect(stdout.trim()).toBe('1080,1920')
  }, 90000)

  it('renders Canva-style text (highlight, neon, fade+slide, multi-line, custom font)', async () => {
    if (!existsSync(SAMPLE)) return
    const project = createProject('canva-text', '9:16')
    project.sources.push(sourceFixture())
    const v = project.timeline.tracks[0]
    v.clips.push(createMediaClip({ trackId: v.id, sourceId: 'src1', sourceIn: 0, sourceOut: 4, timelineStart: 0 }))
    const tt = createTrack('text', 'Testo')
    project.timeline.tracks.push(tt)
    const tc = createTextClip({ trackId: tt.id, text: 'Riga uno\nRiga due', timelineStart: 0.5, durationSec: 3 })
    tc.style.highlight = true
    tc.style.highlightColor = '#1fe6c2'
    tc.style.highlightOpacity = 0.8
    tc.style.effect = 'neon'
    tc.style.effectColor = '#ff2db4'
    tc.style.opacity = 0.85
    tc.style.animIn = 'fade'
    tc.style.animOut = 'slide'
    tc.style.fontFamily = 'Arial, sans-serif'
    tt.clips.push(tc)
    const out = '/tmp/videoai-canvatext-test.mp4'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const args = buildFfmpegArgs(project, {
      outPath: out,
      useVideoToolbox: false,
      videoBitrate: '6M',
      fontFile: resolveFont()
    })
    await pexec(ffmpegPath as unknown as string, args, { maxBuffer: 1 << 24 })
    expect(existsSync(out)).toBe(true)
  }, 90000)

  it('renders a rotated + flipped clip', async () => {
    if (!existsSync(SAMPLE)) return
    const project = createProject('rotflip', '9:16')
    project.sources.push(sourceFixture())
    const v = project.timeline.tracks[0]
    const clip = createMediaClip({ trackId: v.id, sourceId: 'src1', sourceIn: 0, sourceOut: 2, timelineStart: 0 })
    clip.transform.rotation = 30
    clip.transform.flipH = true
    clip.transform.w = 0.6
    clip.transform.h = 0.6
    clip.transform.fit = 'contain'
    v.clips.push(clip)
    const out = '/tmp/videoai-rotflip-test.mp4'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const args = buildFfmpegArgs(project, { outPath: out, useVideoToolbox: false, videoBitrate: '6M' })
    await pexec(ffmpegPath as unknown as string, args, { maxBuffer: 1 << 24 })
    expect(existsSync(out)).toBe(true)
  }, 90000)

  it('exports at 4K-class resolution when outputScale=2', async () => {
    if (!existsSync(SAMPLE)) return
    const project = createProject('4k', '16:9')
    project.sources.push(sourceFixture())
    const v = project.timeline.tracks[0]
    v.clips.push(createMediaClip({ trackId: v.id, sourceId: 'src1', sourceIn: 0, sourceOut: 2, timelineStart: 0 }))
    const out = '/tmp/videoai-4k-test.mp4'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const args = buildFfmpegArgs(project, {
      outPath: out,
      useVideoToolbox: false,
      videoBitrate: '8M',
      outputScale: 2
    })
    await pexec(ffmpegPath as unknown as string, args, { maxBuffer: 1 << 24 })
    const { stdout } = await pexec(ffprobe.path, [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      out
    ])
    expect(stdout.trim()).toBe('3840,2160')
  }, 90000)

  it('renders a 2x sped-up + reversed clip (setpts/atempo/reverse)', async () => {
    if (!existsSync(SAMPLE)) return
    const project = createProject('speed', '9:16')
    project.sources.push(sourceFixture())
    const v = project.timeline.tracks[0]
    const clip = createMediaClip({ trackId: v.id, sourceId: 'src1', sourceIn: 0, sourceOut: 4, timelineStart: 0 })
    clip.speed = 2
    clip.reverse = true
    clip.timelineEnd = clip.timelineStart + (clip.sourceOut - clip.sourceIn) / clip.speed
    v.clips.push(clip)
    const a = createTrack('audio', 'Audio')
    project.timeline.tracks.push(a)
    const ac = createMediaClip({ trackId: a.id, sourceId: 'src1', sourceIn: 0, sourceOut: 4, timelineStart: 0 })
    ac.speed = 2
    ac.timelineEnd = (ac.sourceOut - ac.sourceIn) / ac.speed
    a.clips.push(ac)
    const out = '/tmp/videoai-speed-test.mp4'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const args = buildFfmpegArgs(project, { outPath: out, useVideoToolbox: false, videoBitrate: '6M' })
    await pexec(ffmpegPath as unknown as string, args, { maxBuffer: 1 << 24 })
    expect(existsSync(out)).toBe(true)
  }, 90000)

  it('applies a 3D LUT (.cube) on export', async () => {
    if (!existsSync(SAMPLE)) return
    const lutPath = '/tmp/videoai-identity.cube'
    // Minimal identity LUT.
    const lines = ['LUT_3D_SIZE 2']
    for (let b = 0; b < 2; b++)
      for (let g = 0; g < 2; g++) for (let r = 0; r < 2; r++) lines.push(`${r} ${g} ${b}`)
    writeFileSync(lutPath, lines.join('\n'))
    const project = createProject('lut', '9:16')
    project.sources.push(sourceFixture())
    const v = project.timeline.tracks[0]
    const clip = createMediaClip({ trackId: v.id, sourceId: 'src1', sourceIn: 0, sourceOut: 2, timelineStart: 0 })
    clip.lut = lutPath
    v.clips.push(clip)
    const out = '/tmp/videoai-lut-test.mp4'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const args = buildFfmpegArgs(project, { outPath: out, useVideoToolbox: false, videoBitrate: '6M' })
    await pexec(ffmpegPath as unknown as string, args, { maxBuffer: 1 << 24 })
    expect(existsSync(out)).toBe(true)
  }, 90000)

  it('renders a chroma-keyed clip over a background', async () => {
    if (!existsSync(SAMPLE)) return
    const project = createProject('chroma', '9:16')
    project.sources.push(sourceFixture())
    const bg = project.timeline.tracks[0]
    bg.clips.push(createMediaClip({ trackId: bg.id, sourceId: 'src1', sourceIn: 0, sourceOut: 2, timelineStart: 0 }))
    const fgTrack = createTrack('video', 'Overlay')
    project.timeline.tracks.unshift(fgTrack)
    const fg = createMediaClip({ trackId: fgTrack.id, sourceId: 'src1', sourceIn: 0, sourceOut: 2, timelineStart: 0 })
    fg.chroma = { keyColor: '#00ff00', similarity: 0.3, blend: 0.1 }
    fg.transform.w = 0.5
    fg.transform.h = 0.5
    fg.transform.fit = 'contain'
    fgTrack.clips.push(fg)
    const out = '/tmp/videoai-chroma-test.mp4'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const args = buildFfmpegArgs(project, { outPath: out, useVideoToolbox: false, videoBitrate: '6M' })
    await pexec(ffmpegPath as unknown as string, args, { maxBuffer: 1 << 24 })
    expect(existsSync(out)).toBe(true)
  }, 90000)

  it('renders a crossfade transition between two clips', async () => {
    if (!existsSync(SAMPLE)) return
    const project = createProject('trans', '9:16')
    project.sources.push(sourceFixture())
    const v = project.timeline.tracks[0]
    const a = createMediaClip({ trackId: v.id, sourceId: 'src1', sourceIn: 0, sourceOut: 2, timelineStart: 0 })
    a.transitionOut = { type: 'xfade', preset: 'fade', durationSec: 0.5 }
    const b = createMediaClip({ trackId: v.id, sourceId: 'src1', sourceIn: 2, sourceOut: 4, timelineStart: 1.5 }) // overlaps a by 0.5
    v.clips.push(a, b)
    const out = '/tmp/videoai-trans-test.mp4'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const args = buildFfmpegArgs(project, { outPath: out, useVideoToolbox: false, videoBitrate: '6M' })
    await pexec(ffmpegPath as unknown as string, args, { maxBuffer: 1 << 24 })
    expect(existsSync(out)).toBe(true)
  }, 90000)

  it('renders ducking + noise reduction (sidechain + afftdn)', async () => {
    if (!existsSync(SAMPLE)) return
    const project = createProject('audio', '9:16')
    project.sources.push(sourceFixture())
    const v = project.timeline.tracks[0]
    const voice = createMediaClip({ trackId: v.id, sourceId: 'src1', sourceIn: 0, sourceOut: 3, timelineStart: 0 })
    voice.denoise = true
    v.clips.push(voice)
    const a = createTrack('audio', 'Musica')
    project.timeline.tracks.push(a)
    const music = createMediaClip({ trackId: a.id, sourceId: 'src1', sourceIn: 0, sourceOut: 3, timelineStart: 0 })
    music.duck = true
    a.clips.push(music)
    const out = '/tmp/videoai-audio-test.mp4'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const args = buildFfmpegArgs(project, { outPath: out, useVideoToolbox: false, videoBitrate: '6M' })
    await pexec(ffmpegPath as unknown as string, args, { maxBuffer: 1 << 24 })
    expect(existsSync(out)).toBe(true)
  }, 90000)

  it('exports an animated GIF (palette pipeline, no audio)', async () => {
    if (!existsSync(SAMPLE)) return
    const project = createProject('gif', '16:9')
    project.sources.push(sourceFixture())
    const v = project.timeline.tracks[0]
    v.clips.push(createMediaClip({ trackId: v.id, sourceId: 'src1', sourceIn: 0, sourceOut: 1.5, timelineStart: 0 }))
    const out = '/tmp/videoai-gif-test.gif'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const args = buildFfmpegArgs(project, { outPath: out, useVideoToolbox: false, format: 'gif', fps: 12, outputScale: 0.6667 })
    await pexec(ffmpegPath as unknown as string, args, { maxBuffer: 1 << 24 })
    expect(existsSync(out)).toBe(true)
    const { stdout } = await pexec(ffprobe.path, [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      out
    ])
    // 16:9 1080-base canvas × 0.6667 ≈ 720p
    expect(stdout.trim()).toBe('1280,720')
  }, 90000)

  it('renders an ellipse-masked, blurred clip (blur-a-region)', async () => {
    if (!existsSync(SAMPLE)) return
    const project = createProject('mask', '9:16')
    project.sources.push(sourceFixture())
    const v = project.timeline.tracks[0]
    const clip = createMediaClip({ trackId: v.id, sourceId: 'src1', sourceIn: 0, sourceOut: 4, timelineStart: 0 })
    clip.effects.push({ id: 'fx', type: 'gblur', enabled: true, params: { sigma: 16 } })
    clip.mask = { shape: 'ellipse', x: 0.3, y: 0.3, w: 0.4, h: 0.4, feather: 0.3, invert: false }
    v.clips.push(clip)
    const out = '/tmp/videoai-mask-test.mp4'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const args = buildFfmpegArgs(project, { outPath: out, useVideoToolbox: false, videoBitrate: '6M' })
    await pexec(ffmpegPath as unknown as string, args, { maxBuffer: 1 << 24 })
    expect(existsSync(out)).toBe(true)
    const { stdout } = await pexec(ffprobe.path, [
      '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', out
    ])
    expect(stdout.trim()).toBe('1080,1920')
  }, 90000)

  it('renders an image source clip (-loop input)', async () => {
    const IMG = resolve(process.cwd(), 'samples/test.png')
    if (!existsSync(IMG)) return
    const project = createProject('img', '9:16')
    const imgSrc: Source = {
      id: 'img1',
      path: IMG,
      fileName: 'test.png',
      kind: 'image',
      durationSec: 0,
      width: 1200,
      height: 800,
      fps: 0,
      hasVideo: true,
      hasAudio: false,
      videoCodec: 'png',
      rotation: 0,
      proxyPath: null,
      thumbnailPath: null,
      timelineThumbsPath: null,
    timelineThumbCols: null,
      waveformPath: null,
      peaks: null
    }
    project.sources.push(imgSrc)
    const v = project.timeline.tracks[0]
    const clip = createMediaClip({ trackId: v.id, sourceId: 'img1', sourceIn: 0, sourceOut: 4, timelineStart: 0 })
    v.clips.push(clip)
    const out = '/tmp/videoai-image-test.mp4'
    try {
      rmSync(out)
    } catch {
      /* ignore */
    }
    const args = buildFfmpegArgs(project, { outPath: out, useVideoToolbox: false, videoBitrate: '6M' })
    await pexec(ffmpegPath as unknown as string, args, { maxBuffer: 1 << 24 })
    expect(existsSync(out)).toBe(true)
    const { stdout } = await pexec(ffprobe.path, [
      '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', out
    ])
    expect(stdout.trim()).toBe('1080,1920')
  }, 90000)
})
