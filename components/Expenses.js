'use client'
import { useMemo, useState } from 'react'
import { CATEGORIES, PAYMENT_METHODS, category } from '@/lib/categories'
import { SPLIT_TYPES, safeShares } from '@/lib/split'
import { formatINR, roundRupee } from '@/lib/money'
import { daysBetween, sumAmounts } from '@/lib/insights'
import { Avatar, Icon, Sheet, formatDate, nameOf, timeAgo } from './ui'
import { ReceiptGallery } from './receipts'

function splitWords(e) {
  return SPLIT_TYPES.find(t => t.id === e.split.type)?.describe || ''
}

function splitSummary(e, members) {
  const n = e.split.participants.length
  if (n === members.length && e.split.type === 'equal') return 'split equally with everyone'
  if (n === 1) return `for ${nameOf(members, e.split.participants[0])}`
  return `split ${splitWords(e)} between ${n}`
}

export function ExpensesTab({ trip, members, expenses, me, balances, onOpen, onAdd }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [person, setPerson] = useState('all')
  const [sort, setSort] = useState('newest')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = expenses.filter(e =>
      (cat === 'all' || e.category === cat) &&
      (person === 'all' || e.paidBy === person || e.split.participants.includes(person)) &&
      (!needle || [e.title, e.notes, e.location, nameOf(members, e.paidBy)].some(s => s?.toLowerCase().includes(needle))))
    if (sort === 'oldest') list = [...list].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    if (sort === 'amount') list = [...list].sort((a, b) => b.amount - a.amount)
    return list
  }, [expenses, q, cat, person, sort, members])

  const groups = useMemo(() => {
    if (sort === 'amount') return [{ date: null, items: filtered }]
    const out = []
    for (const e of filtered) {
      if (out.at(-1)?.date !== e.date) out.push({ date: e.date, items: [] })
      out.at(-1).items.push(e)
    }
    return out
  }, [filtered, sort])

  const total = sumAmounts(expenses)
  const mine = me ? balances[me] : null
  const filtering = q || cat !== 'all' || person !== 'all'

  return (
    <div className="stack">
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Trip total</div>
          <div className="stat-value">{formatINR(total)}</div>
          <div className="stat-sub">{expenses.length} expense{expenses.length === 1 ? '' : 's'}</div>
        </div>
        {mine ? (
          <>
            <div className="stat">
              <div className="stat-label">Your share</div>
              <div className="stat-value">{formatINR(mine.share)}</div>
              <div className="stat-sub">you paid {formatINR(mine.paid)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">{mine.net >= 0 ? 'You get back' : 'You owe'}</div>
              <div className={`stat-value ${mine.net > 0 ? 'good' : mine.net < 0 ? 'bad' : ''}`}>{formatINR(Math.abs(mine.net))}</div>
              <div className="stat-sub">{mine.net === 0 ? 'all square' : 'see Balances to settle'}</div>
            </div>
          </>
        ) : (
          <div className="stat">
            <div className="stat-label">Per person</div>
            <div className="stat-value">{formatINR(roundRupee(total / Math.max(1, members.length)))}</div>
            <div className="stat-sub">average share</div>
          </div>
        )}
      </div>

      {expenses.length > 0 && (
        <div className="filters">
          <div className="filters-search">
            <span style={{ position: 'absolute', left: 11, top: 11, color: 'var(--text-3)' }}><Icon name="search" size={16} /></span>
            <input className="input" style={{ paddingLeft: 34 }} placeholder="Search expenses" value={q} onChange={e => setQ(e.target.value)} aria-label="Search expenses" />
          </div>
          <select className="input" value={cat} onChange={e => setCat(e.target.value)} aria-label="Category">
            <option value="all">Category</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
          <select className="input" value={person} onChange={e => setPerson(e.target.value)} aria-label="Person">
            <option value="all">Anyone</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.id === me ? `${m.name} (you)` : m.name}</option>)}
          </select>
          <select className="input" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="amount">Biggest</option>
          </select>
        </div>
      )}

      {filtering && (
        <div className="row-between small secondary">
          <span>{filtered.length} matching · {formatINR(sumAmounts(filtered))}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setCat('all'); setPerson('all') }}>Clear filters</button>
        </div>
      )}

      {!expenses.length ? (
        <div className="card empty">
          <div className="big">🧾</div>
          <p className="strong" style={{ color: 'var(--text)' }}>No expenses yet</p>
          <p className="small" style={{ margin: '4px 0 14px' }}>
            {onAdd ? 'Log the first one. Everyone with the link can add theirs too.' : 'Expenses show up here as soon as they are added.'}
          </p>
          {onAdd && <button className="btn btn-primary" onClick={onAdd}><Icon name="plus" size={16} /> Add expense</button>}
        </div>
      ) : !filtered.length ? (
        <div className="empty">Nothing matches those filters.</div>
      ) : (
        groups.map(g => (
          <div key={g.date || 'all'}>
            {g.date && (
              <div className="day-head">
                <span>
                  <strong>{formatDate(g.date)}</strong>
                  {trip.startDate && g.date >= trip.startDate && ` · Day ${daysBetween(trip.startDate, g.date) + 1}`}
                </span>
                <span className="num">{formatINR(sumAmounts(g.items))}</span>
              </div>
            )}
            <div className="list">
              {g.items.map(e => <ExpenseRow key={e.id} e={e} members={members} me={me} onOpen={onOpen} showDate={!g.date} />)}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function ExpenseRow({ e, members, me, onOpen, showDate }) {
  const c = category(e.category)
  const myShare = me ? safeShares(e)[me] || 0 : 0
  return (
    <button className="list-item" onClick={() => onOpen(e)}>
      <span className="cat-icon" aria-hidden="true">{c.icon}</span>
      <span className="grow">
        <span className="item-title ellipsis" style={{ display: 'block' }}>{e.title}</span>
        <span className="small muted ellipsis" style={{ display: 'block' }}>
          {nameOf(members, e.paidBy, me)} paid · {splitSummary(e, members)}
          {showDate && ` · ${formatDate(e.date, { day: 'numeric', month: 'short' })}`}
        </span>
      </span>
      <span>
        <span className="item-amount num" style={{ display: 'block' }}>{formatINR(e.amount)}</span>
        <span className="tiny muted row" style={{ justifyContent: 'flex-end', gap: 4 }}>
          {e.receipts?.length > 0 && <><Icon name="receipt" size={12} /><span className="sr-only">has receipt</span></>}
          {me && (myShare ? `you ${formatINR(myShare)}` : 'not you')}
        </span>
      </span>
    </button>
  )
}

export function ExpenseDetail({ expense: e, members, me, api, readOnly, onClose, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const c = category(e.category)
  const shares = safeShares(e)
  const method = PAYMENT_METHODS.find(m => m.id === e.paymentMethod)?.label

  async function remove() {
    setDeleting(true)
    try { await onDelete(e) } catch (err) { setError(err.message); setDeleting(false) }
  }

  return (
    <Sheet
      title="Expense"
      onClose={onClose}
      footer={readOnly ? null : confirming ? (
        <>
          <span className="grow small">Delete “{e.title}”?</span>
          <button className="btn" onClick={() => setConfirming(false)}>Keep</button>
          <button className="btn btn-danger" onClick={remove} disabled={deleting}>{deleting ? <span className="spinner" /> : <Icon name="trash" size={16} />} Delete</button>
        </>
      ) : (
        <>
          <button className="btn btn-danger" onClick={() => setConfirming(true)}><Icon name="trash" size={16} /> Delete</button>
          <button className="btn btn-primary grow" onClick={() => onEdit(e)}><Icon name="edit" size={16} /> Edit</button>
        </>
      )}
    >
      <div className="row" style={{ gap: 12 }}>
        <span className="cat-icon" style={{ width: 48, height: 48, fontSize: 24 }} aria-hidden="true">{c.icon}</span>
        <div className="grow">
          <div className="strong" style={{ fontSize: 18 }}>{e.title}</div>
          <div className="small muted">{c.label} · {formatDate(e.date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
      </div>
      <div className="hero-figure">{formatINR(e.amount)}</div>

      <div className="row wrap small secondary" style={{ gap: 12 }}>
        <span className="row" style={{ gap: 6 }}><Avatar members={members} id={e.paidBy} size="sm" /> Paid by <strong>{nameOf(members, e.paidBy, me)}</strong></span>
        {method && <span className="badge">{method}</span>}
        {e.location && <span className="badge">📍 {e.location}</span>}
      </div>

      <div>
        <div className="section-title" style={{ margin: '0 0 6px' }}>
          Split {splitWords(e)} · {e.split.participants.length} {e.split.participants.length === 1 ? 'person' : 'people'}
        </div>
        <div className="list">
          {e.split.participants.map(id => (
            <div className="list-item" key={id} style={{ padding: '9px 12px' }}>
              <Avatar members={members} id={id} size="sm" />
              <span className="grow">
                {nameOf(members, id, me)}
                {e.split.type === 'percent' && <span className="muted small"> · {e.split.values[id]}%</span>}
                {e.split.type === 'shares' && <span className="muted small"> · {e.split.values[id]} share{e.split.values[id] === 1 ? '' : 's'}</span>}
              </span>
              <span className="num strong">{formatINR(shares[id] || 0)}</span>
            </div>
          ))}
        </div>
      </div>

      {e.notes && (
        <div>
          <div className="section-title" style={{ margin: '0 0 6px' }}>Notes</div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{e.notes}</p>
        </div>
      )}

      {e.receipts?.length > 0 && (
        <div>
          <div className="section-title" style={{ margin: '0 0 6px' }}>Receipts</div>
          <ReceiptGallery ids={e.receipts} receiptUrl={api.receiptUrl} />
        </div>
      )}

      <div className="tiny muted">
        Added {e.createdBy ? `by ${nameOf(members, e.createdBy, me)} ` : ''}{timeAgo(e.createdAt)}
        {e.updatedAt && ` · edited ${e.updatedBy ? `by ${nameOf(members, e.updatedBy, me)} ` : ''}${timeAgo(e.updatedAt)}`}
      </div>
      {error && <div className="notice notice-bad">{error}</div>}
    </Sheet>
  )
}
