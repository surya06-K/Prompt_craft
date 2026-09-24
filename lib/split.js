// Split maths shared by the browser (live previews) and the API (validation).
// Every amount here is integer paise.
import { formatINR } from './money.js'

export const SPLIT_TYPES = [
  { id: 'equal',   label: 'Equally', describe: 'equally' },
  { id: 'exact',   label: 'Exact ₹', describe: 'by exact amounts' },
  { id: 'percent', label: '%',       describe: 'by percentage' },
  { id: 'shares',  label: 'Shares',  describe: 'by shares' },
]

export class SplitError extends Error {}

// Hand out `total` paise in proportion to `weights`, flooring each part and
// giving the leftover paise to the largest fractional remainders (ties go to
// whoever is listed first) so the parts always sum exactly to `total`.
export function allocate(total, weights) {
  const sum = weights.reduce((a, w) => a + w, 0)
  if (sum <= 0) throw new SplitError('Nothing to split between')
  const raw = weights.map(w => (total * w) / sum)
  const parts = raw.map(Math.floor)
  let left = total - parts.reduce((a, p) => a + p, 0)
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) parts[order[k].i]++
  return parts
}

// → { [memberId]: paise } for every participant; throws SplitError when the
// split doesn't add up.
export function computeShares(amount, split) {
  const participants = split?.participants || []
  if (!participants.length) throw new SplitError('Pick at least one person to split with')
  const values = split.values || {}

  switch (split.type) {
    case 'equal': {
      const parts = allocate(amount, participants.map(() => 1))
      return Object.fromEntries(participants.map((id, i) => [id, parts[i]]))
    }
    case 'exact': {
      const parts = participants.map(id => values[id] || 0)
      const sum = parts.reduce((a, p) => a + p, 0)
      if (sum !== amount) {
        const diff = amount - sum
        throw new SplitError(diff > 0
          ? `${formatINR(diff)} still to assign (total is ${formatINR(amount)})`
          : `${formatINR(-diff)} over the total of ${formatINR(amount)}`)
      }
      return Object.fromEntries(participants.map((id, i) => [id, parts[i]]))
    }
    case 'percent': {
      const pcts = participants.map(id => values[id] || 0)
      const sum = pcts.reduce((a, p) => a + p, 0)
      if (Math.abs(sum - 100) > 0.001) {
        throw new SplitError(`Percentages add up to ${+sum.toFixed(2)}%, not 100%`)
      }
      const parts = allocate(amount, pcts)
      return Object.fromEntries(participants.map((id, i) => [id, parts[i]]))
    }
    case 'shares': {
      const weights = participants.map(id => values[id] || 0)
      if (weights.some(w => w <= 0)) throw new SplitError('Every person needs at least 1 share')
      const parts = allocate(amount, weights)
      return Object.fromEntries(participants.map((id, i) => [id, parts[i]]))
    }
    default:
      throw new SplitError('Unknown split type')
  }
}

// Same as computeShares but never throws — for rendering stored data.
export function safeShares(expense) {
  try { return computeShares(expense.amount, expense.split) } catch { return {} }
}

// → { [memberId]: { paid, share, sent, received, net } }
// net > 0 means the group owes this person money; net < 0 means they owe.
export function computeBalances(members, expenses, payments) {
  const out = {}
  const row = id => (out[id] ||= { paid: 0, share: 0, sent: 0, received: 0, net: 0 })
  members.forEach(m => row(m.id))

  for (const e of expenses) {
    row(e.paidBy).paid += e.amount
    for (const [id, share] of Object.entries(safeShares(e))) row(id).share += share
  }
  for (const p of payments) {
    row(p.from).sent += p.amount
    row(p.to).received += p.amount
  }
  for (const r of Object.values(out)) r.net = r.paid - r.share + r.sent - r.received
  return out
}

// Greedy minimum-transfers plan: repeatedly match the biggest debtor with the
// biggest creditor. Produces at most (people − 1) payments.
export function settleUp(balances, memberOrder = Object.keys(balances)) {
  const rank = id => { const i = memberOrder.indexOf(id); return i === -1 ? Infinity : i }
  const byNet = (a, b) => b.amt - a.amt || rank(a.id) - rank(b.id)
  const creditors = []
  const debtors = []
  for (const [id, b] of Object.entries(balances)) {
    if (b.net > 0) creditors.push({ id, amt: b.net })
    else if (b.net < 0) debtors.push({ id, amt: -b.net })
  }

  const transfers = []
  while (creditors.length && debtors.length) {
    creditors.sort(byNet)
    debtors.sort(byNet)
    const c = creditors[0]
    const d = debtors[0]
    const amt = Math.min(c.amt, d.amt)
    transfers.push({ from: d.id, to: c.id, amount: amt })
    c.amt -= amt
    d.amt -= amt
    if (!c.amt) creditors.shift()
    if (!d.amt) debtors.shift()
  }
  return transfers
}

// Every expense and payment that touches one person, newest first, with how
// it moved their balance.
export function memberLedger(memberId, expenses, payments) {
  const rows = []
  for (const e of expenses) {
    const share = safeShares(e)[memberId] || 0
    const paid = e.paidBy === memberId ? e.amount : 0
    if (!share && !paid) continue
    rows.push({ kind: 'expense', id: e.id, date: e.date, at: e.createdAt, item: e, paid, share, effect: paid - share })
  }
  for (const p of payments) {
    if (p.from !== memberId && p.to !== memberId) continue
    const effect = p.from === memberId ? p.amount : -p.amount
    rows.push({ kind: 'payment', id: p.id, date: p.date, at: p.createdAt, item: p, paid: 0, share: 0, effect })
  }
  return rows.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.at || 0) - (a.at || 0))
}
