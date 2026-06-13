#!/usr/bin/env node
'use strict'
/**
 * MCP stdio bridge for Video AI.
 * Claude Code spawns this script; it proxies tool calls to the Video AI
 * local HTTP server on port 7842.
 */

const http = require('http')
const readline = require('readline')

const BASE = 'http://127.0.0.1:7842'

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, (res) => {
      let out = ''
      res.on('data', (c) => (out += c))
      res.on('end', () => { try { resolve(JSON.parse(out)) } catch { resolve({ raw: out }) } })
    }).on('error', reject)
  })
}

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body)
    const req = http.request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let out = ''
      res.on('data', (c) => (out += c))
      res.on('end', () => { try { resolve(JSON.parse(out)) } catch { resolve({ raw: out }) } })
    })
    req.on('error', reject)
    req.end(data)
  })
}

const TOOLS = [
  {
    name: 'check_health',
    description: 'Verifica se Video AI è aperto e raggiungibile. Chiamalo sempre prima di run_plan.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_state',
    description: 'Restituisce lo stato del progetto attivo in Video AI: nome, durata, numero di tracce e sorgenti importate.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'run_plan',
    description: 'Esegue un piano di montaggio JSON direttamente in Video AI senza usare il mouse. ' +
      'Il piano è un array JSON di tool-call nel formato [{\"tool\":\"...\",\"input\":{...}},...]. ' +
      'Tool disponibili: set_format, list_sources, get_timeline_state, start_fresh, add_segment, ' +
      'detect_people, reframe_vertical, blur_person, add_caption, add_captions_bulk, add_transition, ' +
      'set_speed, set_fade, set_volume, mute_clip, trim_clip, set_look, set_filter, finish.',
    inputSchema: {
      type: 'object',
      properties: {
        plan: {
          type: 'string',
          description: 'Array JSON serializzato: [{\"tool\":\"set_format\",\"input\":{\"aspect\":\"9:16\"}},...]'
        }
      },
      required: ['plan']
    }
  }
]

async function callTool(name, args) {
  if (name === 'check_health') {
    try {
      const r = await httpGet('/health')
      const ok = r && r.ok
      return {
        content: [{ type: 'text', text: ok ? 'Video AI è aperto e pronto.' : `Risposta inattesa: ${JSON.stringify(r)}` }],
        isError: !ok
      }
    } catch {
      return {
        content: [{ type: 'text', text: 'Video AI non è aperto. Aprilo prima di continuare.' }],
        isError: true
      }
    }
  }

  if (name === 'get_state') {
    try {
      const r = await httpGet('/state')
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Errore: ${e.message}` }], isError: true }
    }
  }

  if (name === 'run_plan') {
    const plan = args && args.plan
    if (!plan) return { content: [{ type: 'text', text: 'Parametro "plan" mancante.' }], isError: true }
    try {
      const r = await httpPost('/run-plan', plan)
      if (r && r.ok) return { content: [{ type: 'text', text: 'Piano eseguito con successo.' }] }
      return { content: [{ type: 'text', text: `Errore nel piano: ${r.error || JSON.stringify(r)}` }], isError: true }
    } catch (e) {
      return {
        content: [{ type: 'text', text: `Video AI non raggiungibile: ${e.message}. Assicurati che l'app sia aperta.` }],
        isError: true
      }
    }
  }

  return { content: [{ type: 'text', text: `Tool sconosciuto: ${name}` }], isError: true }
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n')
}

const rl = readline.createInterface({ input: process.stdin, terminal: false })

rl.on('line', async (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let msg
  try { msg = JSON.parse(trimmed) } catch { return }

  // Notifications have no id — no response needed
  if (msg.id == null) return

  if (msg.method === 'initialize') {
    send({
      jsonrpc: '2.0', id: msg.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'video-ai', version: '1.0.0' }
      }
    })
    return
  }

  if (msg.method === 'tools/list') {
    send({ jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } })
    return
  }

  if (msg.method === 'tools/call') {
    const { name, arguments: toolArgs } = msg.params || {}
    const result = await callTool(name, toolArgs || {})
    send({ jsonrpc: '2.0', id: msg.id, result })
    return
  }

  send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } })
})
