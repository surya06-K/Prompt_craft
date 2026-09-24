import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allocate, computeShares, computeBalances, settleUp, memberLedger, SplitError } from '../lib/split.js'
import { formatINR, formatINRCompact, parseRupees, paiseToInput, roundRupee } from '../lib/money.js'
import { tripRange, byDay, budgetStatus, budgetPace } from '../lib/insights.js'

const sum = obj => Object.values(obj).reduce((a, b) => a + b, 0)
const people = ['a', 'b', 'c', 'd', 'e']

test('allocate always sums to the total', () => {
  for (const total of [1, 2, 99, 100, 1001, 123457]) {
    for (const weights of [[1, 1, 1], [1, 2], [33.33, 33.33, 33.34], [5, 1, 1, 1, 1]]) {
      assert.equal(allocate(total, weights).reduce((a, b) => a + b, 0), total)
    }
  }
})

test('equal split hands leftover paise to the first people', () => {
  const shares = computeShares(100000, { type: 'equal', participants: ['a', 'b', 'c'] })
  assert.deepEqual(shares, { a: 33334, b: 33333, c: 33333 })
})

test('equal split between five for ₹1,500 dinner', () => {
  const shares = computeShares(150000, { type: 'equal', participants: people })
  assert.equal(sum(shares), 150000)
  for (const id of people) assert.equal(shares[id], 30000)
})

test('exact split must add up', () => {
  assert.deepEqual(
    computeShares(50000, { type: 'exact', participants: ['a', 'b'], values: { a: 20000, b: 30000 } }),
    { a: 20000, b: 30000 })
  assert.throws(() => computeShares(50000, { type: 'exact', participants: ['a', 'b'], values: { a: 20000, b: 20000 } }), /still to assign/)
  assert.throws(() => computeShares(50000, { type: 'exact', participants: ['a', 'b'], values: { a: 40000, b: 20000 } }), /over the total/)
})

test('percent split needs 100%', () => {
  const shares = computeShares(100000, { type: 'percent', participants: ['a', 'b', 'c'], values: { a: 50, b: 25, c: 25 } })
  assert.deepEqual(shares, { a: 50000, b: 25000, c: 25000 })
  assert.throws(() => computeShares(100000, { type: 'percent', participants: ['a', 'b'], values: { a: 50, b: 40 } }), SplitError)
})

test('shares split weights people', () => {
  const shares = computeShares(90000, { type: 'shares', participants: ['a', 'b'], values: { a: 2, b: 1 } })
  assert.deepEqual(shares, { a: 60000, b: 30000 })
  assert.throws(() => computeShares(100, { type: 'shares', participants: ['a'], values: { a: 0 } }), /at least 1 share/)
})

test('no participants is an error', () => {
  assert.throws(() => computeShares(100, { type: 'equal', participants: [] }), SplitError)
})

const members = people.map(id => ({ id }))

test('balances net to zero and settle-up clears them', () => {
  const expenses = [
    { id: '1', amount: 500000, paidBy: 'a', split: { type: 'equal', participants: people } },
    { id: '2', amount: 120000, paidBy: 'b', split: { type: 'equal', participants: ['a', 'b', 'c'] } },
    { id: '3', amount: 90000, paidBy: 'c', split: { type: 'exact', participants: ['d', 'e'], values: { d: 40000, e: 50000 } } },
    { id: '4', amount: 33301, paidBy: 'e', split: { type: 'shares', participants: people, values: { a: 1, b: 1, c: 1, d: 2, e: 1 } } },
  ]
  const payments = [{ id: 'p', from: 'd', to: 'a', amount: 50000 }]
  const balances = computeBalances(members, expenses, payments)
  assert.equal(Object.values(balances).reduce((a, b) => a + b.net, 0), 0)

  const transfers = settleUp(balances, people)
  assert.ok(transfers.length <= people.length - 1)
  const after = Object.fromEntries(people.map(id => [id, balances[id].net]))
  for (const t of transfers) { after[t.from] += t.amount; after[t.to] -= t.amount }
  for (const id of people) assert.equal(after[id], 0)
})

test('a payment settles a debt', () => {
  const expenses = [{ id: '1', amount: 1000, paidBy: 'a', split: { type: 'equal', participants: ['a', 'b'] } }]
  const before = computeBalances(members.slice(0, 2), expenses, [])
  assert.equal(before.a.net, 500)
  assert.equal(before.b.net, -500)
  assert.deepEqual(settleUp(before), [{ from: 'b', to: 'a', amount: 500 }])
  const after = computeBalances(members.slice(0, 2), expenses, [{ id: 'p', from: 'b', to: 'a', amount: 500 }])
  assert.equal(after.a.net, 0)
  assert.equal(after.b.net, 0)
  assert.deepEqual(settleUp(after), [])
})

test('ledger lists everything that touches a person', () => {
  const expenses = [
    { id: '1', date: '2026-10-01', createdAt: 1, amount: 1000, paidBy: 'a', split: { type: 'equal', participants: ['a', 'b'] } },
    { id: '2', date: '2026-10-02', createdAt: 2, amount: 600, paidBy: 'c', split: { type: 'equal', participants: ['c', 'd'] } },
  ]
  const payments = [{ id: 'p', date: '2026-10-03', createdAt: 3, from: 'b', to: 'a', amount: 500 }]
  const rows = memberLedger('b', expenses, payments)
  assert.deepEqual(rows.map(r => [r.kind, r.effect]), [['payment', 500], ['expense', -500]])
})

test('money parsing and formatting', () => {
  assert.equal(parseRupees('1,500'), 150000)
  assert.equal(parseRupees('₹ 99.5'), 9950)
  assert.equal(parseRupees('0.01'), 1)
  assert.ok(Number.isNaN(parseRupees('abc')))
  assert.ok(Number.isNaN(parseRupees('1.234')))
  assert.equal(formatINR(12345600), '₹1,23,456')
  assert.equal(formatINR(150050), '₹1,500.50')
  assert.equal(paiseToInput(150050), '1500.5')
  assert.equal(paiseToInput(150005), '1500.05')
  assert.equal(paiseToInput(150000), '1500')
  assert.equal(formatINRCompact(95000), '₹950')
  assert.equal(formatINRCompact(3000000), '₹30k')
  assert.equal(formatINRCompact(12500000), '₹1.3L')
  assert.equal(formatINRCompact(2500000000), '₹2.5Cr')
  assert.equal(roundRupee(3093017), 3093000)
})

test('trip range stretches to cover expenses and fills empty days', () => {
  const trip = { startDate: '2026-10-10', endDate: '2026-10-12' }
  const expenses = [{ date: '2026-10-08', amount: 100 }, { date: '2026-10-11', amount: 50 }]
  const range = tripRange(trip, expenses)
  assert.deepEqual(range, { start: '2026-10-08', end: '2026-10-12', days: 5 })
  assert.deepEqual(byDay(expenses, range).map(d => d.total), [100, 0, 0, 50, 0])
})

test('budget status and pace', () => {
  assert.equal(budgetStatus(50, 100).level, 'ok')
  assert.equal(budgetStatus(85, 100).level, 'warning')
  assert.equal(budgetStatus(101, 100).level, 'over')
  const pace = budgetPace({ budget: 1000, startDate: '2026-10-01', endDate: '2026-10-10' },
    [{ date: '2026-10-01', amount: 300 }], '2026-10-02')
  assert.equal(pace.perDay, 100)
  assert.equal(pace.elapsed, 2)
  assert.equal(pace.projected, 1500)
})

test('group summary lists settle-ups, UPI IDs and every person', async () => {
  const { groupSummary } = await import('../lib/summary.js')
  const trip = { name: 'Goa 2026', destination: 'North Goa', startDate: '2026-09-22', endDate: '2026-09-27' }
  const members = [{ id: 'a', name: 'Prasanna', upi: 'prasanna@okicici' }, { id: 'b', name: 'Ravi' }, { id: 'c', name: 'Sneha' }]
  const expenses = [{ id: '1', amount: 300000, paidBy: 'a', split: { type: 'equal', participants: ['a', 'b', 'c'] } }]
  const text = groupSummary({ trip, members, balances: computeBalances(members, expenses, []) })
  assert.match(text, /^\*Goa 2026\* \(North Goa, 22 Sept – 27 Sept\)/)
  assert.match(text, /Total spent: ₹3,000 · about ₹1,000 per person/)
  assert.match(text, /• Ravi pays Prasanna ₹1,000/)
  assert.match(text, /• Sneha pays Prasanna ₹1,000/)
  assert.match(text, /• Prasanna: prasanna@okicici/)
  assert.match(text, /• Prasanna: paid ₹3,000, share ₹1,000, gets back ₹2,000/)
  const settled = groupSummary({ trip, members, balances: computeBalances(members, [], []) })
  assert.match(settled, /Everyone is settled up\./)
})
