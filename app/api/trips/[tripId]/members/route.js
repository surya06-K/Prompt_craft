import { route, body } from '@/lib/http'
import { addMember } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const POST = route(async (req, { tripId }) => ({ member: await addMember(tripId, await body(req)) }))
