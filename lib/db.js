// Tiny Redis client. In production it talks to Upstash Redis over its REST
// API (no npm dependency). For local `npm run dev` without credentials it
// falls back to a JSON file in .data/ that understands the same commands.
import { promises as fs } from 'fs'
import path from 'path'

const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

export class StorageNotConfigured extends Error {
  constructor() {
    super('Storage is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (see README).')
  }
}

// Run commands as one pipeline; returns each command's result in order.
export async function pipeline(commands) {
  if (!commands.length) return []
  if (REST_URL && REST_TOKEN) return upstash(commands)
  if (process.env.VERCEL) throw new StorageNotConfigured()
  return fileStore(commands)
}

export async function command(...args) {
  return (await pipeline([args]))[0]
}

// HGETALL comes back as a flat [field, value, field, value, …] list
export function hashToObject(flat) {
  const out = {}
  for (let i = 0; i + 1 < (flat || []).length; i += 2) out[flat[i]] = flat[i + 1]
  return out
}

async function upstash(commands) {
  const res = await fetch(`${REST_URL.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Redis error ${res.status}: ${await res.text()}`)
  const results = await res.json()
  return results.map(r => {
    if (r.error) throw new Error(`Redis error: ${r.error}`)
    return r.result
  })
}

// ---------- local development fallback ----------

const FILE = path.join(process.cwd(), '.data', 'db.json')
let queue = Promise.resolve()

function fileStore(commands) {
  // serialise so concurrent requests can't interleave read-modify-write
  const run = queue.then(async () => {
    let db
    try { db = JSON.parse(await fs.readFile(FILE, 'utf8')) } catch { db = {} }
    const results = commands.map(cmd => apply(db, cmd))
    await fs.mkdir(path.dirname(FILE), { recursive: true })
    await fs.writeFile(FILE, JSON.stringify(db))
    return results
  })
  queue = run.catch(() => {})
  return run
}

function apply(db, [name, key, ...args]) {
  switch (name.toUpperCase()) {
    case 'GET': return typeof db[key] === 'string' ? db[key] : null
    case 'SET': db[key] = String(args[0]); return 'OK'
    case 'DEL': {
      let n = 0
      for (const k of [key, ...args]) if (k in db) { delete db[k]; n++ }
      return n
    }
    case 'EXISTS': return key in db ? 1 : 0
    case 'HSET': {
      const h = (db[key] ||= {})
      let added = 0
      for (let i = 0; i + 1 < args.length; i += 2) {
        if (!(args[i] in h)) added++
        h[args[i]] = String(args[i + 1])
      }
      return added
    }
    case 'HGET': return db[key]?.[args[0]] ?? null
    case 'HGETALL': return Object.entries(db[key] || {}).flat()
    case 'HDEL': {
      let n = 0
      for (const f of args) if (db[key] && f in db[key]) { delete db[key][f]; n++ }
      if (db[key] && !Object.keys(db[key]).length) delete db[key]
      return n
    }
    default: throw new Error(`Local store does not support ${name}`)
  }
}
