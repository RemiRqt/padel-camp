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
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .gte('date', today)
        .order('date')
        .order('start_time')
        .limit(5)
      if (!error && data) setBookings(data)
      setLoading(false)
    }
    fetch()
  }, [userId])

  return { bookings, loading }
}
