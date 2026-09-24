// Trip storage for the Claude page, backed by the page's built-in `db`
// (live-synced JSON documents) and `assets` (receipt photos). Mirrors the
// method names of the website's tripApi so the same screens run on both.
//
// Layout:
//   trip/main          trip details and budgets
//   members/{id}       one document per person
//   expenses/{id}      one document per expense (receipts = asset ids)
//   payments/{id}      settle-ups and kitty contributions
import { newId } from '../lib/id.js'
import { SplitError } from '../lib/split.js'
import * as v from '../lib/validate.js'
import { getMe } from '../components/client.js'

export const TRIP_ID = 'main'

// Turn validation and storage failures into messages a person can act on.
function friendly(err) {
  if (err instanceof v.BadRequest || err instanceof SplitError) return err
  switch (err?.code) {
    case 'invalid_argument':
      return new Error('You can view this trip but not change it. Ask the person who set it up for edit access.')
    case 'quota_exceeded':
      return new Error('This trip has reached its storage limit. Delete old receipt photos or expenses to make room.')
    case 'too_large':
      return new Error('That photo is too large. Pick a smaller one.')
    case 'unsupported_type':
      return new Error('Receipts must be JPEG, PNG or WebP photos.')
    case 'rate_limited':
    case 'resource_exhausted':
      return new Error('Too many changes at once. Wait a moment and try again.')
    case 'revoked':
    case 'not_granted':
      return new Error('This page lost access to its data. Reload it to reconnect.')
    default:
      return new Error(err?.message && !err.code ? err.message : 'Couldn’t save. Check your connection and try again.')
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// Retry once on transient platform trouble, as the storage docs advise.
async function write(fn) {
  try {
    return await fn()
  } catch (err) {
    if (err?.code === 'unavailable' || err?.code === 'store_unavailable') {
      await sleep(400 + Math.random() * 600)
      return fn()
    }
    throw err
  }
}

function dataUrlToBlob(dataUrl) {
  const [head, body] = dataUrl.split(',')
  const type = head.match(/^data:([^;]+)/)[1]
  const bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0))
  return new Blob([bytes], { type })
}

const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)

export async function connect() {
  const use = window.claude?.use
  if (!use) return null
  const [db, assets, user] = await Promise.all([use('db'), use('assets'), use('user')])
  if (!db) return null

  // null = the platform didn't say; keep controls and let a refused write decide
  let canWrite = null
  try { canWrite = user ? await user.can('data.write') : null } catch {}
  try { if (user && await user.isOwner()) canWrite = true } catch {}

  const cache = { trip: null, members: [], expenses: [], payments: [] }
  const loaded = { trip: false, members: false, expenses: false, payments: false }
  const listeners = new Set()
  let failure = null
  const emit = () => listeners.forEach(fn => { try { fn() } catch (e) { console.error(e) } })
  const onError = err => { failure = friendly(err); emit() }

  db.doc('trip/main').onSnapshot(snap => {
    cache.trip = snap.exists ? { ...snap.data(), id: TRIP_ID } : null
    loaded.trip = true
    emit()
  }, onError)
  for (const name of ['members', 'expenses', 'payments']) {
    db.collection(name).onSnapshot(snap => {
      cache[name] = snap.docs.map(d => d.data())
      loaded[name] = true
      emit()
    }, onError)
  }

  const members = () => [...cache.members].sort((a, b) => a.order - b.order)
  const me = () => getMe(TRIP_ID) || null
  const actor = () => (cache.members.some(m => m.id === me()) ? me() : null)
  const guard = fn => async (...args) => {
    try { return await fn(...args) } catch (err) { throw friendly(err) }
  }

  async function dropReceipts(ids) {
    if (!assets) return
    for (const id of ids) await assets.delete(id).catch(() => {})
  }

  return {
    canWrite,
    canUploadReceipts: !!assets,
    status: () => ({ ready: Object.values(loaded).every(Boolean), hasTrip: !!cache.trip, failure }),

    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },

    async load() {
      if (!cache.trip) {
        const err = new Error('This trip hasn’t been set up yet.')
        err.status = 404
        throw err
      }
      return {
        trip: cache.trip,
        members: members(),
        expenses: [...cache.expenses].sort(byDateDesc),
        payments: [...cache.payments].sort(byDateDesc),
      }
    },

    createTrip: guard(async input => {
      const details = v.tripDetails(input)
      v.checkDateOrder(details)
      const list = (input.members || []).filter(m => m?.name?.trim())
      if (list.length < 2) throw new v.BadRequest('Add at least two people')
      const now = Date.now()
      const created = []
      list.forEach((m, i) => created.push({ id: newId(8), ...v.memberInput(m, created), order: i, createdAt: now }))
      // people first: the trip document appearing is what switches the page over
      for (const m of created) await write(() => db.doc(`members/${m.id}`).set(m))
      await write(() => db.doc('trip/main').set({ ...details, categoryBudgets: details.categoryBudgets || {}, createdAt: now, updatedAt: now }))
      return { trip: { ...details, id: TRIP_ID }, members: created }
    }),

    updateTrip: guard(async patch => {
      const { id, ...current } = cache.trip
      const trip = { ...current, ...v.tripDetails(patch, { partial: true }), updatedAt: Date.now() }
      v.checkDateOrder(trip)
      await write(() => db.doc('trip/main').set(trip))
      return { trip: { ...trip, id } }
    }),

    addMember: guard(async input => {
      const list = members()
      const member = { id: newId(8), ...v.memberInput(input, list), order: list.length ? list[list.length - 1].order + 1 : 0, createdAt: Date.now() }
      await write(() => db.doc(`members/${member.id}`).set(member))
      return { member }
    }),

    updateMember: guard(async (memberId, input) => {
      const list = members()
      const current = list.find(m => m.id === memberId)
      if (!current) throw new v.BadRequest('That person is no longer on the trip')
      const member = { ...current, ...v.memberInput(input, list.filter(m => m.id !== memberId)) }
      await write(() => db.doc(`members/${memberId}`).set(member))
      return { member }
    }),

    removeMember: guard(async memberId => {
      if (cache.members.length <= 2) throw new v.BadRequest('A trip needs at least two people')
      const involved =
        cache.expenses.some(e => e.paidBy === memberId || e.split.participants.includes(memberId)) ||
        cache.payments.some(p => p.from === memberId || p.to === memberId)
      if (involved) throw new v.BadRequest('They are part of some expenses or payments. Remove them from those first.')
      await write(() => db.doc(`members/${memberId}`).delete())
    }),

    addExpense: guard(async input => {
      const expense = { id: newId(10), ...v.expenseInput(input, members()), createdAt: Date.now(), createdBy: actor() }
      await write(() => db.doc(`expenses/${expense.id}`).set(expense))
      return { expense }
    }),

    updateExpense: guard(async (expenseId, input) => {
      const current = cache.expenses.find(e => e.id === expenseId)
      if (!current) throw new v.BadRequest('That expense was deleted by someone else')
      const clean = v.expenseInput(input, members())
      const expense = { ...current, ...clean, updatedAt: Date.now(), updatedBy: actor() }
      await write(() => db.doc(`expenses/${expenseId}`).set(expense))
      await dropReceipts((current.receipts || []).filter(r => !clean.receipts.includes(r)))
      return { expense }
    }),

    deleteExpense: guard(async expenseId => {
      const current = cache.expenses.find(e => e.id === expenseId)
      await write(() => db.doc(`expenses/${expenseId}`).delete())
      await dropReceipts(current?.receipts || [])
    }),

    addPayment: guard(async input => {
      const payment = { id: newId(10), ...v.paymentInput(input, members()), createdAt: Date.now(), createdBy: actor() }
      await write(() => db.doc(`payments/${payment.id}`).set(payment))
      return { payment }
    }),

    deletePayment: guard(async paymentId => {
      await write(() => db.doc(`payments/${paymentId}`).delete())
    }),

    uploadReceipt: guard(async dataUrl => {
      if (!assets) throw new Error('Only people with edit access can add photos.')
      const { id } = await write(() => assets.upload(dataUrlToBlob(dataUrl), { type: 'image/jpeg' }))
      return { id }
    }),

    // only for photos added to a form that was then cancelled
    deleteReceipt: guard(async receiptId => {
      if (cache.expenses.some(e => (e.receipts || []).includes(receiptId))) return
      await dropReceipts([receiptId])
    }),

    receiptUrl: id => `/_blob/${id}`,
  }
}
