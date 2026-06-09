import { useEffect, useState } from 'react'

type Status =
  | { state: 'idle' }
  | { state: 'dev' }
  | { state: 'checking' }
  | { state: 'none' }
  | { state: 'available'; version?: string }
  | { state: 'downloading'; percent?: number }
  | { state: 'downloaded'; version?: string; skill?: boolean }
  | { state: 'error'; message?: string }

const SITE_URL = 'https://atarantoandrea-png.github.io/video-ai/'

/**
 * "Cerca aggiornamenti" button. Click → check GitHub Releases (via main/electron-updater).
 * If a newer version exists: Scarica → progress → Riavvia e installa. The whole flow is
 * one click each, and the app never re-downloads what it already has (delta over Releases).
 */
export function UpdateButton(): JSX.Element {
  const [status, setStatus] = useState<Status>({ state: 'idle' })
  const [open, setOpen] = useState(false)

  useEffect(() => window.api.onUpdateStatus((s) => setStatus(s as Status)), [])

  const check = async (): Promise<void> => {
    setOpen(true)
    setStatus({ state: 'checking' })
    setStatus((await window.api.updateCheck()) as Status)
  }

  const hot = status.state === 'available' || status.state === 'downloaded'

  const body = (): JSX.Element => {
    switch (status.state) {
      case 'checking':
        return <p className="update-line">Controllo aggiornamenti…</p>
      case 'none':
        return <p className="update-line">Sei già all'ultima versione ✓</p>
      case 'dev':
        return (
          <p className="update-line">
            Gli aggiornamenti automatici funzionano solo nell'<b>app installata</b> (non in
            sviluppo).
          </p>
        )
      case 'available':
        return (
          <>
            <p className="update-line">
              Disponibile la versione <b>{status.version}</b> 🎉
            </p>
            <button className="btn btn--primary" style={{ width: '100%' }} onClick={() => void window.api.updateDownload()}>
              Scarica e installa
            </button>
            <p className="update-sub">Si aggiorna da solo e riavvia. Aggiorna anche la skill /reel-ai.</p>
          </>
        )
      case 'downloading':
        return (
          <>
            <p className="update-line">Scarico l'aggiornamento… {Math.round(status.percent ?? 0)}%</p>
            <div className="progress">
              <div className="progress-bar" style={{ width: `${status.percent ?? 0}%` }} />
            </div>
            <p className="update-sub">Non chiudere l'app: al termine si riavvia da sola.</p>
          </>
        )
      case 'downloaded':
        return (
          <>
            <p className="update-line">
              Versione <b>{status.version}</b> pronta{status.skill ? ' (skill /reel-ai aggiornata ✓)' : ''}.
            </p>
            <button className="btn btn--primary" style={{ width: '100%' }} onClick={() => void window.api.updateInstall()}>
              Installa e riavvia
            </button>
            <p className="update-sub">L'app si chiude, si aggiorna e si riapre da sola.</p>
          </>
        )
      case 'error':
        return (
          <>
            <p className="update-line" style={{ color: 'var(--danger)' }}>
              Non riesco ad aggiornare in automatico: {status.message}
            </p>
            <button className="btn" style={{ width: '100%' }} onClick={() => void window.api.openExternal(SITE_URL)}>
              Scarica l'ultima versione dal sito
            </button>
          </>
        )
      default:
        return <p className="update-line">Cerca aggiornamenti dell'app.</p>
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button className="iconbtn" title="Cerca aggiornamenti" onClick={() => void check()}>
        ⟳{hot && <span className="update-dot" />}
      </button>
      {open && (
        <>
          <div className="popover-backdrop" onPointerDown={() => setOpen(false)} />
          <div className="update-pop">
            <div className="update-title">Aggiornamenti</div>
            {body()}
          </div>
        </>
      )}
    </div>
  )
}
