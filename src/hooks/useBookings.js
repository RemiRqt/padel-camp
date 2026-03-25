import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toDateString } from '@/utils/formatDate'

export function useBookings(date) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  // Stabilize: convert date object to string so the dep doesn't change on every render
  const dateStr = date ? toDateString(date) : null
  const prevDateStr = useRef(dateStr)

  const fetchBookings = useCallback(async () => {
    if (!dateStr) return
    setLoading(true)
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('date', dateStr)
      .eq('status', 'confirmed')
    if (!error && data) setBookings(data)
    setLoading(false)
  }, [dateStr])

  // Fetch on mount and when date string changes
  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  // Realtime subscription — keyed on dateStr
  useEffect(() => {
    if (!dateStr) return
    const channel = supabase
      .channel('bookings-' + dateStr)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `date=eq.${dateStr}` },
        () => fetchBookings()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [dateStr, fetchBookings])

  return { bookings, loading, refetch: fetchBookings }
}

export function useUserBookings(userId) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    async function fetch() {
      const today = toDateString(new Date())

      // Get bookings created by user OR where user is an accepted player
      const [ownRes, invitedRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*')
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

      const ownBookings = ownRes.data || []
      // Filter invited bookings: confirmed, upcoming, not already in own
      const ownIds = new Set(ownBookings.map((b) => b.id))
      const invitedBookings = (invitedRes.data || [])
        .map((p) => p.booking)
        .filter((b) => b && b.status === 'confirmed' && b.date >= today && !ownIds.has(b.id))

      const all = [...ownBookings, ...invitedBookings]
        .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
        .slice(0, 5)

      setBookings(all)
      setLoading(false)
    }
    fetch()
  }, [userId])

  return { bookings, loading }
}
