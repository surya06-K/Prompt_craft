import { route, body } from '@/lib/http'
import { saveReceipt } from '@/lib/store'

export const dynamic = 'force-dynamic'

// Body: { dataUrl } — the browser shrinks photos to a few hundred KB first
export const POST = route(async (req, { tripId }) => saveReceipt(tripId, (await body(req)).dataUrl))
