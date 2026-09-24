'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { computeBalances } from '@/lib/split'
import { tripApi, getMe, setMe as storeMe, rememberTrip, forgetTrip } from './client'
import { Avatar, Icon, Sheet, tripDates, useToast } from './ui'
import ExpenseForm from './ExpenseForm'
import { ExpensesTab, ExpenseDetail } from './Expenses'
import { BalancesTab, PaymentForm, MemberLedger } from './Balances'
import { InsightsTab } from './Insights'
import { SettingsTab } from './Settings'

const TABS = [
  { id: 'expenses', label: 'Expenses', icon: 'list' },
  { id: 'balances', label: 'Balances', icon: 'scale' },
  { id: 'insights', label: 'Insights', icon: 'chart' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]
const POLL_MS = 15000

export default function TripApp({ tripId, justCreated }) {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [meRaw, setMeRaw] = useState(undefined) // undefined until read from storage
  const [tab, setTab] = useState('expenses')
  const [sheet, setSheet] = useState(null)
  const [toastNode, toast] = useToast()
  const meRef = useRef(null)

  const api = useMemo(() => tripApi(tripId, () => meRef.current), [tripId])

  const refresh = useCallback(async () => {
    try {
      const bundle = await api.load()
      setData(bundle)
      setLoadError(null)
      return bundle
    } catch (err) {
      setLoadError(err)
    }
  }, [api])

  // first load, then poll while the tab is visible so everyone sees new expenses
  useEffect(() => {
    setMeRaw(getMe(tripId))
    const hash = window.location.hash.slice(1)
    if (TABS.some(t => t.id === hash)) setTab(hash)
    if (justCreated) setSheet({ kind: 'share' })

    refresh()
    const tick = () => { if (document.visibilityState === 'visible') refresh() }
    const timer = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [tripId, justCreated, refresh])

  useEffect(() => {
    if (!data) return
    rememberTrip(data.trip)
    document.title = `${data.trip.name} · TripSplit`
  }, [data?.trip]) // eslint-disable-line react-hooks/exhaustive-deps

  const members = data?.members || []
  const me = meRaw && members.some(m => m.id === meRaw) ? meRaw : null
  meRef.current = me
  const balances = useMemo(() => (data ? computeBalances(data.members, data.expenses, data.payments) : {}), [data])

  // ask who's using this phone the first time they open the trip
  useEffect(() => {
    if (data && meRaw !== undefined && !sheet && (meRaw === null || (meRaw && !data.members.some(m => m.id === meRaw)))) {
      setSheet({ kind: 'whoami' })
    }
  }, [data, meRaw, sheet])

  function chooseMe(id) {
    storeMe(tripId, id)
    setMeRaw(id)
    setSheet(null)
  }

  function switchTab(id) {
    setTab(id)
    window.history.replaceState(null, '', `#${id}`)
    window.scrollTo({ top: 0 })
  }

  async function share() {
    const url = window.location.href.split(/[?#]/)[0]
    const text = `Add your expenses for ${data?.trip.name || 'our trip'} here:`
    if (navigator.share) {
      try { await navigator.share({ title: data?.trip.name, text, url }); return } catch (err) { if (err.name === 'AbortError') return }
    }
    try { await navigator.clipboard.writeText(url); toast('Link copied') } catch { toast('Copy the link from the address bar') }
  }

  function upsert(list, item) {
    const i = list.findIndex(x => x.id === item.id)
    return i === -1 ? [item, ...list] : list.map(x => (x.id === item.id ? item : x))
  }

  function onExpenseSaved(expense, edited) {
    setData(d => ({ ...d, expenses: upsert(d.expenses, expense).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt) }))
    setSheet(edited ? { kind: 'view', id: expense.id } : null)
    toast(edited ? 'Expense updated' : 'Expense added')
    refresh()
  }

  async function deleteExpense(expense) {
    await api.deleteExpense(expense.id)
    setData(d => ({ ...d, expenses: d.expenses.filter(e => e.id !== expense.id) }))
    setSheet(null)
    toast('Expense deleted')
    refresh()
  }

  async function savePayment(input) {
    const { payment } = await api.addPayment(input)
    setData(d => ({ ...d, payments: upsert(d.payments, payment) }))
    setSheet(null)
    toast('Payment recorded')
    refresh()
  }

  async function deletePayment(payment) {
    try {
      await api.deletePayment(payment.id)
      setData(d => ({ ...d, payments: d.payments.filter(p => p.id !== payment.id) }))
      toast('Payment deleted')
      refresh()
    } catch (err) { toast(err.message) }
  }

  if (!data) {
    return (
      <main className="page" style={{ paddingTop: 80 }}>
        {loadError ? <LoadError error={loadError} onRetry={refresh} /> : (
          <div className="center muted"><span className="spinner" /> Loading trip…</div>
        )}
      </main>
    )
  }

  const { trip, expenses, payments } = data
  const viewing = sheet?.kind === 'view' ? expenses.find(e => e.id === sheet.id) : null
  const sub = [trip.destination, tripDates(trip)].filter(Boolean).join(' · ')

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="icon-btn" aria-label="All trips"><Icon name="back" /></Link>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="trip-title ellipsis">{trip.name}</div>
            {sub && <div className="small muted ellipsis">{sub}</div>}
          </div>
          <button className="row" onClick={() => switchTab('settings')} aria-label="People" style={{ gap: 0 }}>
            {members.slice(0, 5).map((m, i) => (
              <span key={m.id} style={{ marginLeft: i ? -4 : 0, borderRadius: '50%', boxShadow: '0 0 0 2px var(--bg)' }}>
                <Avatar members={members} id={m.id} size="sm" />
              </span>
            ))}
            {members.length > 5 && <span className="tiny muted" style={{ marginLeft: 4 }}>+{members.length - 5}</span>}
          </button>
          <button className="icon-btn" onClick={share} aria-label="Share trip link"><Icon name="share" /></button>
        </div>
        <nav className="tabs" role="tablist" aria-label="Trip sections">
          {TABS.map(t => (
            <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => switchTab(t.id)}>
              <Icon name={t.icon} size={18} />{t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="page" style={{ paddingTop: 16 }}>
        {loadError && (
          <div className="notice notice-warn small" style={{ marginBottom: 12 }}>
            <Icon name="alert" size={14} /><span className="grow">Couldn&apos;t refresh. Showing the last data loaded.</span>
            <button className="btn btn-sm" onClick={refresh}>Retry</button>
          </div>
        )}
        {tab === 'expenses' && (
          <ExpensesTab trip={trip} members={members} expenses={expenses} me={me} balances={balances}
            onOpen={e => setSheet({ kind: 'view', id: e.id })} onAdd={() => setSheet({ kind: 'add' })} />
        )}
        {tab === 'balances' && (
          <BalancesTab trip={trip} members={members} payments={payments} balances={balances} me={me}
            onRecord={initial => setSheet({ kind: 'pay', initial })}
            onOpenMember={id => setSheet({ kind: 'member', id })}
            onDeletePayment={deletePayment} />
        )}
        {tab === 'insights' && (
          <InsightsTab trip={trip} members={members} expenses={expenses} me={me}
            onOpenSettings={() => switchTab('settings')} onOpenExpense={e => setSheet({ kind: 'view', id: e.id })} />
        )}
        {tab === 'settings' && (
          <SettingsTab trip={trip} members={members} me={me} api={api} onChanged={refresh} toast={toast}
            onSetMe={id => chooseMe(id || '')} onShare={share}
            onForget={() => { forgetTrip(tripId); window.location.href = '/' }} />
        )}
      </main>

      {tab !== 'settings' && (
        <button className="fab" onClick={() => setSheet({ kind: 'add' })}><Icon name="plus" /> Add expense</button>
      )}

      {(sheet?.kind === 'add' || sheet?.kind === 'edit') && (
        <ExpenseForm api={api} members={members} me={me} expense={sheet.expense}
          onClose={() => setSheet(sheet.kind === 'edit' ? { kind: 'view', id: sheet.expense.id } : null)}
          onSaved={onExpenseSaved} />
      )}
      {viewing && (
        <ExpenseDetail expense={viewing} members={members} me={me} api={api}
          onClose={() => setSheet(null)} onEdit={e => setSheet({ kind: 'edit', expense: e })} onDelete={deleteExpense} />
      )}
      {sheet?.kind === 'pay' && (
        <PaymentForm members={members} me={me} initial={sheet.initial} onClose={() => setSheet(null)} onSave={savePayment} />
      )}
      {sheet?.kind === 'member' && (
        <MemberLedger memberId={sheet.id} members={members} expenses={expenses} payments={payments} balances={balances} me={me}
          onClose={() => setSheet(null)} onOpenExpense={e => setSheet({ kind: 'view', id: e.id })} />
      )}
      {sheet?.kind === 'whoami' && (
        <Sheet title="Who are you?" onClose={() => chooseMe('')}>
          <p className="secondary small">Pick your name so the app can show what you owe and fill you in as the payer. This is remembered on this device only.</p>
          <div className="list">
            {members.map(m => (
              <button className="list-item" key={m.id} onClick={() => chooseMe(m.id)}>
                <Avatar members={members} id={m.id} /> <span className="grow strong">{m.name}</span> <Icon name="arrow" size={16} />
              </button>
            ))}
          </div>
          <button className="btn btn-ghost" onClick={() => chooseMe('')}>I&apos;m just viewing</button>
        </Sheet>
      )}
      {sheet?.kind === 'share' && (
        <Sheet title="Trip created 🎉" onClose={() => setSheet(null)}
          footer={<button className="btn btn-primary btn-block" onClick={share}><Icon name="share" size={16} /> Share link with the group</button>}>
          <p>Send this link to everyone on the trip. They open it, pick their name, and can start adding expenses from their own phone.</p>
          <input className="input" readOnly value={typeof window !== 'undefined' ? window.location.href.split(/[?#]/)[0] : ''} onFocus={e => e.target.select()} aria-label="Trip link" />
          <p className="small muted">Anyone with the link can add and edit expenses, so share it only with the group.</p>
        </Sheet>
      )}
      {toastNode}
    </>
  )
}

function LoadError({ error, onRetry }) {
  const notFound = error.status === 404
  const notConfigured = error.status === 503
  return (
    <div className="card empty stack" style={{ alignItems: 'center' }}>
      <div className="big">{notFound ? '🧭' : '⚠️'}</div>
      <p className="strong" style={{ color: 'var(--text)' }}>
        {notFound ? 'Trip not found' : notConfigured ? 'Storage isn’t set up yet' : 'Couldn’t load the trip'}
      </p>
      <p className="small">{notFound ? 'Check the link. It may have been mistyped.' : error.message}</p>
      <div className="row">
        <Link href="/" className="btn">All trips</Link>
        {!notFound && <button className="btn btn-primary" onClick={onRetry}><Icon name="refresh" size={16} /> Try again</button>}
      </div>
    </div>
  )
}
