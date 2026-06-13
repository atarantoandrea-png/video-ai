import { useEffect } from 'react'
import { useEditor } from './state/store'
import { TopToolbar } from './components/TopToolbar'
import { LeftPanel } from './components/LeftPanel'
import { Player } from './components/Player'
import { Inspector } from './components/Inspector'
import { Timeline } from './components/Timeline'
import { ExportOverlay } from './components/ExportOverlay'
import { ShortcutsPanel } from './components/ShortcutsPanel'
import { McpBridge } from './McpBridge'
import { timelineDuration } from '@shared/projectSchema'
import './styles/layout.css'

export default function App(): JSX.Element {
  const init = useEditor((s) => s.init)

  useEffect(() => {
    init()
  }, [init])

  usePlaybackLoop()
  useKeyboardShortcuts()

  return (
    <div className="app-grid">
      <TopToolbar />
      <div className="app-middle">
        <LeftPanel />
        <Player />
        <Inspector />
      </div>
      <Timeline />
      <ExportOverlay />
      <ShortcutsPanel />
      <McpBridge />
    </div>
  )
}

// Module-level singleton playback loop. A guard ensures exactly ONE rAF chain
// can run at a time, so React StrictMode's double-invoked effects (or any extra
// mount) can't start a second loop — two loops would each advance the playhead
// per frame and play back at ~2x. The loop self-stops when isPlaying clears.
let playbackRaf = 0
let playbackLast = 0

function startPlaybackLoop(): void {
  if (playbackRaf) return
  playbackLast = performance.now()
  const tick = (now: number): void => {
    const dt = (now - playbackLast) / 1000
    playbackLast = now
    const st = useEditor.getState()
    if (!st.isPlaying) {
      playbackRaf = 0
      return
    }
    const dur = timelineDuration(st.project.timeline)
    const rate = st.playbackRate || 1
    const next = st.playhead + dt * rate
    if (rate < 0 && next <= 0) {
      st.setPlayhead(0)
      st.setPlaying(false)
      playbackRaf = 0
      return
    }
    if (dur > 0 && rate > 0 && next >= dur) {
      st.setPlayhead(dur)
      st.setPlaying(false)
      playbackRaf = 0
      return
    }
    st.setPlayhead(Math.max(0, next))
    playbackRaf = requestAnimationFrame(tick)
  }
  playbackRaf = requestAnimationFrame(tick)
}

/** Start the (singleton) playback loop whenever playback begins. The compositor
 *  keeps the video in sync with the playhead, so picture and line stay together. */
function usePlaybackLoop(): void {
  const isPlaying = useEditor((s) => s.isPlaying)
  useEffect(() => {
    if (isPlaying) startPlaybackLoop()
  }, [isPlaying])
}

/** Global editor keyboard shortcuts. */
function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const st = useEditor.getState()

      const mod = e.metaKey || e.ctrlKey
      const sel = st.selectedClipId
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        st.toggleShortcuts()
      } else if (e.code === 'Space') {
        e.preventDefault()
        st.togglePlay()
      } else if (!mod && e.key.toLowerCase() === 'l') {
        st.shuttle('fwd') // J/K/L shuttle (pro NLE): L = play/forward faster
      } else if (!mod && e.key.toLowerCase() === 'k') {
        st.shuttle('stop')
      } else if (!mod && e.key.toLowerCase() === 'j') {
        st.shuttle('back')
      } else if (!mod && e.key.toLowerCase() === 'b') {
        st.toggleBladeMode() // razor/blade tool on/off
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        if (sel) st.duplicateClip(sel)
      } else if (mod && e.key.toLowerCase() === 'c') {
        if (sel) st.copyClip(sel)
      } else if (mod && e.key.toLowerCase() === 'v') {
        st.pasteClip()
      } else if (mod && e.key.toLowerCase() === 'x') {
        if (sel) {
          st.copyClip(sel)
          st.rippleDelete(sel) // cut closes the gap (CapCut)
        }
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void st.saveProject()
      } else if (e.key.toLowerCase() === 's' && !mod) {
        st.splitAtPlayhead()
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && (mod || e.shiftKey)) {
        e.preventDefault()
        if (sel) st.removeClip(sel) // ⇧⌫ = delete but LEAVE the gap
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        st.removeSelectedClips() // default ⌫ = delete + close the gap (ripple), 1 or many
      } else if (e.key.toLowerCase() === 'm' && !mod) {
        st.addMarker()
      } else if (e.key.toLowerCase() === 'f' && e.shiftKey && !mod) {
        if (sel) void st.freezeFrame(sel)
      } else if (e.key === 'ArrowLeft' && !mod) {
        e.preventDefault()
        st.setPlayhead(Math.max(0, st.playhead - (e.shiftKey ? 1 : 1 / 30)))
      } else if (e.key === 'ArrowRight' && !mod) {
        e.preventDefault()
        st.setPlayhead(st.playhead + (e.shiftKey ? 1 : 1 / 30))
      } else if (e.key === 'Home') {
        e.preventDefault()
        st.setPlayhead(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        st.setPlayhead(timelineDuration(st.project.timeline))
      } else if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        st.setZoom(st.pxPerSec * 1.3)
      } else if (mod && e.key === '-') {
        e.preventDefault()
        st.setZoom(st.pxPerSec / 1.3)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
