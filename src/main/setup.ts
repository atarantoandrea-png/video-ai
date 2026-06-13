import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'

export function runSetup(): void {
  try {
    installSkills()
    registerMcpServer()
  } catch (e) {
    console.error('[video-ai setup]', e)
  }
}

function skillsSrc(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'skills')
    : join(app.getAppPath(), '.claude', 'skills')
}

function bridgeSrc(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'mcp-bridge.cjs')
    : join(app.getAppPath(), 'resources', 'mcp-bridge.cjs')
}

function installSkills(): void {
  const src = skillsSrc()
  if (!existsSync(src)) return
  const dst = join(homedir(), '.claude', 'skills')
  mkdirSync(dst, { recursive: true })
  for (const skill of ['reel-ai', 'reel-ai2', 'youtube-ai', 'video-ai-assistant']) {
    const from = join(src, skill)
    if (existsSync(from)) cpSync(from, join(dst, skill), { recursive: true })
  }
}

function registerMcpServer(): void {
  const bridge = bridgeSrc()
  if (!existsSync(bridge)) return

  const settingsPath = join(homedir(), '.claude', 'settings.json')
  let settings: Record<string, unknown> = {}
  if (existsSync(settingsPath)) {
    try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown> } catch { /**/ }
  }
  const servers = (settings.mcpServers as Record<string, unknown> | undefined) ?? {}
  servers['video-ai'] = { command: 'node', args: [bridge] }
  settings.mcpServers = servers
  mkdirSync(join(homedir(), '.claude'), { recursive: true })
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}
