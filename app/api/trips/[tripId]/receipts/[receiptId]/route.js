import { route } from '@/lib/http'
import { getReceipt, deleteUnusedReceipt } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const GET = route(async (req, { tripId, receiptId }) => {
  const { contentType, body } = await getReceipt(tripId, receiptId)
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      // receipt ids are never reused, so the image can be cached for good
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})

export const DELETE = route(async (req, { tripId, receiptId }) => deleteUnusedReceipt(tripId, receiptId))
