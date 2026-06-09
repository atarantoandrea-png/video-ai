import { create } from 'zustand'
import { runAgent, DEFAULT_MODEL, type AgentStep } from './agent'
import { runTool, type ToolContext } from './tools'
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
  /** Execute a pasted JSON tool-call plan deterministically — NO Anthropic API, NO
   *  credits (used by the /reel-ai2 Claude skill, which generates the plan for free). */
  runFreePlan: (planText: string) => Promise<void>
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

    runFreePlan: async (planText) => {
      if (get().running) return
      let plan: Array<{ tool: string; input?: Record<string, unknown> }>
      try {
        const parsed = JSON.parse(planText.trim())
        const arr = Array.isArray(parsed) ? parsed : parsed.plan ?? parsed.steps
        if (!Array.isArray(arr) || arr.length === 0) throw new Error('vuoto')
        plan = arr.filter((c) => c && typeof c.tool === 'string')
        if (plan.length === 0) throw new Error('nessun tool valido')
      } catch (e) {
        bump({ role: 'error', text: `Piano non valido (serve un array JSON di {tool,input}): ${e instanceof Error ? e.message : e}` })
        return
      }
      const abort = new AbortController()
      set({ running: true, _abort: abort, _curAsst: null })
      bump({ role: 'user', text: `Piano da Claude — ${plan.length} azioni. Monto il reel GRATIS (senza crediti API)…` })
      useEditor.getState().beginAiBuild()
      const ctx: ToolContext = {
        askUser: (question, options) =>
          new Promise<string>((resolve) => {
            bump({ role: 'question', text: question, options })
            set({ pendingQuestion: { question, options }, _resolver: resolve, _curAsst: null })
          })
      }
      // Declarative refs so Claude needn't know internal ids: `sourceFile` → the matching
      // imported source's id; `clipId:"@last"`/`"@N"` → the Nth add_segment's clipId.
      const addedClips: string[] = []
      const resolveInput = (input: Record<string, unknown>): Record<string, unknown> => {
        const out = { ...input }
        if (typeof out.sourceFile === 'string' && !out.sourceId) {
          const want = (out.sourceFile as string).toLowerCase()
          const sources = useEditor.getState().project.sources
          const src =
            sources.find((s) => s.fileName.toLowerCase() === want) ||
            sources.find((s) => s.fileName.toLowerCase().includes(want) || want.includes(s.fileName.toLowerCase())) ||
            (sources.length === 1 ? sources[0] : undefined)
          if (src) out.sourceId = src.id
          delete out.sourceFile
        }
        if (typeof out.clipId === 'string' && (out.clipId as string).startsWith('@')) {
          const ref = (out.clipId as string).slice(1)
          out.clipId = ref === 'last' ? addedClips[addedClips.length - 1] : addedClips[parseInt(ref, 10)] ?? ''
        }
        return out
      }
      try {
        for (const call of plan) {
          if (abort.signal.aborted) throw new Error('Interrotto')
          const input = resolveInput((call.input ?? {}) as Record<string, unknown>)
          let result: unknown
          let error: string | undefined
          try {
            result = await runTool(call.tool, input, ctx)
            if (result && typeof result === 'object' && 'error' in (result as Record<string, unknown>))
              error = String((result as Record<string, unknown>).error)
          } catch (e) {
            error = e instanceof Error ? e.message : String(e)
          }
          const line = stepLine({ tool: call.tool, input, result, error })
          bump({ role: 'tool', text: line.text, error: line.error })
          if (call.tool === 'add_segment' && result && typeof result === 'object' && 'clipId' in (result as Record<string, unknown>))
            addedClips.push(String((result as Record<string, unknown>).clipId))
          if (call.tool === 'finish' && !error) {
            const sum = (result as Record<string, unknown> | undefined)?.summary
            bump({ role: 'done', text: (typeof sum === 'string' && sum) || 'Reel montato (gratis).' })
            return
          }
        }
        bump({ role: 'done', text: 'Reel montato GRATIS dal piano di Claude (zero crediti API).' })
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
