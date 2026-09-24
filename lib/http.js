import { NextResponse } from 'next/server'
import { StorageNotConfigured } from './db.js'
import { BadRequest } from './validate.js'
import { NotFound, Conflict } from './store.js'

const STATUS = [
  [BadRequest, 400],
  [NotFound, 404],
  [Conflict, 409],
  [StorageNotConfigured, 503],
]

// Wrap a route handler so thrown errors become JSON { error } responses.
export function route(fn) {
  return async (req, ctx) => {
    try {
      const result = await fn(req, (await ctx?.params) || {})
      if (result instanceof Response) return result
      return NextResponse.json(result ?? { ok: true }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (err) {
      const status = STATUS.find(([type]) => err instanceof type)?.[1]
      if (!status) console.error(err)
      return NextResponse.json({ error: status ? err.message : 'Something went wrong. Try again.' }, { status: status || 500 })
    }
  }
}

export async function body(req) {
  try { return await req.json() } catch { throw new BadRequest('Request body must be JSON') }
}

// The browser sends which trip member is using it, for "added by" labels.
export function by(req) {
  return req.headers.get('x-member-id') || null
}
