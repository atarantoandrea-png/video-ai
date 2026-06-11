import { useAppMode } from '../state/appMode'

/** Floating pill to switch between the Video editor and the Carosello editor. */
export function ModeSwitch(): JSX.Element {
  const mode = useAppMode((s) => s.mode)
  const setMode = useAppMode((s) => s.setMode)
  return (
    <div className="mode-switch">
      <button className={mode === 'video' ? 'active' : ''} onClick={() => setMode('video')}>
        🎬 Video
      </button>
      <button className={mode === 'carosello' ? 'active' : ''} onClick={() => setMode('carosello')}>
        🖼️ Caroselli
      </button>
    </div>
  )
}
