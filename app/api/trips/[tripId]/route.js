import { route, body } from '@/lib/http'
import { getBundle, updateTrip } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const GET = route(async (req, { tripId }) => getBundle(tripId))

export const PATCH = route(async (req, { tripId }) => ({ trip: await updateTrip(tripId, await body(req)) }))
