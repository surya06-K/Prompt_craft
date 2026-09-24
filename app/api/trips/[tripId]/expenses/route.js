import { route, body, by } from '@/lib/http'
import { saveExpense } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const POST = route(async (req, { tripId }) => ({ expense: await saveExpense(tripId, null, await body(req), by(req)) }))
