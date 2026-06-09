import { create } from 'zustand'
import { runAgent, DEFAULT_MODEL, type AgentStep } from './agent'
import { useEditor } from '../state/store'

export type AiMsg =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; text: string }
  | { id: number; role: 'tool'; text: string; error?: boolean }
  | { id: number; role: 'question'; text: string; options?: string[]; answered?: string }
  | { id: number; role: 'error'; text: string }
  | { id: number; role: 'done'; text: string }

interface AiState {
  messages: AiMsg[]
  running: boolean
  pendingQuestion: { question: string; options?: string[] } | null
  // internal
  _resolver: ((a: string) => void) | null
  _abort: AbortController | null
  _seq: number
  _curAsst: number | null
  /** Parse + execute a pasted Reel Build Brief with the chosen model. */
  run: (brief: string, model?: string) => Promise<void>
  /** Answer the agent's pending question, resuming the loop. */
  answer: (a: string) => void
  /** Abort the in-flight run. */
  stop: () => void
  clearChat: () => void
}

const round1 = (n: number): number => Math.round(n * 10) / 10

function summarizeInput(tool: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>
  if (tool === 'add_segment' && typeof i.sourceIn === 'number' && typeof i.sourceOut === 'number') {
    return ` (${round1(i.sourceIn as number)}→${round1(i.sourceOut as number)}s)`
  }
  if (tool === 'set_format' && typeof i.aspect === 'string') return ` (${i.aspect})`
  return ''
}

function stepLine(s: AgentStep): { text: string; error?: boolean } {
  const arg = summarizeInput(s.tool, s.input)
  if (s.error) return { text: `✗ ${s.tool}${arg} — ${s.error}`, error: true }
  let extra = ''
  const r = s.result as Record<string, unknown> | undefined
  if (s.tool === 'list_sources' && r && Array.isArray(r.sources)) extra = `${(r.sources as unknown[]).length} sorgenti`
  else if (s.tool === 'add_segment' && r && typeof r.durationSec === 'number') extra = `${round1(r.durationSec as number)}s`
  return { text: `▶ ${s.tool}${arg}${extra ? ' — ' + extra : ''}` }
}

export const useAi = create<AiState>((set, get) => {
  const bump = (m: { role: AiMsg['role']; text: string; error?: boolean; options?: string[] }): void =>
    set((s) => ({
      messages: [...s.messages, { ...m, id: s._seq } as AiMsg],
      _seq: s._seq + 1,
      _curAsst: null
    }))

  return {
    messages: [],
    running: false,
    pendingQuestion: null,
    _resolver: null,
    _abort: null,
    _seq: 1,
    _curAsst: null,

    run: async (brief, model) => {
      if (get().running) return
      const trimmed = brief.trim()
      if (!trimmed) {
        bump({ role: 'error', text: 'Incolla prima il «Reel Build Brief».' })
        return
      }
      const hasKey = await window.api.hasApiKey()
      if (!hasKey) {
        bump({ role: 'error', text: 'Imposta la chiave API Anthropic qui sopra (icona ⚙), poi riprova.' })
        return
      }
      // Model: a "model:" line in the brief wins; else the UI choice; else default (Sonnet).
      const VALID = new Set(['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-opus-4-7', 'claude-opus-4-8'])
      const mm = trimmed.match(/(?:^|\n)\s*[-*]?\s*model\s*[:=]\s*(claude-[a-z0-9.-]+)/i)
      const briefModel = mm && VALID.has(mm[1].toLowerCase()) ? mm[1].toLowerCase() : undefined
      const chosenModel = briefModel || (model && VALID.has(model) ? model : DEFAULT_MODEL)
      const abort = new AbortController()
      set({ running: true, _abort: abort, _curAsst: null })
      bump({ role: 'user', text: `Brief incollato — ${trimmed.split('\n').length} righe. Costruisco il reel…` })
      useEditor.getState().beginAiBuild()
      try {
        const summary = await runAgent({
          brief: trimmed,
          model: chosenModel,
          signal: abort.signal,
          onAssistant: (t) => bump({ role: 'assistant', text: t }),
          onStep: (step) => {
            const { text, error } = stepLine(step)
            bump({ role: 'tool', text, error })
          },
          askUser: (question, options) =>
            new Promise<string>((resolve) => {
              bump({ role: 'question', text: question, options })
              set({ pendingQuestion: { question, options }, _resolver: resolve, _curAsst: null })
            })
        })
        bump({ role: 'done', text: summary })
      } catch (e) {
        bump({ role: 'error', text: e instanceof Error ? e.message : String(e) })
      } finally {
        useEditor.getState().endAiBuild()
        set({ running: false, _abort: null, pendingQuestion: null, _resolver: null, _curAsst: null })
      }
    },

    answer: (a) => {
      const resolver = get()._resolver
      set((s) => ({
        messages: s.messages.map((m) =>
          m.role === 'question' && m.answered === undefined ? { ...m, answered: a } : m
        ),
        pendingQuestion: null,
        _resolver: null,
        _curAsst: null
      }))
      resolver?.(a)
    },

    stop: () => {
      get()._abort?.abort()
      const resolver = get()._resolver
      resolver?.('[interrotto dall\'utente]')
      set({ pendingQuestion: null, _resolver: null })
    },

    clearChat: () => set({ messages: [], _curAsst: null })
  }
})
