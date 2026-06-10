import { useEffect } from 'react'
import { useEditor } from '../state/store'

/** Keyboard-shortcut cheat sheet — open/close with `?`. */
const ROWS: Array<[string, string]> = [
  ['Spazio', 'Play / Pausa'],
  ['J · K · L', 'Indietro · Stop · Avanti (premi più volte per accelerare)'],
  ['S', 'Dividi al cursore (taglia)'],
  ['B', 'Lametta on/off — poi clic su una clip per tagliarla'],
  ['← / →', 'Sposta di 1 fotogramma (con ⇧ = 1 secondo)'],
  ['Home / End', 'Vai a inizio / fine'],
  ['M', 'Aggiungi un marker'],
  ['⇧F', 'Ferma fotogramma (freeze)'],
  ['⌫', 'Elimina e chiudi lo spazio'],
  ['⇧⌫', 'Elimina lasciando lo spazio'],
  ['⌘D', 'Duplica la clip'],
  ['⌘C · ⌘V · ⌘X', 'Copia · Incolla · Taglia'],
  ['⌘Z · ⌘⇧Z', 'Annulla · Ripeti'],
  ['⌘S', 'Salva il progetto'],
  ['⌘+ · ⌘−', 'Zoom della timeline'],
  ['?', 'Apri / chiudi questa guida']
]

export function ShortcutsPanel(): JSX.Element | null {
  const open = useEditor((s) => s.showShortcuts)
  const toggle = useEditor((s) => s.toggleShortcuts)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') toggle(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, toggle])

  if (!open) return null
  return (
    <div className="shortcuts-backdrop" onPointerDown={() => toggle(false)}>
      <div className="shortcuts-card" onPointerDown={(e) => e.stopPropagation()}>
        <div className="shortcuts-head">
          <span>⌨︎ Scorciatoie da tastiera</span>
          <button className="shortcuts-close" title="Chiudi (Esc)" onClick={() => toggle(false)}>
            ✕
          </button>
        </div>
        <div className="shortcuts-grid">
          {ROWS.map(([k, d]) => (
            <div key={k} className="shortcuts-row">
              <kbd>{k}</kbd>
              <span>{d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
