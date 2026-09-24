'use client'
import { useMemo, useRef, useState } from 'react'
import { CATEGORIES, PAYMENT_METHODS } from '@/lib/categories'
import { SPLIT_TYPES, computeShares } from '@/lib/split'
import { formatINR, parseRupees, paiseToInput } from '@/lib/money'
import { todayISO } from '@/lib/insights'
import { Avatar, Icon, Sheet } from './ui'
import { ReceiptPicker, compressImage } from './receipts'

function initialValues(expense) {
  const split = expense?.split
  if (!split || split.type === 'equal') return {}
  const out = {}
  for (const id of split.participants) {
    const v = split.values?.[id]
    out[id] = split.type === 'exact' ? paiseToInput(v) : String(v ?? '')
  }
  return out
}

// Turn the text inputs into the numbers the split maths expects.
function toSplit(type, participants, values) {
  if (type === 'equal') return { type, participants }
  const parsed = {}
  for (const id of participants) {
    const raw = values[id] ?? ''
    parsed[id] = type === 'exact' ? parseRupees(raw || '0') : parseFloat(raw || '0')
  }
  return { type, participants, values: parsed }
}

export default function ExpenseForm({ api, members, me, expense, onClose, onSaved }) {
  const editing = !!expense
  const [title, setTitle] = useState(expense?.title || '')
  const [amount, setAmount] = useState(expense ? paiseToInput(expense.amount) : '')
  const [paidBy, setPaidBy] = useState(expense?.paidBy || me || members[0]?.id)
  const [category, setCategory] = useState(expense?.category || 'food')
  const [date, setDate] = useState(expense?.date || todayISO())
  const [splitType, setSplitType] = useState(expense?.split.type || 'equal')
  const [participants, setParticipants] = useState(expense?.split.participants || members.map(m => m.id))
  const [values, setValues] = useState(() => initialValues(expense))
  const [method, setMethod] = useState(expense?.paymentMethod || '')
  const [location, setLocation] = useState(expense?.location || '')
  const [notes, setNotes] = useState(expense?.notes || '')
  const [receipts, setReceipts] = useState(() => (expense?.receipts || []).map(id => ({ id, key: id })))
  const [showMore, setShowMore] = useState(!!(expense?.notes || expense?.location || expense?.paymentMethod))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const uploadedHere = useRef([]) // receipts uploaded in this form, removed again if it's cancelled

  const amountPaise = parseRupees(amount)
  const amountValid = Number.isInteger(amountPaise) && amountPaise > 0
  const ordered = members.filter(m => participants.includes(m.id)).map(m => m.id)

  const preview = useMemo(() => {
    if (!amountValid) return { shares: null, error: '' }
    const split = toSplit(splitType, ordered, values)
    if (Object.values(split.values || {}).some(Number.isNaN)) return { shares: null, error: 'Enter numbers only in the split boxes' }
    try {
      return { shares: computeShares(amountPaise, split), error: '' }
    } catch (err) {
      return { shares: null, error: err.message }
    }
  }, [amountPaise, amountValid, splitType, ordered.join(','), values]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleParticipant(id) {
    setPeople(participants.includes(id) ? participants.filter(x => x !== id) : [...participants, id])
  }

  function setPeople(next) {
    setParticipants(next)
    // keep percentages summing to 100 as people are added or removed
    if (splitType === 'percent') setValues(evenPercents(members.filter(m => next.includes(m.id)).map(m => m.id)))
  }

  function changeSplitType(type) {
    setSplitType(type)
    if (type === 'shares') setValues(Object.fromEntries(members.map(m => [m.id, '1'])))
    else if (type === 'percent') setValues(evenPercents(ordered))
    else if (type === 'exact') setValues({})
  }

  function evenPercents(ids) {
    if (!ids.length) return {}
    const base = Math.floor(10000 / ids.length) / 100
    const out = Object.fromEntries(ids.map(id => [id, String(base)]))
    const rest = Math.round((100 - base * ids.length) * 100) / 100
    if (rest) out[ids[0]] = String(Math.round((base + rest) * 100) / 100)
    return out
  }

  // Exact split: put whatever is left unassigned onto this person
  function fillRemainder(id) {
    if (!amountValid) return
    const others = ordered.filter(x => x !== id).reduce((a, x) => a + (parseRupees(values[x] || '0') || 0), 0)
    const left = amountPaise - others
    if (left >= 0) setValues(v => ({ ...v, [id]: paiseToInput(left) }))
  }

  async function addReceipts(files) {
    for (const file of files) {
      const key = Math.random().toString(36).slice(2)
      setReceipts(r => [...r, { key, busy: true }])
      try {
        const dataUrl = await compressImage(file)
        setReceipts(r => r.map(x => (x.key === key ? { ...x, preview: dataUrl } : x)))
        const { id } = await api.uploadReceipt(dataUrl)
        uploadedHere.current.push(id)
        setReceipts(r => r.map(x => (x.key === key ? { ...x, id, busy: false } : x)))
      } catch (err) {
        setReceipts(r => r.filter(x => x.key !== key))
        setError(err.message || 'Photo upload failed')
      }
    }
  }

  function removeReceipt(r) {
    setReceipts(list => list.filter(x => x.key !== r.key))
    if (r.id && uploadedHere.current.includes(r.id)) {
      api.deleteReceipt(r.id).catch(() => {})
      uploadedHere.current = uploadedHere.current.filter(x => x !== r.id)
    }
  }

  function cancel() {
    uploadedHere.current.forEach(id => api.deleteReceipt(id).catch(() => {}))
    onClose()
  }

  async function save(e) {
    e?.preventDefault()
    setError('')
    if (!title.trim()) return setError('Add what the expense was for')
    if (!amountValid) return setError('Enter the amount')
    if (!ordered.length) return setError('Pick at least one person to split with')
    if (preview.error) return setError(preview.error)
    if (receipts.some(r => r.busy)) return setError('Wait for the photos to finish uploading')

    const body = {
      title, amount: amountPaise, paidBy, category, date,
      split: toSplit(splitType, ordered, values),
      paymentMethod: method, location, notes,
      receipts: receipts.map(r => r.id).filter(Boolean),
    }
    setSaving(true)
    try {
      const { expense: saved } = editing ? await api.updateExpense(expense.id, body) : await api.addExpense(body)
      uploadedHere.current = []
      onSaved(saved, editing)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const busy = receipts.some(r => r.busy)

  return (
    <Sheet
      title={editing ? 'Edit expense' : 'Add expense'}
      onClose={cancel}
      footer={<>
        <button className="btn" onClick={cancel}>Cancel</button>
        <button className="btn btn-primary grow" onClick={save} disabled={saving || busy}>
          {saving ? <span className="spinner" /> : <Icon name="check" size={16} />} {editing ? 'Save changes' : 'Add expense'}
        </button>
      </>}
    >
      <form className="stack-lg" onSubmit={save}>
        <label className="field">
          <span>Amount</span>
          <div className="input-money">
            <input className="input input-big num" inputMode="decimal" placeholder="0" value={amount} data-autofocus
              onChange={e => setAmount(e.target.value)} aria-label="Amount in rupees" />
          </div>
        </label>

        <label className="field">
          <span>What was it for?</span>
          <input className="input" placeholder="Dinner at beach shack, cab to airport…" value={title} maxLength={100}
            onChange={e => setTitle(e.target.value)} />
        </label>

        <div className="field">
          <span className="label">Category</span>
          <div className="chips">
            {CATEGORIES.map(c => (
              <button type="button" key={c.id} className="chip" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
                <span aria-hidden="true">{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <label className="field">
            <span>Paid by</span>
            <select className="input" value={paidBy} onChange={e => setPaidBy(e.target.value)}>
              {members.map(m => <option key={m.id} value={m.id}>{m.id === me ? `${m.name} (you)` : m.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </label>
        </div>

        <div className="field">
          <div className="row-between">
            <span className="label">Split between</span>
            <div className="row">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPeople(members.map(m => m.id))}>All</button>
              {me && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPeople([me])}>Only me</button>}
            </div>
          </div>
          <div className="chips">
            {members.map(m => (
              <button type="button" key={m.id} className="chip" aria-pressed={participants.includes(m.id)} onClick={() => toggleParticipant(m.id)}>
                <Avatar members={members} id={m.id} size="sm" />{m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">How to split</span>
          <div className="segmented" role="group" aria-label="Split type">
            {SPLIT_TYPES.map(t => (
              <button type="button" key={t.id} aria-pressed={splitType === t.id} onClick={() => changeSplitType(t.id)}>{t.label}</button>
            ))}
          </div>

          <div className="list" style={{ marginTop: 6 }}>
            {ordered.map(id => {
              const m = members.find(x => x.id === id)
              const share = preview.shares?.[id]
              return (
                <div className="list-item" key={id} style={{ padding: '8px 12px' }}>
                  <Avatar members={members} id={id} size="sm" />
                  <span className="grow ellipsis">{m.name}</span>
                  {splitType !== 'equal' && (
                    <div className="row" style={{ width: 128, flex: 'none' }}>
                      {splitType === 'exact' ? (
                        <div className="input-money grow">
                          <input className="input num" inputMode="decimal" placeholder="0" style={{ padding: '6px 8px 6px 24px' }}
                            value={values[id] ?? ''} aria-label={`${m.name}'s amount`}
                            onChange={e => setValues(v => ({ ...v, [id]: e.target.value }))}
                            onDoubleClick={() => fillRemainder(id)} />
                        </div>
                      ) : (
                        <input className="input num grow" inputMode="decimal" style={{ padding: '6px 8px' }}
                          value={values[id] ?? ''} aria-label={`${m.name}'s ${splitType === 'percent' ? 'percentage' : 'shares'}`}
                          onChange={e => setValues(v => ({ ...v, [id]: e.target.value }))} />
                      )}
                      <span className="small muted" style={{ width: 16 }}>{splitType === 'percent' ? '%' : splitType === 'shares' ? '×' : ''}</span>
                    </div>
                  )}
                  <span className="num small strong" style={{ minWidth: 72, textAlign: 'right' }}>
                    {share != null ? formatINR(share) : '—'}
                  </span>
                </div>
              )
            })}
            {!ordered.length && <div className="list-item muted small">Nobody selected</div>}
          </div>
          {amountValid && preview.error && ordered.length > 0 && <div className="error-text">{preview.error}</div>}
          {splitType === 'exact' && <div className="tiny muted">Tip: double-tap a box to fill in whatever is left.</div>}
          {splitType === 'shares' && <div className="tiny muted">Shares are weights. A couple could be 2 and everyone else 1.</div>}
        </div>

        {api.canUploadReceipts !== false && (
          <div className="field">
            <span className="label">Receipt photos</span>
            <ReceiptPicker items={receipts} onAdd={addReceipts} onRemove={removeReceipt} receiptUrl={api.receiptUrl} />
          </div>
        )}

        {!showMore ? (
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowMore(true)}>
            <Icon name="plus" size={14} /> Add place, payment method, notes
          </button>
        ) : (
          <>
            <div className="field">
              <span className="label">Paid with</span>
              <div className="chips">
                {PAYMENT_METHODS.map(m => (
                  <button type="button" key={m.id} className="chip" aria-pressed={method === m.id}
                    onClick={() => setMethod(method === m.id ? '' : m.id)}>{m.label}</button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Place</span>
              <input className="input" placeholder="Restaurant, shop or town" value={location} maxLength={100} onChange={e => setLocation(e.target.value)} />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea className="input" placeholder="Anything worth remembering: what was ordered, who skipped…" value={notes} maxLength={1000}
                onChange={e => setNotes(e.target.value)} />
            </label>
          </>
        )}

        {error && <div className="notice notice-bad" role="alert"><Icon name="alert" size={16} />{error}</div>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
