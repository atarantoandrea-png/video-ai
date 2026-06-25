import type Anthropic from '@anthropic-ai/sdk'
import { TOOLS, runTool, type ToolContext } from './tools'

/** Models offered to the user — never below Sonnet. Default = Sonnet to save credits. */
export const AI_MODELS: { id: string; label: string }[] = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 — economico (consigliato)' },
  { id: 'claude-opus-4-6', label: 'Opus 4.6 — qualità alta' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8 — massima qualità' }
]
export const DEFAULT_MODEL = 'claude-sonnet-4-6'

export interface AgentStep {
  tool: string
  input: unknown
  result?: unknown
  error?: string
}

export interface RunAgentOpts {
  /** The pasted «Reel Build Brief». */
  brief: string
  /** Anthropic model id (from the brief or the UI; never below Sonnet). */
  model?: string
  signal?: AbortSignal
  /** A turn's assistant text (whole, not streamed). */
  onAssistant: (text: string) => void
  /** A tool call finished (success or error). */
  onStep: (step: AgentStep) => void
  /** Suspend the loop and ask the user a question; resolves with their answer. */
  askUser: (question: string, options?: string[]) => Promise<string>
}

const SYSTEM = `Sei l'AI di montaggio DENTRO un editor video desktop. Il tuo compito è ESEGUIRE un «Reel Build Brief» (prodotto da un agente esperto) costruendo il reel sulla timeline tramite i TUOI TOOL. Non sei tu a decidere i contenuti: il brief comanda; tu lo realizzi fedelmente e chiedi all'utente solo nei punti che spettano a lui.

Parla SEMPRE in italiano, con messaggi BREVI (l'utente vede i passi scorrere). Ragiona, poi agisci con i tool.

FLUSSO:
1) list_sources: mappa gli alias del brief (es. "src_main") al sourceId reale tramite il NOME FILE. Se manca o è ambiguo, usa ask_user.
2) get_timeline_state: se la timeline ha già clip, usa ask_user e (se confermato) start_fresh. Se è vuota, prosegui.
3) set_format con il formato del brief (reel: 9:16).
4) TAGLI: per OGNI segmento, nell'ORDINE del brief, add_segment(sourceId, sourceIn, sourceOut) con i tempi SORGENTE in secondi. Tieni i clipId restituiti.
5) REFRAME verticale di ogni clip: il reel deve SEMPRE RIEMPIRE il 9:16. Se la sorgente è una GALLERY affiancata con DUE persone (due riquadri tipo Zoom) → usa SEMPRE reframe_vertical(clipId,'two-person-stack'): l'app taglia via le bande nere e impila la persona SINISTRA in alto e la DESTRA in basso, ognuna a riempire la sua metà. Vale ANCHE se il brief dice "manual metà destra/sinistra": preferisci comunque lo stack (mostra entrambe). UNA sola persona → 'center-face'. In dubbio → 'auto'. MAI 'fit-contain' con persone. Per 3+ persone, detect_people + ask_user.
6) PRIVACY/BLUR: SOLO se il brief lo chiede e SEMPRE dopo conferma con ask_user. Nello STACK sfoca col parametro blur di reframe_vertical: blur:'bottom' = persona DESTRA (in basso), blur:'top' = persona SINISTRA (in alto), 'both' = entrambe. È robusto (regione fissa, regge le mani sul viso). Fuori dallo stack usa blur_person.
7) set_post_meta: se il brief contiene una «Descrizione (post)» e/o un «Primo commento» (e i 5 hook), salvali nel progetto con set_post_meta (description, hashtags, firstComment, hooks, e la «Descrizione extra» fissa di Elisa in extraDescription se presente nel brief). NON finiscono sul video: restano salvati col progetto, l'utente li rilegge/copia dalla scheda «Social». Chiamalo una sola volta, prima di finish.
8) finish: riepilogo in italiano (segmenti, durata, formato, reframe applicato).

NON aggiungere testo a schermo: niente captions, niente sottotitoli, niente titolo-hook — il testo lo mette l'utente dopo, nell'app social. NON usare add_caption / add_captions_bulk a meno che l'utente non lo chieda esplicitamente. (set_post_meta NON scrive sul video: salva solo la copy del post.)

REGOLE FERREE:
- Esegui ESATTAMENTE i segmenti del brief, nell'ORDINE dato: non aggiungerne, non toglierne, non spezzettarli ulteriormente.
- Non inventare MAI i timecode: usa i valori del brief; per i tempi mancanti, ask_user.
- Prima di QUALSIASI blur di una persona, chiedi conferma (ask_user).
- Una domanda alla volta, con opzioni rapide quando sensato.
- Se un tool torna errore, leggi il messaggio e correggi (es. richiama list_sources / get_timeline_state).`

/**
 * Manual tool-use loop. Each model turn is one `messages.create` run in MAIN (via IPC);
 * the renderer keeps the loop, dispatches tools locally, and resumes on tool results.
 * `ask_user` naturally pauses the loop (its handler awaits a Promise resolved by the UI).
 */
export async function runAgent(opts: RunAgentOpts): Promise<string> {
  const ctx: ToolContext = { askUser: opts.askUser }
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Ecco il «Reel Build Brief». Costruisci il reel seguendolo fedelmente.\n\n${opts.brief}` }
  ]
  let finalText = ''

  for (let turn = 0; turn < 60; turn++) {
    if (opts.signal?.aborted) throw new Error('Interrotto')

    const msg = await window.api.aiCreateMessage({
      model: opts.model || DEFAULT_MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' }, // Opus 4.8: adaptive thinking for better decisions
      system: SYSTEM,
      tools: TOOLS,
      messages
    })
    if ('__error' in msg) throw new Error(msg.__error.message || `Errore API (${msg.__error.status})`)

    messages.push({ role: 'assistant', content: msg.content as Anthropic.ContentBlockParam[] })
    const turnText = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    if (turnText) {
      finalText = turnText
      opts.onAssistant(turnText)
    }

    if (msg.stop_reason !== 'tool_use') break

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const block of msg.content) {
      if (block.type !== 'tool_use') continue
      let result: unknown
      let error: string | undefined
      try {
        result = await runTool(block.name, (block.input ?? {}) as Record<string, unknown>, ctx)
        if (result && typeof result === 'object' && 'error' in (result as Record<string, unknown>)) {
          error = String((result as Record<string, unknown>).error)
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }
      opts.onStep({ tool: block.name, input: block.input, result, error })
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(error ? { error } : (result ?? { ok: true })),
        is_error: !!error
      })
      if (block.name === 'finish' && !error) {
        const sum =
          result && typeof result === 'object' && 'summary' in (result as Record<string, unknown>)
            ? String((result as Record<string, unknown>).summary)
            : ''
        return sum || finalText || 'Reel completato.'
      }
    }
    messages.push({ role: 'user', content: results })
  }

  return finalText || 'Completato.'
}
