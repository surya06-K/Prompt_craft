import { route, body } from '@/lib/http'
import { createTrip } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const POST = route(async req => createTrip(await body(req)))
