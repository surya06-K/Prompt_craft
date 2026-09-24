import { route } from '@/lib/http'
import { deletePayment } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const DELETE = route(async (req, { tripId, paymentId }) => deletePayment(tripId, paymentId))
