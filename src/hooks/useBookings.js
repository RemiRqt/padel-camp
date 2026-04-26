import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toDateString } from '@/utils/formatDate'
import { qk } from '@/lib/queryKeys'

async function fetchBookingsByDate(dateStr) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, user_id, user_name, court_id, date, start_time, end_time, price, status, payment_status')
    .eq('date', dateStr)
    .eq('status', 'confirmed')
  if (error) throw error
  return data || []
}

export function useBookings(date) {
  const dateStr = date ? toDateString(date) : null
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk.bookings.byDate(dateStr),
    queryFn: () => fetchBookingsByDate(dateStr),
    enabled: !!dateStr,
  })

  // Realtime: invalidate this date's query on any change so useQuery refetches.
  useEffect(() => {
    if (!dateStr) return
    const channel = supabase
      .channel('bookings-' + dateStr)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `date=eq.${dateStr}` },
        () => queryClient.invalidateQueries({ queryKey: qk.bookings.byDate(dateStr) })
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [dateStr, queryClient])

  return { bookings: data || [], loading: isLoading, error: isError, refetch }
}

async function fetchUserUpcomingBookings(userId) {
  const today = toDateString(new Date())

  const [ownRes, invitedRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, user_id, user_name, court_id, date, start_time, end_time, price, status, payment_status')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .gte('date', today)
      .order('date')
      .order('start_time')
      .limit(10),
    supabase
      .from('booking_players')
      .select('booking_id, booking:bookings(*)')
      .eq('user_id', userId)
      .eq('invitation_status', 'accepted')
      .limit(20),
  ])

  if (ownRes.error) throw ownRes.error
  if (invitedRes.error) throw invitedRes.error

  const ownBookings = ownRes.data || []
  const ownIds = new Set(ownBookings.map((b) => b.id))
  const invitedBookings = (invitedRes.data || [])
    .map((p) => p.booking)
    .filter((b) => b && b.status === 'confirmed' && b.date >= today && !ownIds.has(b.id))

  return [...ownBookings, ...invitedBookings]
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
    .slice(0, 5)
}

export function useUserBookings(userId) {
  const { data, isLoading } = useQuery({
    queryKey: qk.bookings.user(userId),
    queryFn: () => fetchUserUpcomingBookings(userId),
    enabled: !!userId,
  })

  return { bookings: data || [], loading: isLoading }
}
