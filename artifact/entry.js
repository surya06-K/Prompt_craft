// The Claude page: one trip, stored in the page's own database, using the
// same screens as the website.
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import TripApp from '../components/TripApp.js'
import CreateTripForm from '../components/CreateTripForm.js'
import { setMe } from '../components/client.js'
import { Icon } from '../components/ui.js'
import { connect, TRIP_ID } from './store.js'

const PLATFORM = { share: false, upiLinks: false, homeHref: null, forget: false }

function App() {
  const [store, setStore] = useState(null)
  const [phase, setPhase] = useState('connecting') // connecting | unavailable | setup | ready
  const [failure, setFailure] = useState(null)

  useEffect(() => {
    let stop = () => {}
    connect().then(s => {
      if (!s) return setPhase('unavailable')
      setStore(s)
      const update = () => {
        const { ready, hasTrip, failure } = s.status()
        setFailure(failure)
        if (hasTrip) setPhase('ready')
        else if (ready) setPhase('setup')
      }
      stop = s.subscribe(update)
      update()
    }, () => setPhase('unavailable'))
    return () => stop()
  }, [])

  if (phase === 'ready') {
    return <TripApp tripId={TRIP_ID} api={store} platform={PLATFORM} readOnly={store.canWrite === false} />
  }

  return (
    <main className="page">
      <div className="home-hero">
        <div className="brand" style={{ marginBottom: 20 }}>TripSplit</div>
        <h1>Every rupee on the trip, split fairly.</h1>
        <p>Log what each person pays, keep the bill photos, watch the budget, and see who owes whom at the end.</p>
      </div>
      {failure && <div className="notice notice-bad" style={{ marginBottom: 16 }}><Icon name="alert" size={16} />{failure.message}</div>}

      {phase === 'connecting' && <div className="card center muted"><span className="spinner" /> Loading your trip…</div>}

      {phase === 'unavailable' && (
        <div className="card stack">
          <h2 className="card-title">Open this page in Claude</h2>
          <p className="small secondary">TripSplit saves expenses with the page&apos;s built-in storage, which works when the page is opened from Claude (on the web or in the Claude app).</p>
        </div>
      )}

      {phase === 'setup' && (store.canWrite === false ? (
        <div className="card stack">
          <h2 className="card-title">No trip yet</h2>
          <p className="small secondary">The person who shared this page hasn&apos;t set up the trip yet. Check back soon.</p>
        </div>
      ) : (
        <CreateTripForm
          subtitle="Add everyone who's going. You can change names, dates and the budget later in Settings."
          onCreate={async input => {
            const { members } = await store.createTrip(input)
            setMe(TRIP_ID, members[0].id) // whoever sets it up is the first person listed
          }}
        />
      ))}
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
