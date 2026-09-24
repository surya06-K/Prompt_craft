// Plain-text trip summary to paste into the group chat, for when one
// person logs everything and the others just need the numbers.
import { formatINR, roundRupee } from './money.js'
import { settleUp } from './split.js'

const shortDate = iso => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function groupSummary({ trip, members, balances }) {
  const name = id => members.find(m => m.id === id)?.name || 'Someone'
  const total = Object.values(balances).reduce((a, b) => a + b.paid, 0)
  const transfers = settleUp(balances, members.map(m => m.id))

  const where = [trip.destination, trip.startDate && (trip.endDate && trip.endDate !== trip.startDate
    ? `${shortDate(trip.startDate)} – ${shortDate(trip.endDate)}`
    : shortDate(trip.startDate))].filter(Boolean).join(', ')

  const lines = [`*${trip.name}*${where ? ` (${where})` : ''}`]
  lines.push(`Total spent: ${formatINR(total)} · about ${formatINR(roundRupee(total / Math.max(1, members.length)))} per person`)
  lines.push('')

  if (transfers.length) {
    lines.push('*To settle up*')
    for (const t of transfers) lines.push(`• ${name(t.from)} pays ${name(t.to)} ${formatINR(t.amount)}`)
    const payees = [...new Set(transfers.map(t => t.to))]
      .map(id => members.find(m => m.id === id))
      .filter(m => m?.upi)
    if (payees.length) {
      lines.push('')
      lines.push('*UPI IDs*')
      for (const m of payees) lines.push(`• ${m.name}: ${m.upi}`)
    }
  } else {
    lines.push('Everyone is settled up.')
  }

  lines.push('')
  lines.push('*Each person*')
  for (const m of members) {
    const b = balances[m.id] || { paid: 0, share: 0, net: 0 }
    const status = b.net > 0 ? `gets back ${formatINR(b.net)}` : b.net < 0 ? `owes ${formatINR(-b.net)}` : 'settled'
    lines.push(`• ${m.name}: paid ${formatINR(b.paid)}, share ${formatINR(b.share)}, ${status}`)
  }
  return lines.join('\n')
}
