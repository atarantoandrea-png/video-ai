import { useEditor } from '../state/store'

/** Transient confirmation banner for cloud actions (save/delete/open). */
export function CloudToast(): JSX.Element | null {
  const msg = useEditor((s) => s.cloudToast)
  if (!msg) return null
  const error = /fall|errat|errore/i.test(msg)
  return (
    <div
      style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
        background: error ? '#2a1416' : '#0c2a25',
        color: error ? 'var(--danger, #ff6b6b)' : 'var(--accent, #1fe6c2)',
        border: '1px solid ' + (error ? '#5a2a2a' : '#1b4d44'),
        padding: '10px 18px', borderRadius: 999, fontSize: 14, pointerEvents: 'none'
      }}
    >
      {msg}
    </div>
  )
}
