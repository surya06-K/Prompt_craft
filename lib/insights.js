// Aggregations behind the Insights tab. Dates are local YYYY-MM-DD strings.
import { CATEGORIES } from './categories.js'
import { safeShares } from './split.js'

const DAY = 86400000

export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toUTC(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(iso, n) {
  return new Date(toUTC(iso) + n * DAY).toISOString().slice(0, 10)
}

export function daysBetween(a, b) {
  return Math.round((toUTC(b) - toUTC(a)) / DAY)
}

// The trip's date range: its planned dates, stretched to cover any expense
// logged outside them.
export function tripRange(trip, expenses) {
  const dates = expenses.map(e => e.date).filter(Boolean).sort()
  let start = trip.startDate || dates[0] || null
  let end = trip.endDate || dates[dates.length - 1] || start
  if (dates.length) {
    if (dates[0] < start) start = dates[0]
    if (dates[dates.length - 1] > end) end = dates[dates.length - 1]
  }
  if (!start) return null
  if (end < start) end = start
  return { start, end, days: daysBetween(start, end) + 1 }
}

export function sumAmounts(items) {
  return items.reduce((a, e) => a + e.amount, 0)
}

// [{ category, total, count, budget }] in fixed category order, zero rows
// dropped unless a budget was set for them.
export function byCategory(expenses, categoryBudgets = {}) {
  return CATEGORIES.map(c => {
    const items = expenses.filter(e => e.category === c.id)
    return { category: c, total: sumAmounts(items), count: items.length, budget: categoryBudgets[c.id] || 0 }
  }).filter(r => r.total > 0 || r.budget > 0)
}

// One row per calendar day in the trip range (zero days included so gaps show).
export function byDay(expenses, range) {
  if (!range) return []
  const totals = {}
  for (const e of expenses) totals[e.date] = (totals[e.date] || 0) + e.amount
  const rows = []
  for (let i = 0; i < range.days && i < 120; i++) {
    const date = addDays(range.start, i)
    rows.push({ date, day: i + 1, total: totals[date] || 0 })
  }
  return rows
}

// Per person: what they paid out vs. what they actually consumed.
export function byPerson(members, expenses) {
  const rows = Object.fromEntries(members.map(m => [m.id, { member: m, paid: 0, share: 0 }]))
  for (const e of expenses) {
    if (rows[e.paidBy]) rows[e.paidBy].paid += e.amount
    for (const [id, share] of Object.entries(safeShares(e))) if (rows[id]) rows[id].share += share
  }
  return members.map(m => rows[m.id])
}

export function byMethod(expenses) {
  const totals = {}
  for (const e of expenses) totals[e.paymentMethod || 'other'] = (totals[e.paymentMethod || 'other'] || 0) + e.amount
  return totals
}

// Budget health: 'ok' < 80% < 'warning' < 100% < 'over'
export function budgetStatus(spent, budget) {
  if (!budget) return null
  const ratio = spent / budget
  return { ratio, level: ratio > 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'ok', remaining: budget - spent }
}

// Trip days that have started by `today`, clamped to 1…range.days.
export function elapsedDays(range, today = todayISO()) {
  if (!range) return 1
  return Math.min(range.days, Math.max(1, daysBetween(range.start, today) + 1))
}

// How spending is tracking against an even daily burn of the budget.
export function budgetPace(trip, expenses, today = todayISO()) {
  const range = tripRange(trip, expenses)
  if (!trip.budget || !range) return null
  const perDay = trip.budget / range.days
  const elapsed = Math.min(range.days, Math.max(0, daysBetween(range.start, today) + 1))
  const spent = sumAmounts(expenses)
  const expected = Math.round(perDay * elapsed)
  const avgPerDay = elapsed ? spent / elapsed : 0
  return {
    perDay: Math.round(perDay),
    elapsed,
    days: range.days,
    expected,
    spent,
    avgPerDay: Math.round(avgPerDay),
    projected: elapsed ? Math.round(avgPerDay * range.days) : spent,
  }
}
