import { useEffect, useRef } from 'react'

export interface MenuItem {
  label?: string
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  separator?: boolean
  shortcut?: string
}

/** A lightweight right-click menu rendered at (x, y). Closes on outside click, Esc,
 *  blur, or after an item runs. Parents own the open/close state. */
export function ContextMenu({
  x,
  y,
  items,
  onClose
}: {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (): void => onClose()
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    // Defer so the opening right-click doesn't immediately close it.
    const id = setTimeout(() => {
      window.addEventListener('pointerdown', close)
      window.addEventListener('blur', close)
      window.addEventListener('keydown', onEsc)
    }, 0)
    return () => {
      clearTimeout(id)
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', onEsc)
    }
  }, [onClose])

  // Keep the menu on-screen.
  const maxX = typeof window !== 'undefined' ? window.innerWidth - 230 : x
  const maxY = typeof window !== 'undefined' ? window.innerHeight - items.length * 30 - 12 : y

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: Math.min(x, maxX), top: Math.min(y, Math.max(8, maxY)) }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) =>
        it.separator ? (
          <div key={i} className="ctx-sep" />
        ) : (
          <button
            key={i}
            className={`ctx-item ${it.danger ? 'ctx-danger' : ''}`}
            disabled={it.disabled}
            onClick={() => {
              it.onClick?.()
              onClose()
            }}
          >
            <span>{it.label}</span>
            {it.shortcut && <span className="ctx-shortcut">{it.shortcut}</span>}
          </button>
        )
      )}
    </div>
  )
}
