import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { genId } from '@shared/ids'
import {
  type CaroselloProject,
  type Format,
  type Layer,
  type PhotoLayer,
  type Slide,
  type TextLayer,
  emptyProject,
  makePhotoLayer,
  makeSlide,
  makeTextLayer
} from '../types'
import { parseBrief } from '../brief'

/** A patch that can target either layer kind (id/kind are never patched). */
export type LayerPatch = Partial<Omit<TextLayer, 'id' | 'kind'>> &
  Partial<Omit<PhotoLayer, 'id' | 'kind'>>

interface CaroselloState {
  project: CaroselloProject
  currentIndex: number
  selectedLayerId: string | null

  setFormat: (f: Format) => void
  addSlide: () => void
  duplicateSlide: (idx: number) => void
  removeSlide: (idx: number) => void
  selectSlide: (idx: number) => void
  moveSlide: (idx: number, dir: -1 | 1) => void
  setSlideBg: (idx: number, dataUrl: string | null) => void
  setSlideBgColor: (idx: number, color: string) => void

  addText: () => void
  addPhoto: (src: string) => void
  updateLayer: (id: string, patch: LayerPatch) => void
  removeLayer: (id: string) => void
  selectLayer: (id: string | null) => void
  raiseLayer: (id: string, dir: -1 | 1) => void

  importBrief: (raw: string) => { ok: boolean; error?: string; n?: number }
  reset: () => void
}

function cloneSlide(s: Slide): Slide {
  return {
    id: genId('slide'),
    bg: s.bg,
    bgColor: s.bgColor,
    layers: s.layers.map((l) => ({ ...l, id: genId('lay') }))
  }
}

export const useCarosello = create<CaroselloState>()(
  immer((set, get) => ({
    project: emptyProject('4:5'),
    currentIndex: 0,
    selectedLayerId: null,

    setFormat: (f) =>
      set((s) => {
        s.project.format = f
      }),

    addSlide: () =>
      set((s) => {
        s.project.slides.push(makeSlide())
        s.currentIndex = s.project.slides.length - 1
        s.selectedLayerId = null
      }),

    duplicateSlide: (idx) =>
      set((s) => {
        const src = s.project.slides[idx]
        if (!src) return
        s.project.slides.splice(idx + 1, 0, cloneSlide(src))
        s.currentIndex = idx + 1
        s.selectedLayerId = null
      }),

    removeSlide: (idx) =>
      set((s) => {
        if (s.project.slides.length <= 1) return
        s.project.slides.splice(idx, 1)
        s.currentIndex = Math.max(0, Math.min(s.currentIndex, s.project.slides.length - 1))
        s.selectedLayerId = null
      }),

    selectSlide: (idx) =>
      set((s) => {
        s.currentIndex = Math.max(0, Math.min(idx, s.project.slides.length - 1))
        s.selectedLayerId = null
      }),

    moveSlide: (idx, dir) =>
      set((s) => {
        const j = idx + dir
        if (j < 0 || j >= s.project.slides.length) return
        const [m] = s.project.slides.splice(idx, 1)
        s.project.slides.splice(j, 0, m)
        s.currentIndex = j
      }),

    setSlideBg: (idx, dataUrl) =>
      set((s) => {
        const sl = s.project.slides[idx]
        if (sl) sl.bg = dataUrl
      }),

    setSlideBgColor: (idx, color) =>
      set((s) => {
        const sl = s.project.slides[idx]
        if (sl) sl.bgColor = color
      }),

    addText: () =>
      set((s) => {
        const sl = s.project.slides[s.currentIndex]
        if (!sl) return
        const t = makeTextLayer({ text: 'Nuovo testo' })
        sl.layers.push(t)
        s.selectedLayerId = t.id
      }),

    addPhoto: (src) =>
      set((s) => {
        const sl = s.project.slides[s.currentIndex]
        if (!sl) return
        const p = makePhotoLayer(src)
        sl.layers.push(p)
        s.selectedLayerId = p.id
      }),

    updateLayer: (id, patch) =>
      set((s) => {
        const sl = s.project.slides[s.currentIndex]
        if (!sl) return
        const lay = sl.layers.find((l) => l.id === id)
        if (lay) Object.assign(lay as Record<string, unknown>, patch)
      }),

    removeLayer: (id) =>
      set((s) => {
        const sl = s.project.slides[s.currentIndex]
        if (!sl) return
        sl.layers = sl.layers.filter((l) => l.id !== id)
        if (s.selectedLayerId === id) s.selectedLayerId = null
      }),

    selectLayer: (id) =>
      set((s) => {
        s.selectedLayerId = id
      }),

    raiseLayer: (id, dir) =>
      set((s) => {
        const sl = s.project.slides[s.currentIndex]
        if (!sl) return
        const i = sl.layers.findIndex((l) => l.id === id)
        const j = i + dir
        if (i < 0 || j < 0 || j >= sl.layers.length) return
        const [m] = sl.layers.splice(i, 1)
        sl.layers.splice(j, 0, m)
      }),

    importBrief: (raw) => {
      const res = parseBrief(raw)
      if (!res.ok || !res.project) return { ok: false, error: res.error }
      set((s) => {
        s.project = res.project as CaroselloProject
        s.currentIndex = 0
        s.selectedLayerId = null
      })
      return { ok: true, n: res.project.slides.length }
    },

    reset: () =>
      set((s) => {
        s.project = emptyProject(s.project.format)
        s.currentIndex = 0
        s.selectedLayerId = null
      })
  }))
)

/** Convenience selector for the slide currently being edited. */
export function useCurrentSlide(): Slide | undefined {
  return useCarosello((s) => s.project.slides[s.currentIndex])
}

export type { Layer }
