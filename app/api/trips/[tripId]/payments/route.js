import { route, body, by } from '@/lib/http'
import { addPayment } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const POST = route(async (req, { tripId }) => ({ payment: await addPayment(tripId, await body(req), by(req)) }))
