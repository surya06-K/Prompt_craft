'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseRupees } from '@/lib/money'
import { createTrip, getRecentTrips, parseTripLink, rememberTrip, setMe } from '@/components/client'
import { Icon, initials, tripDates } from '@/components/ui'

const START_PEOPLE = 5

export default function Home() {
  const router = useRouter()
  const [recent, setRecent] = useState([])
  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [people, setPeople] = useState(() => Array.from({ length: START_PEOPLE }, () => ({ name: '', upi: '' })))
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState('')

  useEffect(() => { setRecent(getRecentTrips()) }, [])

  function setPerson(i, patch) {
    setPeople(list => list.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    const members = people.map(p => ({ name: p.name.trim(), upi: p.upi.trim() })).filter(p => p.name)
    if (!name.trim()) return setError('Give the trip a name')
    if (members.length < 2) return setError('Add at least two people')
    const lower = members.map(m => m.name.toLowerCase())
    if (new Set(lower).size !== lower.length) return setError('Two people have the same name. Add an initial to tell them apart.')
    const budgetPaise = budget.trim() ? parseRupees(budget) : 0
    if (Number.isNaN(budgetPaise)) return setError('Budget must be a number')

    setCreating(true)
    try {
      const { trip, members: created } = await createTrip({ name, destination, startDate, endDate, budget: budgetPaise, members })
      setMe(trip.id, created[0].id) // whoever creates the trip is the first person listed
      rememberTrip(trip)
      router.push(`/t/${trip.id}?new=1`)
    } catch (err) {
      setError(err.message)
      setCreating(false)
    }
  }

  function openLink(e) {
    e.preventDefault()
    const id = parseTripLink(link)
    if (!id) return setLinkError('Paste the trip link someone shared with you')
    router.push(`/t/${id}`)
  }

  return (
    <main className="page">
      <div className="home-hero">
        <div className="brand" style={{ marginBottom: 20 }}>TripSplit</div>
        <h1>Every rupee on the trip, split fairly.</h1>
        <p>Everyone logs what they pay from their own phone. TripSplit keeps the receipts, tracks the budget and works out who owes whom.</p>
      </div>

      <div className="stack-lg">
        {recent.length > 0 && (
          <section className="stack">
            <div className="section-title">Your trips</div>
            <div className="list">
              {recent.map(t => (
                <a key={t.id} href={`/t/${t.id}`} className="list-item" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <span className="cat-icon" aria-hidden="true">🧳</span>
                  <span className="grow">
                    <span className="item-title" style={{ display: 'block' }}>{t.name}</span>
                    <span className="small muted">{[t.destination, tripDates(t)].filter(Boolean).join(' · ') || 'No dates yet'}</span>
                  </span>
                  <Icon name="arrow" size={16} />
                </a>
              ))}
            </div>
          </section>
        )}

        <form className="card stack-lg" onSubmit={submit}>
          <div>
            <h2 className="card-title" style={{ fontSize: 18 }}>Start a new trip</h2>
            <p className="card-sub">You&apos;ll get a link to share with the group.</p>
          </div>

          <div className="grid-2">
            <label className="field"><span>Trip name</span>
              <input className="input" value={name} maxLength={80} placeholder="Goa 2026" onChange={e => setName(e.target.value)} />
            </label>
            <label className="field"><span>Destination (optional)</span>
              <input className="input" value={destination} maxLength={80} placeholder="North Goa" onChange={e => setDestination(e.target.value)} />
            </label>
            <label className="field"><span>Starts</span>
              <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </label>
            <label className="field"><span>Ends</span>
              <input className="input" type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} />
            </label>
          </div>

          <label className="field"><span>Group budget (optional)</span>
            <div className="input-money"><input className="input num" inputMode="decimal" value={budget} placeholder="e.g. 60000" onChange={e => setBudget(e.target.value)} /></div>
          </label>

          <div className="stack">
            <div className="row-between">
              <span className="label">Who&apos;s going?</span>
              <span className="tiny muted">UPI IDs are optional and let people pay each other in one tap</span>
            </div>
            {people.map((p, i) => (
              <div className="person-row" key={i}>
                <span className="avatar" style={{ '--c': `var(--m${i % 8})`, '--c-ink': `var(--m${i % 8}-ink)` }} aria-hidden="true">
                  {p.name.trim() ? initials(p.name) : i + 1}
                </span>
                <div className="grid-2" style={{ gap: 6 }}>
                  <input className="input" value={p.name} maxLength={40} placeholder={i === 0 ? 'Your name' : `Person ${i + 1}`}
                    aria-label={i === 0 ? 'Your name' : `Person ${i + 1} name`} onChange={e => setPerson(i, { name: e.target.value })} />
                  <input className="input" value={p.upi} placeholder="UPI ID (optional)" autoCapitalize="none" autoCorrect="off"
                    aria-label={`Person ${i + 1} UPI ID`} onChange={e => setPerson(i, { upi: e.target.value })} />
                </div>
                {people.length > 2 ? (
                  <button type="button" className="icon-btn" onClick={() => setPeople(list => list.filter((_, j) => j !== i))} aria-label={`Remove person ${i + 1}`}>
                    <Icon name="x" size={16} />
                  </button>
                ) : <span />}
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}
              onClick={() => setPeople(list => [...list, { name: '', upi: '' }])}>
              <Icon name="plus" size={14} /> Add another person
            </button>
          </div>

          {error && <div className="notice notice-bad" role="alert"><Icon name="alert" size={16} />{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={creating} style={{ padding: '12px 16px', fontSize: 15 }}>
            {creating ? <span className="spinner" /> : <Icon name="arrow" size={16} />} Create trip
          </button>
        </form>

        <form className="card stack" onSubmit={openLink}>
          <h2 className="card-title">Joining a trip?</h2>
          <p className="card-sub">Open the link your friend shared, or paste it here.</p>
          <div className="row">
            <input className="input grow" value={link} placeholder="https://…/t/AbC123xyz" onChange={e => { setLink(e.target.value); setLinkError('') }} aria-label="Trip link" />
            <button className="btn" type="submit">Open</button>
          </div>
          {linkError && <div className="error-text">{linkError}</div>}
        </form>
      </div>
    </main>
  )
}
