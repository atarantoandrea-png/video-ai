import { useEditor } from '../state/store'

export function ExportOverlay(): JSX.Element | null {
  const exporting = useEditor((s) => s.exporting)
  const lastExport = useEditor((s) => s.lastExport)
  const cancelExport = useEditor((s) => s.cancelExport)
  const dismissExport = useEditor((s) => s.dismissExport)

  if (!exporting && !lastExport) return null

  return (
    <div className="overlay-backdrop">
      <div className="overlay-card">
        {exporting ? (
          <>
            <h3 className="overlay-title">Esportazione in corso…</h3>
            <div className="progress">
              <div className="progress-bar" style={{ width: `${exporting.percent}%` }} />
            </div>
            <div className="overlay-sub">
              {Math.round(exporting.percent)}%{exporting.speed ? ` · ${exporting.speed}` : ''}
            </div>
            <button className="btn" onClick={cancelExport}>
              Annulla
            </button>
          </>
        ) : lastExport?.ok ? (
          <>
            <h3 className="overlay-title">Esportazione completata ✓</h3>
            <div className="overlay-sub" style={{ wordBreak: 'break-all' }}>
              {lastExport.outPath}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn--primary"
                onClick={() => {
                  if (lastExport.outPath) void window.api.revealPath(lastExport.outPath)
                  dismissExport()
                }}
              >
                Mostra nel Finder
              </button>
              <button className="btn" onClick={dismissExport}>
                Chiudi
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="overlay-title">Esportazione non riuscita</h3>
            <div
              className="overlay-sub"
              style={{ whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto', textAlign: 'left' }}
            >
              {lastExport?.error}
            </div>
            <button className="btn" onClick={dismissExport}>
              Chiudi
            </button>
          </>
        )}
      </div>
    </div>
  )
}
