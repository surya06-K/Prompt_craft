import { route, body } from '@/lib/http'
import { updateMember, removeMember } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const PATCH = route(async (req, { tripId, memberId }) => ({ member: await updateMember(tripId, memberId, await body(req)) }))

export const DELETE = route(async (req, { tripId, memberId }) => removeMember(tripId, memberId))
