'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTrip, getRecentTrips, parseTripLink, rememberTrip, setMe } from '@/components/client'
import { Icon, tripDates } from '@/components/ui'
import CreateTripForm from '@/components/CreateTripForm'

export default function Home() {
  const router = useRouter()
  const [recent, setRecent] = useState([])
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState('')

  useEffect(() => { setRecent(getRecentTrips()) }, [])

  async function create(input) {
    const { trip, members } = await createTrip(input)
    setMe(trip.id, members[0].id) // whoever creates the trip is the first person listed
    rememberTrip(trip)
    router.push(`/t/${trip.id}?new=1`)
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

        <CreateTripForm onCreate={create} />

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
