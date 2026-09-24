import TripApp from '@/components/TripApp'

export const metadata = { title: 'Trip · TripSplit' }

export default async function TripPage({ params, searchParams }) {
  const { tripId } = await params
  const { new: justCreated } = await searchParams
  return <TripApp tripId={tripId} justCreated={justCreated === '1'} />
}
