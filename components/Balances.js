'use client'
import { useState } from 'react'
import { PAYMENT_METHODS, category } from '@/lib/categories'
import { memberLedger, settleUp } from '@/lib/split'
import { formatINR, parseRupees, paiseToInput } from '@/lib/money'
import { todayISO } from '@/lib/insights'
import { Avatar, Icon, Sheet, formatDate, nameOf } from './ui'

function upiLink(member, amount, note) {
  const params = new URLSearchParams({ pa: member.upi, pn: member.name, am: (amount / 100).toFixed(2), cu: 'INR', tn: note })
  return `upi://pay?${params}`
}

function netLabel(net) {
  if (net > 0) return { text: `gets back ${formatINR(net)}`, cls: 'good' }
  if (net < 0) return { text: `owes ${formatINR(-net)}`, cls: 'bad' }
  return { text: 'settled up', cls: 'muted' }
}

export function BalancesTab({ trip, members, payments, balances, me, onRecord, onOpenMember, onDeletePayment }) {
  const transfers = settleUp(balances, members.map(m => m.id))
  const mine = me ? balances[me] : null
  const byId = Object.fromEntries(members.map(m => [m.id, m]))

  return (
    <div className="stack">
      {mine && (
        <div className="card">
          <div className="card-sub">{mine.net > 0 ? 'Overall, you get back' : mine.net < 0 ? 'Overall, you owe' : 'Overall'}</div>
          <div className={`hero-figure ${mine.net > 0 ? 'good' : mine.net < 0 ? 'bad' : ''}`}>
            {mine.net === 0 ? 'All square ✓' : formatINR(Math.abs(mine.net))}
          </div>
          <div className="small secondary" style={{ marginTop: 4 }}>
            You paid {formatINR(mine.paid)} · your share is {formatINR(mine.share)}
            {(mine.sent || mine.received) ? ` · settled ${formatINR(mine.sent)} out, ${formatINR(mine.received)} in` : ''}
          </div>
        </div>
      )}

      <div className="section-title">Settle up</div>
      {transfers.length ? (
        <div className="list">
          {transfers.map(t => {
            const to = byId[t.to]
            const canUpi = to?.upi && (!me || me === t.from)
            return (
              <div className="list-item settle-row" key={`${t.from}-${t.to}`}>
                <div className="row" style={{ minWidth: 0 }}>
                  <Avatar members={members} id={t.from} size="sm" />
                  <span className="strong ellipsis">{nameOf(members, t.from, me)}</span>
                  <span className="muted" style={{ flex: 'none', display: 'flex' }}><Icon name="arrow" size={14} /></span>
                  <Avatar members={members} id={t.to} size="sm" />
                  <span className="strong ellipsis">{nameOf(members, t.to, me)}</span>
                </div>
                <span className="num strong settle-amount">{formatINR(t.amount)}</span>
                <div className="row settle-actions">
                  {canUpi && (
                    <a className="btn btn-sm" href={upiLink(to, t.amount, `${trip.name} settle-up`)}>Pay via UPI</a>
                  )}
                  <button className="btn btn-sm btn-primary" onClick={() => onRecord({ from: t.from, to: t.to, amount: t.amount })}>
                    <Icon name="check" size={14} /> Mark paid
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card notice-good notice" style={{ border: 'none' }}><Icon name="check" size={16} /> Everyone is settled up.</div>
      )}
      <div className="tiny muted" style={{ padding: '0 2px' }}>
        The fewest payments that clear every balance. Use “Pay via UPI” on your phone to open GPay, PhonePe or Paytm with the amount filled in.
        Add UPI IDs under Settings → People.
      </div>

      <div className="row-between" style={{ marginTop: 8 }}>
        <div className="section-title" style={{ margin: 0 }}>Everyone</div>
        <span className="tiny muted">tap a person for their full breakdown</span>
      </div>
      <div className="list">
        {members.map(m => {
          const b = balances[m.id] || { paid: 0, share: 0, net: 0 }
          const label = netLabel(b.net)
          return (
            <button className="list-item" key={m.id} onClick={() => onOpenMember(m.id)}>
              <Avatar members={members} id={m.id} />
              <span className="grow">
                <span className="item-title" style={{ display: 'block' }}>{m.id === me ? `${m.name} (you)` : m.name}</span>
                <span className="small muted">paid {formatINR(b.paid)} · share {formatINR(b.share)}</span>
              </span>
              <span style={{ textAlign: 'right', flex: 'none' }}>
                <span className="tiny muted" style={{ display: 'block' }}>{b.net > 0 ? 'gets back' : b.net < 0 ? 'owes' : 'settled'}</span>
                <span className={`strong num ${label.cls}`}>{b.net ? formatINR(Math.abs(b.net)) : '✓'}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="row-between" style={{ marginTop: 8 }}>
        <div className="section-title" style={{ margin: 0 }}>Payments between you</div>
        <button className="btn btn-sm" onClick={() => onRecord({})}><Icon name="plus" size={14} /> Record payment</button>
      </div>
      {payments.length ? (
        <div className="list">
          {payments.map(p => (
            <PaymentRow key={p.id} p={p} members={members} me={me} onDelete={onDeletePayment} />
          ))}
        </div>
      ) : (
        <div className="small muted" style={{ padding: '0 2px' }}>
          None yet. Record settle-ups here, or money put into a common kitty (for example, everyone gives ₹5,000 to the person paying for things).
        </div>
      )}
    </div>
  )
}

function PaymentRow({ p, members, me, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const method = PAYMENT_METHODS.find(m => m.id === p.method)?.label
  return (
    <div className="list-item">
      <span className="cat-icon" aria-hidden="true">💸</span>
      <span className="grow">
        <span className="item-title" style={{ display: 'block' }}>
          {nameOf(members, p.from, me)} paid {nameOf(members, p.to, me)}
        </span>
        <span className="small muted">
          {formatDate(p.date, { day: 'numeric', month: 'short' })}{method ? ` · ${method}` : ''}{p.note ? ` · ${p.note}` : ''}
        </span>
      </span>
      <span className="item-amount num">{formatINR(p.amount)}</span>
      {confirming ? (
        <span className="row">
          <button className="btn btn-sm" onClick={() => setConfirming(false)}>Keep</button>
          <button className="btn btn-sm btn-danger" disabled={busy}
            onClick={async () => { setBusy(true); try { await onDelete(p) } finally { setBusy(false); setConfirming(false) } }}>
            Delete
          </button>
        </span>
      ) : (
        <button className="icon-btn" onClick={() => setConfirming(true)} aria-label="Delete payment"><Icon name="trash" size={16} /></button>
      )}
    </div>
  )
}

export function PaymentForm({ members, me, initial, onClose, onSave }) {
  const [from, setFrom] = useState(initial.from || me || members[0].id)
  const [to, setTo] = useState(initial.to || members.find(m => m.id !== (initial.from || me || members[0].id))?.id)
  const [amount, setAmount] = useState(initial.amount ? paiseToInput(initial.amount) : '')
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState('upi')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e?.preventDefault()
    const paise = parseRupees(amount)
    if (!Number.isInteger(paise) || paise <= 0) return setError('Enter the amount')
    if (from === to) return setError('Pick two different people')
    setSaving(true)
    try {
      await onSave({ from, to, amount: paise, date, method, note })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Sheet
      title="Record a payment"
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary grow" onClick={save} disabled={saving}>
          {saving ? <span className="spinner" /> : <Icon name="check" size={16} />} Save payment
        </button>
      </>}
    >
      <form className="stack-lg" onSubmit={save}>
        <div className="grid-2">
          <label className="field">
            <span>Who paid</span>
            <select className="input" value={from} onChange={e => setFrom(e.target.value)}>
              {members.map(m => <option key={m.id} value={m.id}>{m.id === me ? `${m.name} (you)` : m.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Paid to</span>
            <select className="input" value={to} onChange={e => setTo(e.target.value)}>
              {members.map(m => <option key={m.id} value={m.id}>{m.id === me ? `${m.name} (you)` : m.name}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Amount</span>
          <div className="input-money">
            <input className="input input-big num" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" data-autofocus />
          </div>
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Method</span>
            <select className="input" value={method} onChange={e => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Note (optional)</span>
          <input className="input" value={note} maxLength={120} onChange={e => setNote(e.target.value)} placeholder="Settle-up, kitty contribution…" />
        </label>
        {error && <div className="notice notice-bad" role="alert"><Icon name="alert" size={16} />{error}</div>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}

// One person's complete record: every expense they paid for or shared in,
// and every payment they sent or received.
export function MemberLedger({ memberId, members, expenses, payments, balances, me, onClose, onOpenExpense }) {
  const member = members.find(m => m.id === memberId)
  if (!member) return null
  const b = balances[memberId] || { paid: 0, share: 0, sent: 0, received: 0, net: 0 }
  const rows = memberLedger(memberId, expenses, payments)
  const label = netLabel(b.net)

  return (
    <Sheet title={member.id === me ? `${member.name} (you)` : member.name} onClose={onClose}>
      <div className="row" style={{ gap: 12 }}>
        <Avatar members={members} id={memberId} size="lg" />
        <div className="grow">
          <div className={`strong ${label.cls}`} style={{ fontSize: 18 }}>{label.text[0].toUpperCase() + label.text.slice(1)}</div>
          {member.upi && <div className="small muted">UPI: {member.upi}</div>}
        </div>
      </div>
      <div className="stats">
        <div className="stat"><div className="stat-label">Paid for the group</div><div className="stat-value">{formatINR(b.paid)}</div></div>
        <div className="stat"><div className="stat-label">Their share</div><div className="stat-value">{formatINR(b.share)}</div></div>
        {(b.sent > 0 || b.received > 0) && (
          <div className="stat"><div className="stat-label">Settled</div><div className="stat-value" style={{ fontSize: 17 }}>{formatINR(b.sent)} out</div><div className="stat-sub">{formatINR(b.received)} in</div></div>
        )}
      </div>

      {rows.length ? (
        <div className="list">
          {rows.map(r => {
            const isExpense = r.kind === 'expense'
            const p = r.item
            const Row = isExpense ? 'button' : 'div'
            return (
              <Row className="list-item" key={r.kind + r.id} {...(isExpense ? { onClick: () => onOpenExpense(p) } : {})}>
                <span className="cat-icon" aria-hidden="true">{isExpense ? category(p.category).icon : '💸'}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="item-title ellipsis" style={{ display: 'block' }}>
                    {isExpense ? p.title : p.from === memberId ? `Paid ${nameOf(members, p.to, me)}` : `Received from ${nameOf(members, p.from, me)}`}
                  </span>
                  <span className="small muted">
                    {formatDate(r.date, { day: 'numeric', month: 'short' })}
                    {isExpense && r.paid > 0 && ` · paid ${formatINR(r.paid)}`}
                    {isExpense && ` · share ${r.share ? formatINR(r.share) : '₹0'}`}
                    {!isExpense && p.note && ` · ${p.note}`}
                  </span>
                </span>
                <span className={`num strong ${r.effect > 0 ? 'good' : r.effect < 0 ? 'bad' : 'muted'}`} style={{ whiteSpace: 'nowrap' }}>
                  {r.effect > 0 ? '+' : r.effect < 0 ? '−' : ''}{formatINR(Math.abs(r.effect))}
                </span>
              </Row>
            )
          })}
        </div>
      ) : (
        <div className="empty">No expenses involve {member.name} yet.</div>
      )}
      <div className="tiny muted">+ means the group owes {member.id === me ? 'you' : member.name} more after that item, − means {member.id === me ? 'you owe' : 'they owe'} more.</div>
    </Sheet>
  )
}
