'use client'
import { useState } from 'react'
import { CATEGORIES } from '@/lib/categories'
import { formatINR, parseRupees, paiseToInput } from '@/lib/money'
import { Avatar, Icon } from './ui'

function Saver({ busy, onClick, children = 'Save' }) {
  return (
    <button className="btn btn-primary" onClick={onClick} disabled={busy} style={{ alignSelf: 'flex-start' }}>
      {busy ? <span className="spinner" /> : <Icon name="check" size={16} />} {children}
    </button>
  )
}

// Run an async save with its own busy / error state per section.
function useSave(toast) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run(fn, done = 'Saved') {
    setBusy(true)
    setError('')
    try { await fn(); toast(done); return true } catch (err) { setError(err.message); return false } finally { setBusy(false) }
  }
  return { busy, error, setError, run }
}

export function SettingsTab({ trip, members, me, api, readOnly, onChanged, onSetMe, onShare, onForget, toast }) {
  return (
    <div className="stack-lg">
      {onShare ? <ShareCard onShare={onShare} /> : !readOnly && <InviteNote />}
      <DeviceCard members={members} me={me} onSetMe={onSetMe} onForget={onForget} />
      {readOnly ? (
        <div className="notice notice-info small"><Icon name="users" size={16} />You can view this trip. Ask the person who set it up to give you edit access if you want to add expenses.</div>
      ) : (
        <>
          <PeopleCard members={members} me={me} api={api} onChanged={onChanged} toast={toast} />
          <BudgetCard trip={trip} api={api} onChanged={onChanged} toast={toast} />
          <DetailsCard trip={trip} api={api} onChanged={onChanged} toast={toast} />
        </>
      )}
    </div>
  )
}

function ShareCard({ onShare }) {
  const url = typeof window !== 'undefined' ? window.location.href.split('?')[0] : ''
  return (
    <section className="card stack">
      <h3 className="card-title">Invite the group</h3>
      <p className="small secondary">Anyone with this link can view and add expenses, so share it only with the people on the trip.</p>
      <div className="row">
        <input className="input grow" readOnly value={url} onFocus={e => e.target.select()} aria-label="Trip link" />
        <button className="btn btn-primary" onClick={onShare}><Icon name="share" size={16} /> Share</button>
      </div>
    </section>
  )
}

function InviteNote() {
  return (
    <section className="card stack">
      <h3 className="card-title">Keep the group updated</h3>
      <p className="small secondary">Everything you log is saved in this page. To show the others where things stand, open Balances and tap Copy summary, then paste it in your group chat.</p>
    </section>
  )
}

function DeviceCard({ members, me, onSetMe, onForget }) {
  return (
    <section className="card stack">
      <h3 className="card-title">On this phone</h3>
      <label className="field">
        <span>I am</span>
        <select className="input" value={me || ''} onChange={e => onSetMe(e.target.value || null)}>
          <option value="">Just viewing</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <p className="tiny muted">Used to fill in “Paid by”, show your share and tag who added what.</p>
      {onForget && <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onForget}>Remove this trip from my recent trips</button>}
    </section>
  )
}

function PeopleCard({ members, me, api, onChanged, toast }) {
  const [editing, setEditing] = useState(null) // member id
  const [draft, setDraft] = useState({ name: '', upi: '' })
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState(null)
  const save = useSave(toast)

  function startEdit(m) {
    setEditing(m.id); setAdding(false); setDraft({ name: m.name, upi: m.upi || '' }); save.setError('')
  }
  function startAdd() {
    setAdding(true); setEditing(null); setDraft({ name: '', upi: '' }); save.setError('')
  }
  async function submit() {
    const ok = await save.run(async () => {
      if (adding) await api.addMember(draft)
      else await api.updateMember(editing, draft)
      await onChanged()
    }, adding ? `${draft.name.trim()} added` : 'Saved')
    if (ok) { setEditing(null); setAdding(false) }
  }
  async function remove(m) {
    await save.run(async () => { await api.removeMember(m.id); await onChanged() }, `${m.name} removed`)
    setRemoving(null)
  }

  const form = (
    <div className="stack" style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
      <div className="grid-2">
        <label className="field"><span>Name</span>
          <input className="input" value={draft.name} maxLength={40} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} autoFocus />
        </label>
        <label className="field"><span>UPI ID (optional)</span>
          <input className="input" value={draft.upi} placeholder="name@okbank" autoCapitalize="none" autoCorrect="off"
            onChange={e => setDraft(d => ({ ...d, upi: e.target.value }))} />
        </label>
      </div>
      <div className="row">
        <button className="btn" onClick={() => { setEditing(null); setAdding(false) }}>Cancel</button>
        <Saver busy={save.busy} onClick={submit}>{adding ? 'Add person' : 'Save'}</Saver>
      </div>
    </div>
  )

  return (
    <section className="card stack">
      <div className="row-between">
        <h3 className="card-title">People ({members.length})</h3>
        {!adding && <button className="btn btn-sm" onClick={startAdd}><Icon name="plus" size={14} /> Add person</button>}
      </div>
      {adding && form}
      {members.map(m => (
        <div key={m.id}>
          {editing === m.id ? form : (
            <div className="row" style={{ gap: 10 }}>
              <Avatar members={members} id={m.id} />
              <div className="grow">
                <div className="strong">{m.name}{m.id === me && <span className="muted small"> (you)</span>}</div>
                <div className="small muted">{m.upi ? `UPI: ${m.upi}` : 'No UPI ID'}</div>
              </div>
              {removing === m.id ? (
                <>
                  <button className="btn btn-sm" onClick={() => setRemoving(null)}>Keep</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(m)} disabled={save.busy}>Remove</button>
                </>
              ) : (
                <>
                  <button className="icon-btn" onClick={() => startEdit(m)} aria-label={`Edit ${m.name}`}><Icon name="edit" size={16} /></button>
                  <button className="icon-btn" onClick={() => { setRemoving(m.id); save.setError('') }} aria-label={`Remove ${m.name}`}><Icon name="trash" size={16} /></button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
      {save.error && <div className="notice notice-bad small"><Icon name="alert" size={14} />{save.error}</div>}
    </section>
  )
}

function BudgetCard({ trip, api, onChanged, toast }) {
  const [budget, setBudget] = useState(trip.budget ? paiseToInput(trip.budget) : '')
  const [cats, setCats] = useState(() => Object.fromEntries(CATEGORIES.map(c => [c.id, trip.categoryBudgets?.[c.id] ? paiseToInput(trip.categoryBudgets[c.id]) : ''])))
  const save = useSave(toast)
  const catTotal = Object.values(cats).reduce((a, v) => a + (parseRupees(v) || 0), 0)

  function submit() {
    const total = budget.trim() ? parseRupees(budget) : 0
    if (Number.isNaN(total)) return save.setError('Budget must be a number')
    const categoryBudgets = {}
    for (const [id, v] of Object.entries(cats)) {
      if (!v.trim()) continue
      const p = parseRupees(v)
      if (Number.isNaN(p)) return save.setError('Category budgets must be numbers')
      if (p) categoryBudgets[id] = p
    }
    save.run(async () => { await api.updateTrip({ budget: total, categoryBudgets }); await onChanged() }, 'Budget saved')
  }

  return (
    <section className="card stack">
      <h3 className="card-title">Budget</h3>
      <label className="field">
        <span>Total trip budget (whole group)</span>
        <div className="input-money"><input className="input num" inputMode="decimal" value={budget} placeholder="e.g. 60000" onChange={e => setBudget(e.target.value)} /></div>
      </label>
      <details>
        <summary className="small strong" style={{ cursor: 'pointer', padding: '4px 0' }}>Budget per category (optional)</summary>
        <div className="grid-2" style={{ marginTop: 10 }}>
          {CATEGORIES.map(c => (
            <label className="field" key={c.id}>
              <span>{c.icon} {c.label}</span>
              <div className="input-money"><input className="input num" inputMode="decimal" value={cats[c.id]} onChange={e => setCats(v => ({ ...v, [c.id]: e.target.value }))} /></div>
            </label>
          ))}
        </div>
        {catTotal > 0 && <p className="tiny muted" style={{ marginTop: 8 }}>Category budgets add up to {formatINR(catTotal)}.</p>}
      </details>
      {save.error && <div className="notice notice-bad small"><Icon name="alert" size={14} />{save.error}</div>}
      <Saver busy={save.busy} onClick={submit}>Save budget</Saver>
    </section>
  )
}

function DetailsCard({ trip, api, onChanged, toast }) {
  const [d, setD] = useState({ name: trip.name, destination: trip.destination || '', startDate: trip.startDate || '', endDate: trip.endDate || '' })
  const save = useSave(toast)
  const set = k => e => setD(v => ({ ...v, [k]: e.target.value }))
  return (
    <section className="card stack">
      <h3 className="card-title">Trip details</h3>
      <div className="grid-2">
        <label className="field"><span>Trip name</span><input className="input" value={d.name} maxLength={80} onChange={set('name')} /></label>
        <label className="field"><span>Destination</span><input className="input" value={d.destination} maxLength={80} onChange={set('destination')} /></label>
        <label className="field"><span>Starts</span><input className="input" type="date" value={d.startDate} onChange={set('startDate')} /></label>
        <label className="field"><span>Ends</span><input className="input" type="date" value={d.endDate} min={d.startDate || undefined} onChange={set('endDate')} /></label>
      </div>
      {save.error && <div className="notice notice-bad small"><Icon name="alert" size={14} />{save.error}</div>}
      <Saver busy={save.busy} onClick={() => save.run(async () => { await api.updateTrip(d); await onChanged() })}>Save details</Saver>
    </section>
  )
}
