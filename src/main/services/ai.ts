import Anthropic from '@anthropic-ai/sdk'
import { getApiKey } from './settings'

export interface AiError {
  __error: { status: number; message: string }
}

/**
 * Run one non-streaming Messages request in the MAIN process. Running the SDK here
 * (Node) avoids the renderer's browser-bundle issues with the SDK's optional node-only
 * tooling, avoids CORS entirely, and keeps the API key in main — it never reaches the
 * renderer. The renderer drives the agent loop and only ships request/response JSON.
 */
export async function createMessage(
  body: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message | AiError> {
  const apiKey = getApiKey()
  if (!apiKey) return { __error: { status: 401, message: 'Nessuna chiave API Anthropic impostata.' } }
  try {
    const client = new Anthropic({ apiKey })
    return await client.messages.create({ ...body, stream: false })
  } catch (e) {
    const status = typeof (e as { status?: number })?.status === 'number' ? (e as { status: number }).status : 500
    return { __error: { status, message: e instanceof Error ? e.message : String(e) } }
  }
}
