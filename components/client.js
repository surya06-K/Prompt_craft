// Browser-side helpers: API calls and per-device memory.

async function request(method, url, body, memberId) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(memberId ? { 'x-member-id': memberId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  let data = {}
  try { data = await res.json() } catch {}
  if (!res.ok) {
    const err = new Error(data.error || (res.status >= 500 ? 'Server error. Try again.' : `Request failed (${res.status})`))
    err.status = res.status
    throw err
  }
  return data
}

export function createTrip(input) {
  return request('POST', '/api/trips', input)
}

export function tripApi(tripId, getMe = () => null) {
  const base = `/api/trips/${encodeURIComponent(tripId)}`
  const call = (method, path, body) => request(method, base + path, body, getMe())
  return {
    load: () => call('GET', ''),
    updateTrip: patch => call('PATCH', '', patch),
    addMember: m => call('POST', '/members', m),
    updateMember: (id, m) => call('PATCH', `/members/${id}`, m),
    removeMember: id => call('DELETE', `/members/${id}`),
    addExpense: e => call('POST', '/expenses', e),
    updateExpense: (id, e) => call('PUT', `/expenses/${id}`, e),
    deleteExpense: id => call('DELETE', `/expenses/${id}`),
    addPayment: p => call('POST', '/payments', p),
    deletePayment: id => call('DELETE', `/payments/${id}`),
    uploadReceipt: dataUrl => call('POST', '/receipts', { dataUrl }),
    deleteReceipt: id => call('DELETE', `/receipts/${id}`),
    receiptUrl: id => `${base}/receipts/${id}`,
  }
}

// ---------- localStorage (may be unavailable in private mode) ----------

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch { return fallback }
}

function write(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function getRecentTrips() {
  return read('tripsplit:recent', [])
}

export function rememberTrip(trip) {
  const entry = { id: trip.id, name: trip.name, destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate, openedAt: Date.now() }
  write('tripsplit:recent', [entry, ...getRecentTrips().filter(t => t.id !== trip.id)].slice(0, 12))
}

export function forgetTrip(tripId) {
  write('tripsplit:recent', getRecentTrips().filter(t => t.id !== tripId))
  write(`tripsplit:me:${tripId}`, null)
}

export function getMe(tripId) {
  return read(`tripsplit:me:${tripId}`, null)
}

// memberId: a member's id, '' for "just viewing", or null to ask again
export function setMe(tripId, memberId) {
  write(`tripsplit:me:${tripId}`, memberId ?? null)
}

// Pull a trip id out of a pasted link or a bare code.
export function parseTripLink(input) {
  const s = (input || '').trim()
  const fromUrl = s.match(/\/t\/([0-9A-Za-z]{6,32})/)
  if (fromUrl) return fromUrl[1]
  return /^[0-9A-Za-z]{6,32}$/.test(s) ? s : null
}
