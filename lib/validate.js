// Server-side input cleaning. Anyone with a trip link can call the API, so
// every field is re-checked here rather than trusted from the form.
import { CATEGORY_IDS, PAYMENT_METHOD_IDS } from './categories.js'
import { SPLIT_TYPES, SplitError, computeShares } from './split.js'
import { isId } from './id.js'

export class BadRequest extends Error {}

const MAX_PAISE = 1e11 // ₹100 crore — well past any trip
const DATE = /^\d{4}-\d{2}-\d{2}$/
const UPI = /^[\w.-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,64}$/

export function text(value, field, { max = 120, required = false } = {}) {
  const v = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (required && !v) throw new BadRequest(`${field} is required`)
  if (v.length > max) throw new BadRequest(`${field} must be at most ${max} characters`)
  return v
}

function longText(value, field, max) {
  const v = typeof value === 'string' ? value.trim() : ''
  if (v.length > max) throw new BadRequest(`${field} must be at most ${max} characters`)
  return v
}

export function date(value, field, { required = false } = {}) {
  if (!value && !required) return ''
  if (typeof value !== 'string' || !DATE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new BadRequest(`${field} must be a date`)
  }
  return value
}

export function paise(value, field, { min = 1, optional = false } = {}) {
  if (optional && (value === null || value === undefined || value === '' || value === 0)) return 0
  if (!Number.isInteger(value) || value < min || value > MAX_PAISE) {
    throw new BadRequest(`${field} must be an amount${min > 0 ? ' above ₹0' : ''}`)
  }
  return value
}

export function upi(value) {
  const v = typeof value === 'string' ? value.trim() : ''
  if (v && !UPI.test(v)) throw new BadRequest('UPI ID looks wrong — it should be like name@bank')
  return v
}

export function member(value, members, field) {
  if (!members.some(m => m.id === value)) throw new BadRequest(`${field} must be someone on the trip`)
  return value
}

export function tripDetails(input, { partial = false } = {}) {
  const out = {}
  const has = k => !partial || k in input
  if (has('name')) out.name = text(input.name, 'Trip name', { max: 80, required: true })
  if (has('destination')) out.destination = text(input.destination, 'Destination', { max: 80 })
  if (has('startDate')) out.startDate = date(input.startDate, 'Start date')
  if (has('endDate')) out.endDate = date(input.endDate, 'End date')
  if (has('budget')) out.budget = paise(input.budget, 'Budget', { optional: true })
  if (has('categoryBudgets')) {
    const cb = input.categoryBudgets && typeof input.categoryBudgets === 'object' ? input.categoryBudgets : {}
    out.categoryBudgets = {}
    for (const id of CATEGORY_IDS) {
      const v = paise(cb[id], 'Category budget', { optional: true })
      if (v) out.categoryBudgets[id] = v
    }
  }
  return out
}

export function checkDateOrder(trip) {
  if (trip.startDate && trip.endDate && trip.endDate < trip.startDate) {
    throw new BadRequest('End date is before the start date')
  }
}

export function memberInput(input, others = []) {
  const name = text(input?.name, 'Name', { max: 40, required: true })
  const clash = others.find(m => m.name.toLowerCase() === name.toLowerCase())
  if (clash) throw new BadRequest(`${clash.name} is already on the trip. Add an initial to tell them apart.`)
  return { name, upi: upi(input?.upi) }
}

export function expenseInput(input, members) {
  const amount = paise(input?.amount, 'Amount')
  const splitIn = input?.split || {}
  if (!SPLIT_TYPES.some(t => t.id === splitIn.type)) throw new BadRequest('Pick how to split it')

  const participants = [...new Set(Array.isArray(splitIn.participants) ? splitIn.participants : [])]
  participants.forEach(id => member(id, members, 'Split'))
  const split = { type: splitIn.type, participants }
  if (splitIn.type !== 'equal') {
    split.values = {}
    for (const id of participants) {
      const v = splitIn.values?.[id]
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new BadRequest('Every split value must be a number')
      if (splitIn.type === 'exact' && !Number.isInteger(v)) throw new BadRequest('Exact amounts must be in whole paise')
      split.values[id] = v
    }
  }
  try { computeShares(amount, split) } catch (err) {
    if (err instanceof SplitError) throw new BadRequest(err.message)
    throw err
  }

  const receipts = Array.isArray(input.receipts) ? [...new Set(input.receipts)] : []
  if (receipts.length > 6 || !receipts.every(isId)) throw new BadRequest('Up to 6 receipt photos per expense')

  const method = input.paymentMethod || ''
  if (method && !PAYMENT_METHOD_IDS.includes(method)) throw new BadRequest('Unknown payment method')
  const category = CATEGORY_IDS.includes(input.category) ? input.category : 'other'

  return {
    title: text(input.title, 'Description', { max: 100, required: true }),
    amount,
    paidBy: member(input.paidBy, members, 'Paid by'),
    category,
    date: date(input.date, 'Date', { required: true }),
    notes: longText(input.notes, 'Notes', 1000),
    location: text(input.location, 'Place', { max: 100 }),
    paymentMethod: method,
    split,
    receipts,
  }
}

export function paymentInput(input, members) {
  const from = member(input?.from, members, 'From')
  const to = member(input?.to, members, 'To')
  if (from === to) throw new BadRequest('Pick two different people')
  const method = input.method || ''
  if (method && !PAYMENT_METHOD_IDS.includes(method)) throw new BadRequest('Unknown payment method')
  return {
    from,
    to,
    amount: paise(input.amount, 'Amount'),
    date: date(input.date, 'Date', { required: true }),
    note: text(input.note, 'Note', { max: 120 }),
    method,
  }
}

const RECEIPT = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/
export const MAX_RECEIPT_BYTES = 1_500_000

export function receiptInput(dataUrl) {
  const match = typeof dataUrl === 'string' && dataUrl.match(RECEIPT)
  if (!match) throw new BadRequest('Receipt must be a JPEG, PNG or WebP image')
  if (match[2].length * 0.75 > MAX_RECEIPT_BYTES) throw new BadRequest('Receipt photo is too large')
  return { contentType: match[1], base64: match[2] }
}
