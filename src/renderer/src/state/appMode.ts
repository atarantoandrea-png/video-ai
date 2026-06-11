import { create } from 'zustand'

/**
 * Top-level app mode. Kept in a SEPARATE store from the video editor (`useEditor`)
 * so the Carosello module shares no state with the timeline editor — the video
 * editor code paths stay completely untouched.
 */
export type AppMode = 'video' | 'carosello'

interface AppModeState {
  mode: AppMode
  setMode: (m: AppMode) => void
}

export const useAppMode = create<AppModeState>((set) => ({
  mode: 'video',
  setMode: (mode): void => set({ mode })
}))
