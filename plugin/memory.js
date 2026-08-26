// Persistent session memory: saves a compact entry on session.idle, injects
// the tail of the memory file into the system prompt on every prompt build
// (re-injects when the file changes mid-session), and always emits a pointer
// to the file so the model can actively read/write it.
// Token-conscious: memory file capped at 6KB (newest kept), inject cap 3KB,
// entry written only when the last user message changed. Never throws.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const FILE = join(homedir(), '.config/opencode/memory.md')
const MAX_FILE = 6 * 1024
const MAX_INJECT = 3 * 1024
const MAX_ENTRIES = 8

let lastUser = ''
let lastWritten = ''

const trunc = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}

const ts = () => new Date().toISOString().slice(0, 16).replace('T', ' ')

function appendEntry(cwd, line) {
  try {
    const entry = `\n## ${ts()} ${cwd}\n${line}\n`
    const old = readFileSync(FILE, 'utf8').slice(0, MAX_FILE)
    let body = old + entry
    const parts = body.split('## ').filter(Boolean)
    if (parts.length > MAX_ENTRIES) body = '## ' + parts.slice(-MAX_ENTRIES).join('## ')
    if (body.length > MAX_FILE) body = body.slice(-MAX_FILE)
    writeFileSync(FILE, body.startsWith('\n') ? body : '\n' + body)
  } catch {}
}

export default async function memoryPlugin({ directory }) {
  const cwd = directory || process.cwd()
  return {
    'chat.message': async (input, output) => {
      try {
        if (output.message && output.message.role === 'user') {
          const text =
            output.message.text || (output.parts || []).map((p) => p.text || '').join(' ')
          if (text) lastUser = trunc(text, 120)
        }
      } catch {}
    },
    event: async ({ event }) => {
      try {
        if (event && event.type === 'session.idle') {
          if (!lastUser || lastUser === lastWritten) return
          appendEntry(cwd, `last: ${lastUser}`)
          lastWritten = lastUser
        }
      } catch {}
    },
    'experimental.chat.system.transform': async (input, output) => {
      try {
        let mem = ''
        try {
          mem = readFileSync(FILE, 'utf8')
        } catch {
          mem = ''
        }
        mem = mem.trim()
        if (mem.length > MAX_INJECT) mem = mem.slice(-MAX_INJECT)
        output.system.push(
          `[Persistent memory: ${FILE}. Read it with the Read tool when relevant; append durable facts yourself when you learn them. Last notes:\n${mem}\n]`
        )
      } catch {}
    },
  }
}