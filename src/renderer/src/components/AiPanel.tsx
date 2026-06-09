import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAi, type AiMsg } from '../ai/agentStore'
import { AI_MODELS, DEFAULT_MODEL } from '../ai/agent'

/**
 * The in-app AI assistant (Parte 2). Paste a «Reel Build Brief» produced by the
 * /reel-ai Claude skill; the agent builds the reel on the timeline, streaming its
 * steps and asking the user when needed. The Anthropic key is stored encrypted in
 * the main process and fetched just-in-time per run.
 *
 * Wrapped in an error boundary so a panel error never blanks the whole app — it
 * shows the message (almost always: restart the dev server so the preload reloads).
 */
export function AiPanel(): JSX.Element {
  return (
    <AiErrorBoundary>
      <AiPanelInner />
    </AiErrorBoundary>
  )
}

/** True only if the preload bridge actually exposes the AI methods (i.e. the dev
 *  server was restarted after the Part-2 main/preload changes). */
function bridgeReady(): boolean {
  const api = window.api as Partial<typeof window.api> | undefined
  return !!api && typeof api.hasApiKey === 'function' && typeof api.setApiKey === 'function'
}

/** A pasted "plan" (JSON array of {tool,input}) is built for FREE (no API key/credits)
 *  by the /reel-ai2 skill; a prose brief uses the in-app AI. Distinguish the two. */
function looksLikePlan(text: string): boolean {
  const t = text.trim()
  if (!t.startsWith('[') && !t.startsWith('{')) return false
  try {
    const p = JSON.parse(t)
    const arr = Array.isArray(p) ? p : p.plan ?? p.steps
    return Array.isArray(arr) && arr.length > 0 && arr.every((c: unknown) => !!c && typeof (c as { tool?: unknown }).tool === 'string')
  } catch {
    return false
  }
}

function AiPanelInner(): JSX.Element {
  const messages = useAi((s) => s.messages)
  const running = useAi((s) => s.running)
  const pending = useAi((s) => s.pendingQuestion)
  const run = useAi((s) => s.run)
  const runFreePlan = useAi((s) => s.runFreePlan)
  const answer = useAi((s) => s.answer)
  const stop = useAi((s) => s.stop)
  const clearChat = useAi((s) => s.clearChat)

  const [brief, setBrief] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [apiReady] = useState(bridgeReady)
  const [model, setModel] = useState<string>(DEFAULT_MODEL)

  // API key gating
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [editingKey, setEditingKey] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  useEffect(() => {
    if (!apiReady) return
    window.api.hasApiKey().then(setHasKey).catch(() => setHasKey(false))
  }, [apiReady])
  const saveKey = async (): Promise<void> => {
    if (!apiReady) return
    const r = await window.api.setApiKey(keyInput.trim())
    if (r.ok) {
      setHasKey(keyInput.trim().length > 0)
      setEditingKey(false)
      setKeyInput('')
    } else {
      useAi.setState((s) => ({
        messages: [...s.messages, { id: s._seq, role: 'error', text: r.error || 'Errore chiave' }],
        _seq: s._seq + 1
      }))
    }
  }

  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages, pending])

  const needsKey = hasKey === false || editingKey
  const canBuild = apiReady && hasKey !== false && !running
  // A pasted plan (from /reel-ai2) builds for FREE — no key, no credits.
  const isPlan = looksLikePlan(brief)

  return (
    <div className="scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12, gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="section-title" style={{ flex: 1 }}>AI — Monta il reel</div>
        <button className="chip" title="Come funziona" onClick={() => setShowHelp((v) => !v)}>?</button>
        <button className="chip" title="Chiave API" onClick={() => setEditingKey((v) => !v)} disabled={!apiReady}>⚙</button>
      </div>

      {!apiReady && (
        <div
          className="empty-hint"
          style={{ textAlign: 'left', color: 'var(--danger)', lineHeight: 1.5 }}
        >
          ⚠ Ponte AI non ancora attivo. Ferma e <b>rilancia il dev server</b> (<code>npm run dev</code>): le
          modifiche al preload/main non si aggiornano con l'hot-reload, vanno ricaricate riavviando.
        </div>
      )}

      {showHelp && <HelpBox />}

      {apiReady && needsKey && (
        <div className="ai-keybox" style={{ background: 'var(--panel-2, #1a1f25)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="field-label">Chiave API Anthropic (salvata cifrata sul tuo Mac)</div>
          <input
            type="password"
            className="input"
            placeholder="sk-ant-..."
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => void saveKey()}>Salva chiave</button>
            {hasKey && (
              <button className="btn" onClick={() => { setEditingKey(false); setKeyInput('') }}>Annulla</button>
            )}
          </div>
        </div>
      )}

      <textarea
        className="input"
        placeholder="Incolla il «Reel Build Brief» (/reel-ai) per montare con l'AI in-app, OPPURE il piano JSON di /reel-ai2 per montare GRATIS (senza crediti)…"
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        rows={5}
        style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="field-label">Modello</span>
        <select
          className="input"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={running}
          style={{ flex: 1 }}
          title="Sonnet costa meno; Opus rende meglio. Se il brief contiene 'model:', vince quello."
        >
          {AI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      {isPlan && !running && (
        <div className="empty-hint" style={{ textAlign: 'left', color: 'var(--accent, #1fe6c2)', fontSize: 12 }}>
          ⚡ Piano da Claude rilevato → costruzione <b>gratuita</b>, senza crediti API.
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        {!running ? (
          isPlan ? (
            <button
              className="btn btn--primary"
              style={{ flex: 1 }}
              onClick={() => void runFreePlan(brief)}
              title="Esegui il piano generato dalla skill /reel-ai2 — senza chiave né crediti API"
            >
              ⚡ Costruisci GRATIS (senza crediti)
            </button>
          ) : (
            <button
              className="btn btn--primary"
              style={{ flex: 1 }}
              disabled={!canBuild}
              onClick={() => void run(brief, model)}
              title={!apiReady ? 'Riavvia il dev server' : hasKey === false ? 'Imposta prima la chiave API' : 'Costruisci il reel dal brief'}
            >
              ▶ Costruisci reel
            </button>
          )
        ) : (
          <button className="btn" style={{ flex: 1, color: 'var(--danger)' }} onClick={stop}>■ Stop</button>
        )}
        {messages.length > 0 && !running && (
          <button className="btn" onClick={clearChat} title="Pulisci la conversazione">Pulisci</button>
        )}
      </div>

      <div ref={scroller} className="ai-chat" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
        {messages.length === 0 && (
          <div className="empty-hint" style={{ textAlign: 'left' }}>
            Genera il brief con <b>/reel-ai</b> in Claude Code, incollalo qui sopra e premi «Costruisci reel».
          </div>
        )}
        {messages.map((m) => (
          <MessageRow key={m.id} m={m} />
        ))}
      </div>

      {pending && (
        <QuestionComposer question={pending.question} options={pending.options} onAnswer={answer} />
      )}
    </div>
  )
}

/** Catches render/effect errors in the AI panel so they never blank the whole app. */
class AiErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null }
  static getDerivedStateFromError(err: unknown): { error: string } {
    return { error: err instanceof Error ? err.message : String(err) }
  }
  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="scroll" style={{ flex: 1, padding: 12 }}>
          <div className="empty-hint" style={{ textAlign: 'left', color: 'var(--danger)', lineHeight: 1.55 }}>
            ⚠ Errore nel pannello AI: {this.state.error}
            <br />
            <br />
            Quasi sempre si risolve <b>riavviando il dev server</b> (ferma e rilancia <code>npm run dev</code>): le
            modifiche al preload/main non si ricaricano con l'hot-reload. Se persiste dopo il riavvio, mandami questo
            messaggio d'errore.
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function MessageRow({ m }: { m: AiMsg }): JSX.Element {
  switch (m.role) {
    case 'user':
      return <div style={{ fontSize: 12, color: 'var(--text-dim, #8aa)', alignSelf: 'flex-end', textAlign: 'right' }}>{m.text}</div>
    case 'assistant':
      return <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.text}</div>
    case 'tool':
      return (
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: m.error ? 'var(--danger)' : 'var(--text-dim, #7c8a99)' }}>
          {m.text}
        </div>
      )
    case 'question':
      return (
        <div style={{ borderLeft: '3px solid var(--accent, #1fe6c2)', paddingLeft: 8, fontSize: 13 }}>
          <div style={{ fontWeight: 600 }}>{m.text}</div>
          {m.answered !== undefined && (
            <div style={{ fontSize: 12, color: 'var(--accent, #1fe6c2)', marginTop: 2 }}>→ {m.answered}</div>
          )}
        </div>
      )
    case 'error':
      return <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>⚠ {m.text}</div>
    case 'done':
      return <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent, #1fe6c2)', whiteSpace: 'pre-wrap' }}>✓ {m.text}</div>
  }
}

function QuestionComposer({
  question,
  options,
  onAnswer
}: {
  question: string
  options?: string[]
  onAnswer: (a: string) => void
}): JSX.Element {
  const [free, setFree] = useState('')
  return (
    <div style={{ background: 'var(--panel-2, #1a1f25)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{question}</div>
      {options && options.length > 0 && (
        <div className="chip-row">
          {options.map((o) => (
            <button key={o} className="chip" onClick={() => onAnswer(o)}>{o}</button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="input"
          placeholder="Oppure scrivi una risposta…"
          value={free}
          onChange={(e) => setFree(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && free.trim()) onAnswer(free.trim())
          }}
          style={{ flex: 1 }}
        />
        <button className="btn" disabled={!free.trim()} onClick={() => free.trim() && onAnswer(free.trim())}>Invia</button>
      </div>
    </div>
  )
}

function HelpBox(): JSX.Element {
  return (
    <div style={{ background: 'var(--panel-2, #1a1f25)', borderRadius: 8, padding: 12, fontSize: 12.5, lineHeight: 1.55 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Come si crea un reel con l'AI (2 fasi)</div>
      <div style={{ marginBottom: 6 }}>
        <b>1) In Claude Code</b> — lancia la skill <b>/reel-ai</b>. Ti chiederà la trascrizione (o, se non hai i tempi,
        di trascrivere il video) e chi parla, poi ragiona da esperto di reel (hook, ordine dei tagli, carosello) e ti
        consegna un <b>«Reel Build Brief»</b>.
      </div>
      <div style={{ marginBottom: 6 }}>
        <b>2) Qui nell'app</b> — importa il video nel pannello <b>Media</b>, incolla il brief nel riquadro qui sotto e premi
        <b> «Costruisci reel»</b>. L'AI imposta il formato 9:16, monta i tagli nell'ordine del brief, <b>reframa in verticale</b>
        riconoscendo i volti, aggiunge le <b>captions</b> e (se lo indichi) <b>sfoca</b> una persona — facendoti domande quando
        serve. Un singolo <b>annulla</b> (⌘Z) ripristina tutto.
      </div>
      <div style={{ marginBottom: 6 }}>
        <b>Gratis, senza crediti</b> — in alternativa lancia <b>/reel-ai2</b> in Claude Code: ti chiede il brief, prepara
        il montaggio e <b>prende il controllo del Mac</b> per importare il video e costruire il reel qui dentro col
        pulsante <b>«⚡ Costruisci GRATIS»</b>. Stesso risultato dell'AI in-app, ma <b>senza chiave né crediti API</b>.
      </div>
      <div style={{ color: 'var(--text-dim, #7c8a99)' }}>
        Promemoria: le skill si invocano con <b>/reel-ai</b> e <b>/reel-ai2</b> in Claude Code. Se non compaiono, riavvia
        Claude Code (le skill si caricano all'avvio). La chiave API (icona ⚙) serve solo per «Costruisci reel» con l'AI in-app.
      </div>
    </div>
  )
}
