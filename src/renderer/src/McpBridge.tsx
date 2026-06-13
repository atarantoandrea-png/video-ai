import { useEffect } from 'react'
import { useAi } from './ai/agentStore'
import { useEditor } from './state/store'
import { timelineDuration } from '@shared/projectSchema'

/** Bridges the local HTTP MCP server (main process) to the editor state (renderer).
 *  Renders nothing — side-effects only. */
export function McpBridge(): null {
  const runFreePlan = useAi((s) => s.runFreePlan)

  useEffect(() => {
    const unsubPlan = window.api.onMcpRunPlan(async ({ reqId, plan }) => {
      try {
        await runFreePlan(plan)
        window.api.sendMcpResult(`mcp:plan-result:${reqId}`, { ok: true })
      } catch (err) {
        window.api.sendMcpResult(`mcp:plan-result:${reqId}`, { ok: false, error: String(err) })
      }
    })

    const unsubState = window.api.onMcpGetState(({ reqId }) => {
      const project = useEditor.getState().project
      window.api.sendMcpResult(`mcp:state-result:${reqId}`, {
        name: project.name,
        duration: timelineDuration(project.timeline),
        tracks: project.timeline.tracks.length,
        sources: project.sources.length
      })
    })

    return () => {
      unsubPlan()
      unsubState()
    }
  }, [runFreePlan])

  return null
}
