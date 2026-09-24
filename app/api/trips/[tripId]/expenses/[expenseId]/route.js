import { route, body, by } from '@/lib/http'
import { saveExpense, deleteExpense } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const PUT = route(async (req, { tripId, expenseId }) => ({ expense: await saveExpense(tripId, expenseId, await body(req), by(req)) }))

export const DELETE = route(async (req, { tripId, expenseId }) => deleteExpense(tripId, expenseId))
