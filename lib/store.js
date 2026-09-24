// Trip data access. Layout in Redis:
//   trip:{id}                 JSON trip details
//   trip:{id}:members         hash memberId  → JSON member
//   trip:{id}:expenses        hash expenseId → JSON expense
//   trip:{id}:payments        hash paymentId → JSON payment
//   trip:{id}:receipt:{rid}   "image/jpeg;<base64>"
// Expenses and payments live in hashes so two people adding at the same time
// write separate fields instead of overwriting one shared document.
import { command, pipeline, hashToObject } from './db.js'
import { newId, isId, TRIP_ID_LENGTH } from './id.js'
import * as v from './validate.js'

export class NotFound extends Error {}
export class Conflict extends Error {}

const key = {
  trip: id => `trip:${id}`,
  members: id => `trip:${id}:members`,
  expenses: id => `trip:${id}:expenses`,
  payments: id => `trip:${id}:payments`,
  receipt: (id, rid) => `trip:${id}:receipt:${rid}`,
}

const MAX_MEMBERS = 30

function parseAll(flat) {
  return Object.values(hashToObject(flat)).map(s => JSON.parse(s))
}

function checkTripId(tripId) {
  if (!isId(tripId)) throw new NotFound('Trip not found')
}

export async function getTrip(tripId) {
  checkTripId(tripId)
  const raw = await command('GET', key.trip(tripId))
  if (!raw) throw new NotFound('Trip not found')
  return JSON.parse(raw)
}

async function getMembers(tripId) {
  const members = parseAll(await command('HGETALL', key.members(tripId)))
  return members.sort((a, b) => a.order - b.order)
}

export async function getBundle(tripId) {
  checkTripId(tripId)
  const [trip, members, expenses, payments] = await pipeline([
    ['GET', key.trip(tripId)],
    ['HGETALL', key.members(tripId)],
    ['HGETALL', key.expenses(tripId)],
    ['HGETALL', key.payments(tripId)],
  ])
  if (!trip) throw new NotFound('Trip not found')
  return {
    trip: JSON.parse(trip),
    members: parseAll(members).sort((a, b) => a.order - b.order),
    expenses: parseAll(expenses).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    payments: parseAll(payments).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
  }
}

// Who is making a change — only recorded when it names a real member.
function actor(by, members) {
  return members.some(m => m.id === by) ? by : null
}

export async function createTrip(input) {
  const details = v.tripDetails(input)
  v.checkDateOrder(details)
  const list = Array.isArray(input.members) ? input.members.filter(m => m?.name?.trim()) : []
  if (list.length < 2) throw new v.BadRequest('Add at least two people')
  if (list.length > MAX_MEMBERS) throw new v.BadRequest(`At most ${MAX_MEMBERS} people per trip`)

  const now = Date.now()
  const members = []
  list.forEach((m, i) => {
    members.push({ id: newId(8), ...v.memberInput(m, members), order: i, createdAt: now })
  })
  const trip = { id: newId(TRIP_ID_LENGTH), ...details, categoryBudgets: details.categoryBudgets || {}, createdAt: now, updatedAt: now }

  await pipeline([
    ['SET', key.trip(trip.id), JSON.stringify(trip)],
    ['HSET', key.members(trip.id), ...members.flatMap(m => [m.id, JSON.stringify(m)])],
  ])
  return { trip, members }
}

export async function updateTrip(tripId, input) {
  const trip = { ...(await getTrip(tripId)), ...v.tripDetails(input, { partial: true }), updatedAt: Date.now() }
  v.checkDateOrder(trip)
  await command('SET', key.trip(tripId), JSON.stringify(trip))
  return trip
}

export async function addMember(tripId, input) {
  await getTrip(tripId)
  const members = await getMembers(tripId)
  if (members.length >= MAX_MEMBERS) throw new v.BadRequest(`At most ${MAX_MEMBERS} people per trip`)
  const member = {
    id: newId(8),
    ...v.memberInput(input, members),
    order: members.length ? members[members.length - 1].order + 1 : 0,
    createdAt: Date.now(),
  }
  await command('HSET', key.members(tripId), member.id, JSON.stringify(member))
  return member
}

export async function updateMember(tripId, memberId, input) {
  await getTrip(tripId)
  const members = await getMembers(tripId)
  const current = members.find(m => m.id === memberId)
  if (!current) throw new NotFound('Person not found')
  const member = { ...current, ...v.memberInput(input, members.filter(m => m.id !== memberId)) }
  await command('HSET', key.members(tripId), memberId, JSON.stringify(member))
  return member
}

export async function removeMember(tripId, memberId) {
  const { members, expenses, payments } = await getBundle(tripId)
  if (!members.some(m => m.id === memberId)) throw new NotFound('Person not found')
  if (members.length <= 2) throw new Conflict('A trip needs at least two people')
  const involved =
    expenses.some(e => e.paidBy === memberId || e.split.participants.includes(memberId)) ||
    payments.some(p => p.from === memberId || p.to === memberId)
  if (involved) throw new Conflict('They are part of some expenses or payments. Remove them from those first.')
  await command('HDEL', key.members(tripId), memberId)
}

export async function saveExpense(tripId, expenseId, input, by) {
  const { members, expenses } = await getBundle(tripId)
  const clean = v.expenseInput(input, members)
  const now = Date.now()
  const who = actor(by, members)

  let expense
  let dropped = []
  if (expenseId) {
    const current = expenses.find(e => e.id === expenseId)
    if (!current) throw new NotFound('Expense not found')
    expense = { ...current, ...clean, updatedAt: now, updatedBy: who }
    dropped = (current.receipts || []).filter(r => !clean.receipts.includes(r))
  } else {
    expense = { id: newId(10), ...clean, createdAt: now, createdBy: who }
  }

  await pipeline([
    ['HSET', key.expenses(tripId), expense.id, JSON.stringify(expense)],
    ...(dropped.length ? [['DEL', ...dropped.map(r => key.receipt(tripId, r))]] : []),
  ])
  return expense
}

export async function deleteExpense(tripId, expenseId) {
  await getTrip(tripId)
  const raw = await command('HGET', key.expenses(tripId), expenseId)
  if (!raw) throw new NotFound('Expense not found')
  const receipts = JSON.parse(raw).receipts || []
  await pipeline([
    ['HDEL', key.expenses(tripId), expenseId],
    ...(receipts.length ? [['DEL', ...receipts.map(r => key.receipt(tripId, r))]] : []),
  ])
}

export async function addPayment(tripId, input, by) {
  await getTrip(tripId)
  const members = await getMembers(tripId)
  const payment = { id: newId(10), ...v.paymentInput(input, members), createdAt: Date.now(), createdBy: actor(by, members) }
  await command('HSET', key.payments(tripId), payment.id, JSON.stringify(payment))
  return payment
}

export async function deletePayment(tripId, paymentId) {
  await getTrip(tripId)
  const removed = await command('HDEL', key.payments(tripId), paymentId)
  if (!removed) throw new NotFound('Payment not found')
}

export async function saveReceipt(tripId, dataUrl) {
  await getTrip(tripId)
  const { contentType, base64 } = v.receiptInput(dataUrl)
  const id = newId(12)
  await command('SET', key.receipt(tripId, id), `${contentType};${base64}`)
  return { id }
}

export async function getReceipt(tripId, receiptId) {
  checkTripId(tripId)
  if (!isId(receiptId)) throw new NotFound('Receipt not found')
  const raw = await command('GET', key.receipt(tripId, receiptId))
  if (!raw) throw new NotFound('Receipt not found')
  const split = raw.indexOf(';')
  return { contentType: raw.slice(0, split), body: Buffer.from(raw.slice(split + 1), 'base64') }
}

// Only for photos uploaded in a form that was then cancelled — a receipt that
// an expense still points at is removed with that expense instead.
export async function deleteUnusedReceipt(tripId, receiptId) {
  if (!isId(receiptId)) throw new NotFound('Receipt not found')
  const { expenses } = await getBundle(tripId)
  if (expenses.some(e => (e.receipts || []).includes(receiptId))) throw new Conflict('Receipt is attached to an expense')
  await command('DEL', key.receipt(tripId, receiptId))
}
