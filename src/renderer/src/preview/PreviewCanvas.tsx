import { useEffect, useRef } from 'react'
import { useEditor } from '../state/store'
import { compositor } from './Compositor'

/**
 * Hosts the app-lifetime singleton compositor and feeds it the editor state.
 * Using a singleton (attach/detach) means React StrictMode's double-mount can't
 * spawn a second render loop, which would advance the playhead twice and fast-
 * forward playback.
 */
export function PreviewCanvas({ width, height }: { width: number; height: number }): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    compositor.setStateGetter(() => {
      const s = useEditor.getState()
      return { project: s.project, playhead: s.playhead, isPlaying: s.isPlaying }
    })
    compositor.attach(host, Math.max(1, width), Math.max(1, height))
    return () => compositor.detach()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
}
